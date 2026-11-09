import express from 'express';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {onlineConfig,createServerDirectory,safeText,sourceAuth} from './servers.js';
export {onlineConfig,normalizeServer,createMonitor} from './servers.js';

// Release names come from current server status, never the last recorded match.
// Older builds advertise only otx_version=1; their release is in the hostname.
export function serverModVersion(snapshot) {
  const info=snapshot?.server?.info||{};
  const release=(value,allowSemver=true)=>{
    const text=safeText(value);
    const beta=/\b(?:beta\s*|b)(\d+(?:\.\d+)?)(?:\s*[-/]?\s*(?:preview|p)\s*(\d+(?:\.\d+)?))?/i.exec(text);
    if(beta)return `Beta ${beta[1]}${beta[2]?' Preview '+beta[2]:''}`;
    const version=allowSemver&&/\b\d+\.\d+(?:\.\d+)?(?:[-+][a-z0-9.-]+)?\b/i.exec(text);
    return version?.[0]||null;
  };
  const version=release(info.otx_version)||release(info.mod_version)||release(info.hostname,false);
  return {state:snapshot?.state||'unavailable',mod:safeText(info.gamename||info.game)||'OpenTDM-X',version,
    updatedAt:snapshot?.server?.updatedAt||null};
}

// The two existing players create a socket at the origin root. Adapt only that
// URL inside their iframe; engine code/assets and UDP transport stay Tournament's.
export function playerBridge(base, address, id) {
  return `(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){const u=new URL(url,location.href);if(u.searchParams.get('target')!==${JSON.stringify(address)})throw new Error('Unexpected Q2TV target');const dest=new URL(${JSON.stringify(base+'/api/online/socket')},location.origin);dest.protocol=location.protocol==='https:'?'wss:':'ws:';dest.searchParams.set('target',${JSON.stringify(address)});${id?"dest.searchParams.set('serverId',"+JSON.stringify(id)+");":''}super(dest.href,protocols);}};})();`;
}

export async function attachOnline(app, base, options, dependencies={}) {
  const config=dependencies.config||await onlineConfig(options),directory=createServerDirectory(config,dependencies);
  const select=req=>config.servers.find(s=>s.id===(req.query.serverId??config.defaultId));
  const playerURL=(s,variant)=>base+'/'+variant+'/'+(s.legacy?'':'servers/'+encodeURIComponent(s.id)+'/')+'?s='+encodeURIComponent(Buffer.from(s.address).toString('base64'));
  const payload=s=>{
    const snapshot=directory.read(s.id);
    return {...snapshot,id:s.id,address:s.address,pollSeconds:config.pollSeconds,version:serverModVersion(snapshot),
      players:s.q2tv?{desktop:playerURL(s,'q2tv'),mobile:playerURL(s,'q2tv-mobile')}:null};
  };
  app.get(base+'/api/online/servers',(req,res)=>res.set('Cache-Control','no-store').json({defaultServerId:config.defaultId,servers:config.servers.map(payload)}));
  app.get(base+'/api/online/version',async(req,res)=>{
    const selected=select(req);if(!selected)return res.sendStatus(404);
    res.set('Cache-Control','no-store').json(serverModVersion(await directory.ready(selected.id)));
  });
  app.get(base+'/api/online',async(req,res)=>{
    const selected=select(req);if(!selected)return res.status(404).json({error:'Unknown server'});
    await directory.ready(selected.id);
    res.set('Cache-Control','no-store').json({...payload(selected),servers:config.servers.map(s=>({metadata:directory.read(s.id).metadata,state:directory.read(s.id).state,checkedAt:directory.read(s.id).checkedAt})),defaultServerId:config.defaultId});
  });
  app.post(base+'/api/ingest/status',sourceAuth(config.servers),express.json({limit:'128kb'}),(req,res,next)=>{
    try{res.set('Cache-Control','no-store').json(directory.report(req.sourceServer.id,req.body));}catch(e){next(e);}
  });
  app.get(base+'/api/online/player-bridge.js',(req,res)=>{
    const selected=select(req);if(!selected||!selected.q2tv)return res.sendStatus(403);
    res.type('js').set('Cache-Control','no-cache').send(playerBridge(base,selected.address,selected.legacy?null:selected.id));
  });
  for (const player of ['q2tv','q2tv-mobile']) {
    app.use(base+'/'+player, async (req,res,next) => {
      if (!['GET','HEAD'].includes(req.method)) return res.sendStatus(405);
      const scoped=/^\/servers\/([a-z0-9][a-z0-9_-]{0,47})(\/.*)$/.exec(req.path);
      if(req.path.startsWith('/servers/')&&!scoped)return res.sendStatus(404);
      if(scoped&&req.query.serverId!==undefined&&req.query.serverId!==scoped[1])return res.sendStatus(403);
      const name=scoped?scoped[2]:req.path;
      const config=scoped?select({query:{serverId:scoped[1]}}):select(req);if(!config||!config.q2tv)return res.sendStatus(403);
      if((name==='/'||name.endsWith('.html'))&&req.query.s!==undefined&&req.query.s!==Buffer.from(config.address).toString('base64'))return res.sendStatus(403);
      // Fixed upstream, fixed asset directories. No arbitrary URL proxy or env files.
      const isDownload = name==='/http-file';
      if(isDownload && req.query.server!==config.server)return res.sendStatus(403);
      if (!isDownload && name !== '/' && (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:html|js|wasm|data|css|png|jpg|jpeg|webp|svg|ico|json|txt)(?:\.gz)?$/.test(name) || name.includes('..'))) return res.sendStatus(404);
      const abort = new AbortController();
      res.on('close',()=>abort.abort());
      try {
        const query=isDownload?'?'+new URLSearchParams({server:config.server,path:String(req.query.path||''),game:String(req.query.game||'baseq2')}):(/^(?:[a-f0-9]{16}|[a-f0-9]{64})$/.test(req.query.v||'')?'?v='+req.query.v:'');
        const headers={};if(!isDownload&&req.headers['if-none-match'])headers['If-None-Match']=req.headers['if-none-match'];
        const upstream = await fetch(config.tournamentOrigin+'/'+player+name+query,{method:req.method,headers,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(120000)]),redirect:'error'});
        for(const header of ['etag','last-modified','x-q2tv-content-hash','cache-control'])if(upstream.headers.has(header))res.set(header,upstream.headers.get(header));
        if(upstream.status===304){res.status(304).end();return;}
        if (!upstream.ok) {await upstream.body?.cancel();return res.status(502).type('text').send('Q2TV is temporarily unavailable');}
        const isHTML = name==='/' || name.endsWith('.html');
        res.set({'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin',
          'Content-Security-Policy':"default-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self'",'Cache-Control':isHTML?'no-cache':isDownload?'no-store':upstream.headers.get('cache-control')||'no-cache'});
        res.type(upstream.headers.get('content-type') || 'application/octet-stream');
        if (isHTML) {
          const html = (await upstream.text()).replace(/<head([^>]*)>/i,`<head$1><script src="${base}/api/online/player-bridge.js${config.legacy?'':'?serverId='+encodeURIComponent(config.id)}"></script>`);
          res.send(html);
        } else if(req.method==='HEAD') {await upstream.body?.cancel();res.end();}
        else await pipeline(Readable.fromWeb(upstream.body),res);
      } catch(e) {if(!abort.signal.aborted){if(!res.headersSent)res.status(502).type('text').send('Q2TV is temporarily unavailable');else res.destroy();}}
    });
  }
  const bindSockets=function(server) {
    const sockets = new Set();
    const closeAll=()=>{directory.close();for(const socket of sockets)socket.destroy();};
    server.on('upgrade',(req,socket,head)=>{
      let url, requestOrigin;
      try {url=new URL(req.url,'http://localhost');requestOrigin=new URL(req.headers.origin);}
      catch {socket.destroy();return;}
      const config=select({query:Object.fromEntries(url.searchParams)});
      if (!config||!config.q2tv||url.pathname!==base+'/api/online/socket' || url.searchParams.get('target')!==config.server || requestOrigin.host!==req.headers.host || sockets.size>=64 || req.headers['sec-websocket-protocol']!=='quake2') {socket.destroy();return;}
      const dest=new URL('/?target='+encodeURIComponent(config.server),config.tournamentOrigin);
      const headers={host:dest.host,origin:dest.origin,connection:'Upgrade',upgrade:'websocket'};
      for(const k of ['sec-websocket-key','sec-websocket-version','sec-websocket-protocol','sec-websocket-extensions'])if(req.headers[k])headers[k]=req.headers[k];
      const proxy=(dest.protocol==='https:'?https:http).request(dest,{headers,timeout:10000});
      sockets.add(socket);socket.on('close',()=>{sockets.delete(socket);proxy.destroy();});socket.on('error',()=>socket.destroy());
      proxy.on('upgrade',(response,upstream,upHead)=>{
        proxy.setTimeout(0);
        sockets.add(upstream);upstream.on('close',()=>{sockets.delete(upstream);socket.destroy();});upstream.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
        socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(response.headers).filter(([k])=>['upgrade','connection','sec-websocket-accept','sec-websocket-protocol','sec-websocket-extensions'].includes(k)).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
        if(head.length)upstream.write(head);if(upHead.length)socket.write(upHead);socket.pipe(upstream).pipe(socket);
      });
      proxy.on('timeout',()=>proxy.destroy());proxy.on('error',()=>socket.destroy());proxy.on('response',r=>{r.resume();socket.destroy();});proxy.end();
    });
    server.on('close',closeAll);
    return closeAll;
  };
  bindSockets.close=()=>directory.close();
  return bindSockets;
}

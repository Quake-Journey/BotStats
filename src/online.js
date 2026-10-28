import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createModeMonitor } from './online-modes.js';

const DEFAULT_SERVER = '91.227.18.67:27950';
const safeText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300);
const privateKey = /password|passwd|rcon|token|secret|api.?key/i;

function origin(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Invalid online service origin');
  return u.origin;
}

// Only named settings are read from Tournament's environment. The optional
// RCON credential is kept server-side and never included in a public response.
export async function onlineConfig(config = {}) {
  let env = {};
  try { env = parseEnv(await readFile(config.tournamentEnv || 'C:/nodejs/Tournament/.env', 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw new Error('Cannot read Tournament environment'); }
  const server = config.server || DEFAULT_SERVER;
  if (!/^[a-z0-9.-]+:\d{1,5}$/i.test(server) || Number(server.split(':').at(-1)) > 65535 || Number(server.split(':').at(-1)) < 1) throw new Error('Invalid online game server');
  const tournamentPort=Number(env.SITE_PORT)||3000;
  return { server, monitorOrigin: origin(config.monitorOrigin || env.SERVERS_API || 'http://127.0.0.1:3001'),
    tournamentOrigin: origin(config.tournamentOrigin || `http://127.0.0.1:${tournamentPort}`), pollSeconds: 10,
    rconPassword:config.rconPassword||process.env.BOTSTATS_ONLINE_RCON_PASSWORD||env.BOTSTATS_ONLINE_RCON_PASSWORD||'' };
}

export function normalizeServer(data, address, now = Date.now()) {
  if (!Array.isArray(data?.servers)) throw new Error('Invalid monitor response');
  const srv = data.servers.find(s => s.server === address || `${s.ip}:${s.port}` === address || s.allAddrs?.includes(address));
  if (!srv) return null;
  const info = Object.fromEntries(Object.entries(srv.serverInfo || {}).filter(([k,v]) => !privateKey.test(k) && ['number','string','boolean'].includes(typeof v)).map(([k,v]) => [safeText(k),safeText(v)]));
  const players = (Array.isArray(srv.serverPlayers) ? srv.serverPlayers : []).slice(0,256).map(p => {
    const score = typeof p.score === 'number' || typeof p.score === 'string' && /^-?\d+$/.test(p.score.trim()) ? Number(p.score) : null;
    const ping = p.ping !== '' && p.ping != null && Number.isFinite(Number(p.ping)) ? Number(p.ping) : null;
    return { name: safeText(p.name), score: Number.isFinite(score) ? score : null, ping, spectator: score === null };
  });
  const time = Date.parse(srv.lastUpdated);
  return { address, info, players, updatedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
    stale: srv.stale === true || Number.isFinite(time) && now-time > 120000 };
}

// One shared request per interval, independent of the number of page visitors.
// On failure retain the snapshot but explicitly mark it stale.
export function createMonitor(config, { fetchImpl = fetch, now = Date.now, cacheMs = 5000 } = {}) {
  let snapshot = null, lastAttempt = -Infinity, pending;
  return async function status() {
    if (pending) return pending;
    if (now()-lastAttempt < cacheMs) return snapshot;
    lastAttempt = now();
    pending = (async () => {
      try {
        const r = await fetchImpl(config.monitorOrigin+'/api/servers?game=q2&not_empty=0&ignore_bots=0', {signal:AbortSignal.timeout(7000),redirect:'error'});
        if (!r.ok) throw new Error('Monitor unavailable');
        const server = normalizeServer(await r.json(), config.server, now());
        snapshot = { server, state: !server ? 'missing' : server.stale ? 'stale' : 'online', checkedAt: new Date(now()).toISOString() };
      } catch {
        snapshot = { server: snapshot?.server ? {...snapshot.server,stale:true} : null, state: 'unavailable', checkedAt: new Date(now()).toISOString() };
      } finally { pending = null; }
      return snapshot;
    })();
    return pending;
  };
}

// The two existing players create a socket at the origin root. Adapt only that
// URL inside their iframe; engine code/assets and UDP transport stay Tournament's.
export function playerBridge(base, address) {
  return `(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){const u=new URL(url,location.href);if(u.searchParams.get('target')!==${JSON.stringify(address)})throw new Error('Unexpected Q2TV target');const dest=new URL(${JSON.stringify(base+'/api/online/socket')},location.origin);dest.protocol=location.protocol==='https:'?'wss:':'ws:';dest.searchParams.set('target',${JSON.stringify(address)});super(dest.href,protocols);}};})();`;
}

export async function attachOnline(app, base, options) {
  const config = await onlineConfig(options), status = createMonitor(config), currentModes=createModeMonitor(config);
  app.get(base+'/api/online', async (req,res) => {
    const [snapshot,modes]=await Promise.all([status(),currentModes()]);
    res.set('Cache-Control','no-store').json({...snapshot,modes,address:config.server,pollSeconds:config.pollSeconds,
      players:{desktop:base+'/q2tv/?s='+encodeURIComponent(Buffer.from(config.server).toString('base64')),mobile:base+'/q2tv-mobile/?s='+encodeURIComponent(Buffer.from(config.server).toString('base64'))}});
  });
  app.get(base+'/api/online/player-bridge.js', (req,res) => res.type('js').set('Cache-Control','no-cache').send(playerBridge(base,config.server)));
  for (const player of ['q2tv','q2tv-mobile']) {
    app.use(base+'/'+player, async (req,res,next) => {
      if (!['GET','HEAD'].includes(req.method)) return res.sendStatus(405);
      const name = req.path;
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
          const html = (await upstream.text()).replace(/<head([^>]*)>/i,`<head$1><script src="${base}/api/online/player-bridge.js"></script>`);
          res.send(html);
        } else if(req.method==='HEAD') {await upstream.body?.cancel();res.end();}
        else await pipeline(Readable.fromWeb(upstream.body),res);
      } catch(e) {if(!abort.signal.aborted){if(!res.headersSent)res.status(502).type('text').send('Q2TV is temporarily unavailable');else res.destroy();}}
    });
  }
  return function bindSockets(server) {
    const sockets = new Set();
    const closeAll=()=>{for(const socket of sockets)socket.destroy();};
    server.on('upgrade',(req,socket,head)=>{
      let url, requestOrigin;
      try {url=new URL(req.url,'http://localhost');requestOrigin=new URL(req.headers.origin);}
      catch {socket.destroy();return;}
      if (url.pathname!==base+'/api/online/socket' || url.searchParams.get('target')!==config.server || requestOrigin.host!==req.headers.host || sockets.size>=64 || req.headers['sec-websocket-protocol']!=='quake2') {socket.destroy();return;}
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
}

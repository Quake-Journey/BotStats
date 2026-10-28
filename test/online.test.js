import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {normalizeServer,createMonitor,onlineConfig,attachOnline} from '../src/online.js';
import {scoreChanges,playerVariant} from '../public/online-ui.js';
import {testPath} from './support/paths.js';
const addr='91.227.18.67:27950';
const snapshot=(score=1,map='q2duel5')=>({servers:[{server:addr,serverInfo:{mapname:map,time_remaining:'2:30',hostname:'Test',rcon_password:'secret',api_token:'secret'},serverPlayers:[{name:'pp',score,ping:9},{name:'David-X[200]',score:'7',ping:0},{name:'viewer',score:'Spectator',ping:11}],lastUpdated:'2026-10-28T12:00:00Z'}]});
test('online: only the selected server and public status fields are exposed',()=>{
  const result=normalizeServer(snapshot(),addr,Date.parse('2026-10-28T12:00:10Z'));
  assert.equal(result.stale,false);assert.equal(result.players[1].score,7);assert.equal(result.players[1].ping,0);assert.equal(result.players[2].spectator,true);assert.equal(result.players[2].score,null);
  assert.equal(result.info.rcon_password,undefined);assert.equal(result.info.api_token,undefined);
  assert.equal(normalizeServer(snapshot(),'127.0.0.1:27910'),null);
  assert.equal(normalizeServer(snapshot(),addr,Date.parse('2026-10-28T12:03:00Z')).stale,true);
});
test('online: shared polling coalesces viewers and distinguishes stale data from current data',async()=>{
  let calls=0,now=Date.parse('2026-10-28T12:00:00Z'),fail=false;
  const status=createMonitor({server:addr,monitorOrigin:'http://localhost:3001'},{now:()=>now,fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(fail)throw new Error('network secret');return new Response(JSON.stringify(snapshot()));}});
  const all=await Promise.all(Array.from({length:15},()=>status()));assert.equal(calls,1);assert.equal(all[0].state,'online');await status();assert.equal(calls,1);
  now+=6000;fail=true;const old=await status();assert.equal(calls,2);assert.equal(old.state,'unavailable');assert.equal(old.server.stale,true);assert.equal(old.server.players[0].name,'pp');assert.ok(!JSON.stringify(old).includes('network secret'));
  now+=6000;fail=false;assert.equal((await status()).state,'online');
});
test('online: delta reset and desktop/mobile selection follow the existing monitor',()=>{
  const prev=normalizeServer(snapshot(),addr),next=normalizeServer(snapshot(3),addr);
  assert.equal(scoreChanges(prev,next).get('pp'),2);assert.equal(scoreChanges(prev,normalizeServer(snapshot(3,'q3t2'),addr)).size,0);
  const high=normalizeServer(snapshot(20),addr),reset=structuredClone(high);reset.players.forEach(p=>{if(p.score!==null)p.score=0;});assert.equal(scoreChanges(high,reset).size,0);
  assert.equal(playerVariant('auto',{userAgent:'iPhone'}),'mobile');assert.equal(playerVariant('auto',{userAgent:'Mac',platform:'MacIntel',maxTouchPoints:5}),'mobile');assert.equal(playerVariant('desktop',{userAgent:'Android'}),'desktop');assert.equal(playerVariant('auto',{userAgent:'Firefox Windows'}),'desktop');
});
test('online: reuse Tournament env without loading unrelated secrets or exposing them',async()=>{
  const dir=testPath('online-env');await mkdir(dir,{recursive:true});await writeFile(dir+'/tournament.env','SERVERS_API=http://127.0.0.1:39001\nBOTSTATS_TEST_SECRET=private\n');
  const c=await onlineConfig({tournamentEnv:dir+'/tournament.env'});assert.equal(c.monitorOrigin,'http://127.0.0.1:39001');assert.equal(c.tournamentOrigin,'http://127.0.0.1:3000');assert.equal(process.env.BOTSTATS_TEST_SECRET,undefined);assert.ok(!JSON.stringify(c).includes('private'));
  await assert.rejects(()=>onlineConfig({monitorOrigin:'http://name:secret@localhost'}));
});
test('online: same-origin player shares Tournament assets/socket without making an open proxy',async()=>{
  const version='a'.repeat(64),assetRequests=[],upstream=express();upstream.get('/api/servers',(req,res)=>res.json(snapshot()));upstream.get('/q2tv/',(req,res)=>res.type('html').send('<html><head></head><body>Player</body></html>'));upstream.get('/q2tv/test.wasm',(req,res)=>{assetRequests.push({method:req.method,version:req.query.v});res.set({'ETag':'"'+version+'"','X-Q2TV-Content-Hash':version,'Cache-Control':'public, max-age=31536000, immutable'});if(req.headers['if-none-match']==='"'+version+'"')return res.status(304).end();res.type('application/wasm').send(Buffer.from([0,97,115,109]));});
  const remote=upstream.listen(0,'127.0.0.1');await new Promise(r=>remote.once('listening',r));
  let connects=0;const remoteSockets=new Set();
  remote.on('upgrade',(req,socket)=>{connects++;remoteSockets.add(socket);socket.on('close',()=>remoteSockets.delete(socket));socket.on('error',()=>{});assert.equal(req.url,'/?target='+encodeURIComponent(addr));const key=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\nSec-WebSocket-Protocol: quake2\r\n\r\n`);socket.write(Buffer.from([0x81,2,111,107]));});
  const upstreamOrigin=`http://127.0.0.1:${remote.address().port}`,app=express(),bind=await attachOnline(app,'/botstats',{monitorOrigin:upstreamOrigin,tournamentOrigin:upstreamOrigin}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const close=bind(server),base=`http://127.0.0.1:${server.address().port}`;
  try{
    const status=await(await fetch(base+'/botstats/api/online')).json();assert.equal(status.address,addr);assert.equal(status.players.desktop,'/botstats/q2tv/?s='+encodeURIComponent(Buffer.from(addr).toString('base64')));assert.ok(!JSON.stringify(status).includes(upstreamOrigin));
    const html=await fetch(base+'/botstats/q2tv/');assert.equal(html.headers.get('cross-origin-embedder-policy'),'require-corp');assert.match(await html.text(),/<head><script src="\/botstats\/api\/online\/player-bridge.js"><\/script>/);
    const wasm=await fetch(base+'/botstats/q2tv/test.wasm');assert.equal(wasm.headers.get('content-type'),'application/wasm');assert.deepEqual([...new Uint8Array(await wasm.arrayBuffer())],[0,97,115,109]);
    const head=await fetch(base+'/botstats/q2tv/test.wasm?v='+version,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('x-q2tv-content-hash'),version);assert.match(head.headers.get('cache-control'),/immutable/);assert.deepEqual(assetRequests.at(-1),{method:'HEAD',version});
    const unchanged=await fetch(base+'/botstats/q2tv/test.wasm?v='+version,{headers:{'If-None-Match':'"'+version+'"'}});assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.equal(unchanged.headers.get('etag'),'"'+version+'"');
    for(const path of ['/botstats/q2tv/.env','/botstats/q2tv/%2e%2e%2f.env','/botstats/q2tv/config.cjs'])assert.equal((await fetch(base+path)).status,404);
    // Native WebSocket cannot set Origin in Node. Exercise the exact browser
    // handshake with http and verify the Tournament handshake/data are relayed.
    const http=await import('node:http');
    async function handshake(target,origin){return new Promise((resolve,reject)=>{const request=http.request(base+'/botstats/api/online/socket?target='+encodeURIComponent(target),{headers:{origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':'dGhlIHNhbXBsZSBub25jZQ==','sec-websocket-protocol':'quake2'}});request.on('upgrade',(r,s,head)=>{assert.equal(r.headers['sec-websocket-accept'],'s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');s.destroy();resolve(true);});request.on('error',()=>resolve(false));request.end();});}
    assert.equal(await handshake(addr,base),true);assert.equal(await handshake('127.0.0.1:22',base),false);assert.equal(await handshake(addr,'https://unrelated.example'),false);assert.equal(connects,1);
  }finally{close();for(const socket of remoteSockets)socket.destroy();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>remote.close(r))]);}
});

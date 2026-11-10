import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import dgram from 'node:dgram';
import vm from 'node:vm';
import {once} from 'node:events';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {MongoClient} from 'mongodb';
import {onlineConfig,createServerDirectory} from '../src/servers.js';
import {attachOnline,playerBridge} from '../src/online.js';
import {createService} from '../src/server.js';
import {sendManifest} from '../src/importer.js';
import {parseStatusPacket,queryGameStatus,reportStatus,ingestBase} from '../src/importer-status.js';
import {testPath} from './support/paths.js';

const tokenA='fixture-source-a-'.repeat(3),tokenB='fixture-source-b-'.repeat(3);
const spec=(id,extra={})=>({id,name:'Server '+id,address:'127.0.0.1:27910',access:'lan',transport:'report',sourceToken:id==='a'?tokenA:tokenB,...extra});
const body=(id,at,extra={})=>({schemaVersion:1,serverId:id,observedAt:new Date(at).toISOString(),state:'online',info:{mapname:'omf',gamename:'OpenTDM-X',otx_version:'Beta 14 Preview 2'},players:[{name:'player-'+id,score:2,ping:9}],modes:{hardcore:1,training:0},...extra});
const listen=async app=>{const s=app.listen(0,'127.0.0.1');await once(s,'listening');return s;};
const host=s=>'http://127.0.0.1:'+s.address().port;

test('registry rejects duplicate identity/credentials, invalid access and accidental legacy credential reuse',async()=>{
  for(const servers of [[spec('a'),spec('a')],[spec('a'),spec('b',{sourceToken:tokenA})],[spec('a',{q2tv:true})],[spec('a',{transport:'report',sourceToken:undefined})],[spec('a',{address:'http://localhost'})]])await assert.rejects(()=>onlineConfig({servers}));
  const {sourceAuth}=await import('../src/servers.js');
  assert.throws(()=>sourceAuth([spec('a')],tokenA));
  const c=await onlineConfig({servers:[spec('a'),spec('b')]});assert.equal(c.defaultId,'a');
});

test('independent status lifetime: startup, online, stale, offline, lost reporter, recovery and restart',async()=>{
  let at=Date.now();const c=await onlineConfig({servers:[spec('a'),spec('b')]});
  const directory=createServerDirectory(c,{now:()=>at});
  assert.deepEqual(directory.list().map(s=>s.state),['missing','missing']);
  directory.report('a',body('a',at));directory.report('b',body('b',at));
  assert.equal(directory.read('a').server.players[0].name,'player-a');
  at+=46000;assert.equal(directory.read('a').state,'stale');assert.equal(directory.read('a').modes.hardcore,null);
  directory.report('b',body('b',at));assert.equal(directory.read('b').state,'online');assert.equal(directory.read('a').state,'stale');
  directory.report('a',body('a',at,{state:'offline',info:{},players:[],modes:{hardcore:null,training:null}}));
  assert.equal(directory.read('a').state,'offline');assert.equal(directory.read('a').server,null);
  at+=1000;directory.report('a',body('a',at));assert.equal(directory.read('a').state,'online');
  assert.throws(()=>directory.report('a',body('a',at)),{status:409});
  for(const override of [{serverId:'b'},{observedAt:new Date(at+10000).toISOString()},{observedAt:new Date(at-90000).toISOString()},{info:{rcon_password:'never-publish'}},{players:[{name:'bad',score:'2',ping:1}]},{state:'offline'},{modes:{hardcore:4,training:null}},{unknown:true}])assert.throws(()=>directory.report('a',body('a',at+1,override)));
  directory.close();const restarted=createServerDirectory(c,{now:()=>at});assert.equal(restarted.read('a').state,'missing');restarted.close();
});

test('monitor polling runs without visitors and concurrent readers never multiply polls; one timeout cannot mask another source',async()=>{
  let calls=0;const c=await onlineConfig({servers:[spec('a',{transport:'monitor'}),spec('b')]});
  const directory=createServerDirectory(c,{pollMs:20,modeRead:async()=>({hardcore:0,training:1}),fetchImpl:async()=>{calls++;return new Response(JSON.stringify({servers:[{server:c.servers[0].address,lastUpdated:new Date().toISOString(),serverInfo:{mapname:'q2duel5'},serverPlayers:[]}]}));}});
  try{
    await directory.ready('a');const initial=calls;
    await Promise.all(Array.from({length:30},()=>directory.ready('a')));assert.equal(calls,initial);
    await new Promise(r=>setTimeout(r,55));assert.ok(calls>initial,'Polls continue with zero readers');
    assert.equal(directory.read('b').state,'missing');assert.equal(directory.read('a').state,'online');
  }finally{directory.close();}
  let release;const stalled=createServerDirectory(c,{modeRead:async()=>({}),fetchImpl:()=>new Promise(r=>release=r)});
  stalled.report('b',body('b',Date.now()));assert.equal(stalled.read('b').state,'online');assert.equal(stalled.read('a').state,'missing');
  release(new Response('{}',{status:503}));await stalled.ready('a');assert.equal(stalled.read('a').state,'unavailable');stalled.close();
});

test('real UDP status reporter authenticates observations, excludes credentials and handles silence and malformed packets',async()=>{
  const udp=dgram.createSocket('udp4');udp.bind(0,'127.0.0.1');await once(udp,'listening');
  let mode='online';udp.on('message',(packet,peer)=>{assert.equal(packet.toString('latin1'),'\xff\xff\xff\xffstatus\n');if(mode==='silent')return;udp.send(Buffer.from(mode==='online'?'\xff\xff\xff\xffprint\n\\mapname\\omf\\gamename\\OpenTDM-X\\rcon_password\\hidden\n2 9 "Human"\n7 0 "Bot"\n':'malformed','latin1'),peer.port,peer.address);});
  const address='127.0.0.1:'+udp.address().port;
  try{
    const status=await queryGameStatus(address);assert.equal(status.state,'online');assert.equal(status.info.rcon_password,undefined);assert.equal(status.players.length,2);
    let sent;await reportStatus({serverId:'a',ingestToken:tokenA,apiUrl:'http://127.0.0.1:1/botstats',status:{address}},{readModes:async()=>({hardcore:null,training:null}),fetchImpl:async(url,options)=>{sent={url,...options};return new Response('{}');}});
    assert.equal(sent.headers['x-botstats-server'],'a');assert.equal(JSON.parse(sent.body).state,'online');assert.ok(!sent.body.includes('hidden'));assert.equal(sent.redirect,'error');
    mode='silent';assert.equal((await queryGameStatus(address,{timeoutMs:25})).state,'offline');
    mode='bad';assert.equal((await queryGameStatus(address)).state,'unavailable');
    assert.throws(()=>parseStatusPacket(Buffer.from('bad')));
    for(const apiUrl of ['http://example.com/botstats','ftp://localhost/','https://user:pass@example.com/'])assert.throws(()=>ingestBase({apiUrl}));
  }finally{await new Promise(r=>udp.close(r));}
});

test('HTTP, downloads, bridge and WebSocket select the same allowed public server; LAN cannot open Q2TV',async()=>{
  const requests=[],upstream=express();upstream.get('/q2tv/',(req,res)=>res.type('html').send('<html><head></head><body>Player</body></html>'));
  upstream.get('/q2tv/http-file',(req,res)=>{requests.push(req.query.server);res.send('map');});
  const remote=await listen(upstream),sockets=new Set(),targets=[];
  remote.on('upgrade',(req,socket)=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));targets.push(new URL(req.url,'http://localhost').searchParams.get('target'));const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\nSec-WebSocket-Protocol: quake2\r\n\r\n');});
  const app=express(),servers=[spec('a',{access:'public',q2tv:true,address:'alpha.example:27910'}),spec('b',{access:'public',q2tv:true,address:'beta.example:27920'}),spec('lan',{sourceToken:'fixture-lan-source-'.repeat(3)})];
  const bind=await attachOnline(app,'/botstats',{servers,tournamentOrigin:host(remote)}),server=await listen(app),close=bind(server),base=host(server)+'/botstats';
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
  const handshake=(id,target)=>new Promise(resolve=>{const req=http.request(base+'/api/online/socket?'+new URLSearchParams({serverId:id,target}),{headers:{origin:host(server),connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':'dGhlIHNhbXBsZSBub25jZQ==','sec-websocket-protocol':'quake2'}});req.on('upgrade',(r,s)=>{s.destroy();resolve(true);});req.on('error',()=>resolve(false));req.end();});
  try{
    for(const s of servers.slice(0,2)){
      const data=await(await fetch(base+'/api/online?serverId='+s.id)).json();assert.equal(data.id,s.id);assert.equal(data.address,s.address);
      assert.ok(data.players.desktop.includes('/servers/'+s.id+'/'));
      const markup=await(await fetch(host(server)+data.players.desktop)).text();assert.ok(markup.includes('player-bridge.js?serverId='+s.id));
      assert.equal((await fetch(base+'/q2tv/servers/'+s.id+'/http-file?'+new URLSearchParams({server:s.address,path:'maps/omf.bsp'}))).status,200);
      assert.equal(await handshake(s.id,s.address),true);
      let destination;const Native=class{constructor(url){destination=url;}};
      const window={WebSocket:Native},location={href:host(server)+data.players.desktop,origin:host(server),protocol:'http:'};
      vm.runInNewContext(playerBridge('/botstats',s.address,s.id),{window,URL,location});
      new window.WebSocket('ws://localhost/?target='+s.address,'quake2');assert.equal(new URL(destination).searchParams.get('serverId'),s.id);
      assert.throws(()=>new window.WebSocket('ws://localhost/?target=127.0.0.1:22','quake2'));
    }
    assert.deepEqual(targets,['alpha.example:27910','beta.example:27920']);assert.deepEqual(requests,targets);
    assert.equal(await handshake('a','beta.example:27920'),false);assert.equal(await handshake('lan',servers[2].address),false);
    for(const path of ['/api/online?serverId=unknown','/q2tv/servers/lan/','/api/online/player-bridge.js?serverId=lan','/q2tv/servers/a/http-file?server=beta.example:27920','/q2tv/servers/a/?s='+Buffer.from('beta.example:27920').toString('base64')])assert.ok([403,404].includes((await fetch(base+path)).status),path);
    for(const headers of [{},{'x-ingest-token':tokenA},{'x-ingest-token':tokenB,'x-botstats-server':'a'}])assert.equal((await fetch(base+'/api/ingest/status',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body('a',Date.now()))})).status,401);
    assert.equal((await fetch(base+'/api/ingest/status',{method:'POST',headers:{'x-ingest-token':tokenA,'x-botstats-server':'a','content-type':'application/json'},body:JSON.stringify(body('b',Date.now()))})).status,400);
    const response=await fetch(base+'/api/online/servers');const publicJSON=await response.text();for(const secret of [tokenA,tokenB,host(remote)])assert.ok(!publicJSON.includes(secret));
  }finally{close();for(const s of sockets)s.destroy();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>remote.close(r))]);}
});

test('authenticated ingest stores immutable source metadata, rejects a conflicting source and keeps legacy attribution unknown',async()=>{
  const suffix=Date.now()+'_'+randomBytes(3).toString('hex'),database='q2pro_botstats_multiserver_'+suffix;
  const config={database,mongoUri:'mongodb://127.0.0.1:27017',ingestToken:'fixture-legacy-'.repeat(4),storageDir:testPath('multiserver',suffix),online:{servers:[spec('a'),spec('b')]}};
  await mkdir(config.storageDir,{recursive:true});
  const {app,store}=await createService(config),server=await listen(app),apiUrl=host(server)+'/botstats';
  const make=async seed=>{const data=Buffer.from('MVD2'+seed),sha=createHash('sha256').update(data).digest('hex'),file=config.storageDir+'/'+seed+'.mvd2';await writeFile(file,data);return {file,manifest:{schemaVersion:1,parserVersion:'0.3.1',demo:{sha256:sha,size:data.length,originalName:seed+'.mvd2',recordedAt:null,dateSource:null},matches:[{id:sha+'-0-0',map:'omf',status:'completed',winnerIndex:0,statsComplete:false,startedAt:null,source:{id:'spoofed'},participants:[{name:'Human',isBot:false,score:2,stats:null},{name:'Bot',isBot:true,score:0,stats:null}]}]}};};
  try{
    const fresh=await make('new-source');const a={...config,apiUrl,serverId:'a',ingestToken:tokenA},b={...a,serverId:'b',ingestToken:tokenB};
    const advertised=await fetch(apiUrl+'/api/ingest/status',{method:'POST',headers:{'content-type':'application/json','x-ingest-token':tokenA,'x-botstats-server':'a'},body:JSON.stringify(body('a',Date.now(),{info:{mapname:'omf',sv_public_address:'para.asuscomm.com:27910'}}))});assert.equal(advertised.status,200);
    const live=await(await fetch(apiUrl+'/api/online?serverId=a')).json();assert.equal(live.address,'para.asuscomm.com:27910');assert.equal(live.metadata.address,live.address);assert.equal(live.server.address,live.address);assert.equal(live.players,null,'Advertising must not enable Q2TV');
    assert.equal((await sendManifest(a,fresh.file,fresh.manifest)).duplicate,false);
    assert.equal((await sendManifest(a,fresh.file,fresh.manifest)).duplicate,true);
    assert.equal((await store.match(fresh.manifest.matches[0].id)).source.id,'a');
    assert.equal((await store.match(fresh.manifest.matches[0].id)).source.address,'para.asuscomm.com:27910');
    await assert.rejects(()=>sendManifest(b,fresh.file,fresh.manifest),/HTTP 409/);
    const legacy=await make('old-source');await sendManifest({...config,apiUrl},legacy.file,legacy.manifest);
    assert.equal((await store.match(legacy.manifest.matches[0].id)).source,null);
    await sendManifest(a,legacy.file,legacy.manifest);assert.equal((await store.match(legacy.manifest.matches[0].id)).source,null,'Reimport cannot rewrite unknown history');
    const claims={...fresh.manifest,sourceServerId:'b'};
    const result=await fetch(apiUrl+'/api/ingest/manifests',{method:'POST',headers:{'content-type':'application/json','x-ingest-token':tokenA,'x-botstats-server':'a'},body:JSON.stringify(claims)});assert.equal(result.status,403);
    assert.equal((await store.list({})).total,2);assert.equal((await store.summary({})).matches,2);
    const race=await make('racing-source');
    const raced=await Promise.allSettled([sendManifest(a,race.file,race.manifest),sendManifest(b,race.file,race.manifest)]);
    assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.filter(r=>r.status==='rejected'&&/HTTP 409/.test(r.reason.message)).length,1);
    assert.ok(['a','b'].includes((await store.match(race.manifest.matches[0].id)).source.id));
    assert.equal((await store.list({})).total,3,'Concurrent attribution keeps one SHA record');
    const download=await(await fetch(apiUrl+'/api/demos/'+fresh.manifest.demo.sha256)).arrayBuffer();assert.equal(createHash('sha256').update(Buffer.from(download)).digest('hex'),fresh.manifest.demo.sha256);
  }finally{
    await new Promise(r=>server.close(r));await store.close();
    const client=new MongoClient(config.mongoUri);await client.connect();await client.db(database).dropDatabase();await client.close();
  }
});

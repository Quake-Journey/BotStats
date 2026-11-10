import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import dgram from 'node:dgram';
import {once} from 'node:events';
import {normalizeServer} from '../src/servers.js';
import {attachOnline} from '../src/online.js';
import {parseStatusPacket,reportStatus} from '../src/importer-status.js';
import {rosterCounts,rosterCountsHTML,scoreChanges} from '../public/online-ui.js';

const address='127.0.0.1:27910';
const normalize=players=>normalizeServer({servers:[{server:address,lastUpdated:new Date().toISOString(),serverInfo:{mapname:'omf'},serverPlayers:players}]},address);
const rawPacket=()=>Buffer.from('\xff\xff\xff\xffprint\n\\mapname\\omf\n0 9 "Zero"\n17 0 "High score"\n-9999 12 "Sentinel"\n','latin1');

test('monitor preserves explicit roles and never infers membership from names, score, missing score or ping',()=>{
  const players=[
    {name:'Known player',score:0,ping:0,spectator:false},
    {name:'Known spectator',score:17,ping:0,spectator:true},
    {name:'Unknown',score:0,ping:9},
    {name:'No score',score:null,ping:0},
    {name:'Sentinel',score:-9999,ping:999},
    {name:'Q2TV spectator',score:55,ping:0},
    {name:'Missing',ping:0},
    {name:'Malformed',score:'N/A',spectator:'false'},
    {name:'Explicit unknown',score:12,spectator:null},
    {name:'Monitor marker',score:'Spectator',ping:9}
  ];
  const result=normalize(players);
  assert.deepEqual(result.players.map(p=>p.spectator),[false,true,null,null,null,null,null,null,null,true]);
  assert.deepEqual(result.counts,{clients:10,players:1,spectators:2,unknown:7});
  assert.equal(result.players[0].score,0);assert.equal(result.players[1].score,17);
  assert.deepEqual(rosterCounts(result.players),result.counts);
});

test('ordinary UDP status preserves score while leaving all numeric rows unclassified',()=>{
  const result=parseStatusPacket(rawPacket());
  assert.deepEqual(result.players.map(p=>p.spectator),[null,null,null]);
  assert.deepEqual(result.players.map(p=>p.score),[0,17,-9999]);
  assert.deepEqual(normalize(result.players).counts,{clients:3,players:0,spectators:0,unknown:3});
});

test('spectator-only and missing-role rosters have labelled, independent totals in both languages',()=>{
  const spectators=[{name:'A',spectator:true,score:4},{name:'B',spectator:true,score:0}];
  assert.deepEqual(rosterCounts(spectators),{clients:2,players:0,spectators:2,unknown:0});
  assert.match(rosterCountsHTML(spectators,'ru'),/Игроки: <b>0<\/b>/);
  assert.match(rosterCountsHTML(spectators,'en'),/Spectators: <b>2<\/b>/);
  assert.ok(!rosterCountsHTML(spectators,'en').includes('unknown'));
  const unknown=[{name:'A',score:0},{name:'B',score:null,spectator:null}];
  assert.match(rosterCountsHTML(unknown,'en'),/Role unknown: <b>2<\/b>/);
  assert.deepEqual(rosterCounts([]),{clients:0,players:0,spectators:0,unknown:0});
});

test('spectators and role changes do not generate misleading score trends',()=>{
  const previous=normalize([{name:'A',score:10,spectator:true},{name:'B',score:0,spectator:false},{name:'C',score:1,spectator:null}]);
  const next=normalize([{name:'A',score:11,spectator:true},{name:'B',score:2,spectator:false},{name:'C',score:4,spectator:false}]);
  assert.deepEqual([...scoreChanges(previous,next)],[['B',2]]);
  assert.equal(scoreChanges(previous,{...next,address:'other.example:27910'}).size,0);
});

test('authenticated collector -> API keeps mixed, spectator-only, unknown and zero-score players isolated by server',async()=>{
  const udp=dgram.createSocket('udp4');udp.bind(0,'127.0.0.1');await once(udp,'listening');
  udp.on('message',(packet,peer)=>udp.send(rawPacket(),peer.port,peer.address));
  const token='roles-local-fixture-'.repeat(3),app=express();let at=Date.now();
  const monitor=normalize([{name:'Monitor unknown',score:0}]);
  const bind=await attachOnline(app,'/botstats',{servers:[
    {id:'monitor',name:'Monitor fixture',address,access:'lan',transport:'monitor'},
    {id:'report',name:'Reporter fixture',address:'127.0.0.1:'+udp.address().port,access:'lan',transport:'report',sourceToken:token}
  ]},{now:()=>at,modeRead:async()=>({hardcore:0,training:0}),fetchImpl:async()=>new Response(JSON.stringify({servers:[{server:address,lastUpdated:new Date(at).toISOString(),serverInfo:monitor.info,serverPlayers:[{name:'Monitor unknown',score:0}]}]}))});
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const close=bind(server);
  const base='http://127.0.0.1:'+server.address().port+'/botstats';
  const config={serverId:'report',ingestToken:token,apiUrl:base,status:{address:'127.0.0.1:'+udp.address().port}};
  const get=async id=>(await(await fetch(base+'/api/online?serverId='+id)).json()).server;
  try{
    await reportStatus(config,{now:()=>at,readModes:async()=>({hardcore:null,training:null})});
    assert.deepEqual((await get('report')).counts,{clients:3,players:0,spectators:0,unknown:3});
    const cases=[
      {players:[{name:'Zero',score:0,ping:8,spectator:false},{name:'Viewer',score:5,ping:8,spectator:true},{name:'Unknown',score:19,ping:0}],counts:{clients:3,players:1,spectators:1,unknown:1}},
      {players:[{name:'Viewer',score:0,ping:8,spectator:true}],counts:{clients:1,players:0,spectators:1,unknown:0}},
      {players:[{name:'Zero',score:0,ping:8,spectator:false}],counts:{clients:1,players:1,spectators:0,unknown:0}},
      {players:[{name:'Null',score:null,ping:null}],counts:{clients:1,players:0,spectators:0,unknown:1}}
    ];
    for(const sample of cases){
      at+=1000;
      await reportStatus(config,{now:()=>at,query:async()=>({state:'online',info:{mapname:'omf'},players:sample.players}),readModes:async()=>({hardcore:1,training:0})});
      const [reported,monitored]=await Promise.all([get('report'),get('monitor')]);
      assert.deepEqual(reported.counts,sample.counts);
      assert.deepEqual(monitored.counts,{clients:1,players:0,spectators:0,unknown:1});
      assert.equal(monitored.players[0].name,'Monitor unknown');
      assert.deepEqual(rosterCounts(reported.players),reported.counts);
    }
    const invalid={schemaVersion:1,serverId:'report',observedAt:new Date(++at).toISOString(),state:'online',info:{mapname:'omf'},players:[{name:'Fake role',score:0,ping:0,spectator:'false'}],modes:{hardcore:0,training:0}};
    const r=await fetch(base+'/api/ingest/status',{method:'POST',headers:{'content-type':'application/json','x-botstats-server':'report','x-ingest-token':token},body:JSON.stringify(invalid)});
    assert.equal(r.status,400);
    assert.deepEqual((await get('report')).counts,cases.at(-1).counts);
  }finally{close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>udp.close(r))]);}
});

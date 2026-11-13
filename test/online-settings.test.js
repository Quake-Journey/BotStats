import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import express from 'express';
import {once} from 'node:events';
import {attachOnline} from '../src/online.js';
import {reportStatus} from '../src/importer-status.js';

test('public settings survive real UDP, authenticated importer report and online API without leaking private cvars', async () => {
  const settings={sv_allow_timers:'1',sv_donation_address:'https://boosty.to/quakejourney',sv_stats_info:'https://q2pro-x.com/botstats/',otx_bot_pa:'1',sv_hardcore:'0',sv_bots_training_mode:'1'};
  const udp=dgram.createSocket('udp4');
  udp.bind(0,'127.0.0.1');await once(udp,'listening');
  const advertised={mapname:'q2duel5',sv_public_address:'para.asuscomm.com:27910',...settings,rcon_password:'private-rcon-sentinel',ingestToken:'private-ingest-sentinel',operator_note:'private-note-sentinel'};
  udp.on('message',(packet,peer)=>{
    assert.equal(packet.toString('latin1'),'\xff\xff\xff\xffstatus\n');
    udp.send(Buffer.from('\xff\xff\xff\xffprint\n'+Object.entries(advertised).map(([k,v])=>'\\'+k+'\\'+v).join('')+'\n','latin1'),peer.port,peer.address);
  });
  const address='127.0.0.1:'+udp.address().port,token='fixture-settings-source-'.repeat(3),app=express();
  const bind=await attachOnline(app,'/botstats',{servers:[{id:'minipc',name:'MINIPC',address,access:'lan',transport:'report',sourceToken:token}]});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const close=bind(server),base='http://127.0.0.1:'+server.address().port+'/botstats';
  try {
    assert.equal(await reportStatus({serverId:'minipc',ingestToken:token,apiUrl:base,status:{address}},{readModes:async()=>({hardcore:0,training:1}),readRoster:async()=>null}),'online');
    const response=await fetch(base+'/api/online/servers'),raw=await response.text(),entry=JSON.parse(raw).servers[0];
    assert.equal(entry.state,'online');assert.ok(entry.receivedAt);
    for(const [key,value] of Object.entries(settings))assert.equal(entry.server.info[key],value,key);
    assert.equal(entry.address,'para.asuscomm.com:27910');
    assert.equal(entry.modes.hardcore,0);assert.equal(entry.modes.training,1);
    for(const secret of [token,'private-rcon-sentinel','private-ingest-sentinel','private-note-sentinel'])assert.ok(!raw.includes(secret));
    delete advertised.otx_bot_pa;
    await reportStatus({serverId:'minipc',ingestToken:token,apiUrl:base,status:{address}},{readModes:async()=>({hardcore:0,training:1}),readRoster:async()=>null});
    const next=await(await fetch(base+'/api/online/servers')).json();
    assert.equal(next.servers[0].server.info.otx_bot_pa,undefined,'Missing server flags must not be invented or retained from an old report');
  } finally {
    close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>udp.close(r))]);
  }
});

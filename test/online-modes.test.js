import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {parseLiveModes,readLiveModes,createModeMonitor} from '../src/online-modes.js';
import {liveModesHTML} from '../public/online-ui.js';

test('live modes use effective match values, never configured defaults or overrides alone',()=>{
  assert.deepEqual(parseLiveModes('OTX_HARDCORE configured=0 effective=1 override=1\nOTX_TRAINING configured=1 effective=0 override=0\n'),{hardcore:1,training:0});
  assert.deepEqual(parseLiveModes('"sv_hardcore" is "1"\nOTX_TRAINING configured=1 override=-1\n'),{hardcore:null,training:null});
  assert.deepEqual(parseLiveModes('OTX_HARDCORE configured=0 effective=10 override=-1\n'),{hardcore:null,training:null});
});
test('mode polling refreshes after match changes and never calls an old state current on failure',async()=>{
  let at=0,calls=0,modes={hardcore:1,training:0};
  const monitor=createModeMonitor({},{now:()=>at,read:async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(modes===null)throw Error('private response');return modes;}});
  const first=await Promise.all(Array.from({length:10},()=>monitor()));assert.equal(calls,1);assert.equal(first[0].hardcore,1);
  at+=1100;modes={hardcore:0,training:1};const next=await monitor();assert.equal(next.hardcore,0);assert.equal(next.training,1);assert.equal(next.state,'current');
  at+=1100;modes=null;const failed=await monitor();assert.equal(failed.hardcore,null);assert.equal(failed.training,null);assert.equal(failed.state,'unavailable');assert.ok(!JSON.stringify(failed).includes('private'));
  at+=1100;modes={hardcore:1,training:1};assert.equal((await monitor()).state,'current');
});
test('RCON can only read the fixed livestatus command and collects split print packets',async()=>{
  const socket=dgram.createSocket('udp4');await new Promise(r=>socket.bind(0,'127.0.0.1',r));
  let requests=0;
  socket.on('message',(packet,peer)=>{
    requests++;assert.equal(packet.toString('latin1'),'\xff\xff\xff\xffrcon "test-only" sv otx livestatus\n');
    socket.send(Buffer.from('\xff\xff\xff\xffprint\nOTX_HARDCORE configured=0 effective=1 override=1\n','latin1'),peer.port,peer.address);
    socket.send(Buffer.from('\xff\xff\xff\xffprint\nOTX_TRAINING configured=1 effective=0 override=0\n','latin1'),peer.port,peer.address);
  });
  const config={server:'127.0.0.1:'+socket.address().port,rconPassword:'test-only'};
  try{
    assert.deepEqual(await readLiveModes(config),{hardcore:1,training:0});
    assert.deepEqual(await readLiveModes({...config,rconPassword:''}),{hardcore:null,training:null});
    assert.deepEqual(await readLiveModes({...config,rconPassword:'bad";map q2dm1'}),{hardcore:null,training:null});
    assert.equal(requests,1);
  }finally{await new Promise(r=>socket.close(r));}
});
test('live mode UI distinguishes off from missing and supports Russian and English',()=>{
  const modes={hardcore:1,training:0,state:'current',checkedAt:'2026-10-28T10:00:00Z'};
  assert.match(liveModesHTML(modes,'ru'),/Hardcore<\/span><strong>Вкл/);
  assert.match(liveModesHTML(modes,'en'),/Training<\/span><strong>Off/);
  assert.match(liveModesHTML(null,'ru'),/Нет данных/);
  assert.ok(!liveModesHTML(null,'ru').includes('<strong>Выкл</strong>'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {openStore} from '../src/store.js';
import {activateProgressSet,PROGRESS_SET_ID,PROGRESS_DEFINITIONS} from '../src/progress-achievements.js';
import {progressSeries} from './support/progress-fixtures.js';

test('Mongo activation survives concurrent initialization and reopen; catalog refreshes on qualifying save',{
  skip:process.env.BOTSTATS_TEST_MONGO!=='1'
},async()=>{
  const config={mongoUri:'mongodb://127.0.0.1:27017',database:'q2pro_botstats_test_progress_20261114'};
  const client=new MongoClient(config.mongoUri);await client.connect();let store;
  try{
    const sets=client.db(config.database).collection('achievement_sets');
    const dates=await Promise.all(Array.from({length:5},()=>activateProgressSet(sets)));
    assert.equal(new Set(dates).size,1);
    const d=PROGRESS_DEFINITIONS[0],rows=progressSeries(d);
    rows.forEach((m,i)=>m.startedAt=new Date(Date.parse(dates[0])+86400000+i*1200000).toISOString());
    const manifest={schemaVersion:1,parserVersion:'0.1.0',demo:{sha256:'f'.repeat(64),size:6,originalName:'progress-test.mvd2'},matches:rows.slice(0,-1)};
    store=await openStore(config);await store.save(manifest);
    assert.equal((await store.achievements()).items.some(a=>a.id===d.id),false);
    await store.save({...manifest,matches:rows});
    assert.ok((await store.achievements()).items.some(a=>a.id===d.id));
    const proof=await store.achievement(d.id,{player:'Пример игрока'});assert.equal(proof.evidence.total,100);
    await store.close();store=await openStore(config);
    assert.ok((await store.achievements()).items.some(a=>a.id===d.id));
    assert.equal((await sets.findOne({_id:PROGRESS_SET_ID})).activatedAt,dates[0]);
  }finally{await store?.close();await client.close();}
});

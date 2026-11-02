import test from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../src/server.js';
import {buildChart,chartTypes} from '../src/charts.js';
import {game} from './support/achievement-fixtures.js';
import {testPath} from './support/paths.js';

test('chart API uses filtered projections, exact paginated selections and invalidates cache on import',async()=>{
  const {app,store}=await createService({mongoUri:'mongodb://127.0.0.1:27017',database:'q2pro_botstats_charts_test',storageDir:testPath('charts-api'),basePath:'/botstats',ingestToken:'charts-test-only-'.repeat(4)});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/botstats/api`;
  const human='Chart API tester',sha='a'.repeat(64);
  const rows=Array.from({length:45},(_,i)=>game(i,{human,map:'q2duel5'}));
  rows.push(game(45,{human,hs:0,bs:20}),game(46,{human,status:'interrupted',hs:50,bs:0}),game(47,{human:'Other chart player',map:'q3t2'}));
  rows.forEach((m,i)=>m.id=sha+'-0-'+i);
  const manifest={schemaVersion:1,parserVersion:'0.2.0',demo:{sha256:sha,size:1,originalName:'chart-test.mvd2'},matches:rows};
  try{
    await store.save(manifest);
    const home=await store.home({q:human});assert.equal(home.matches,47);assert.equal(home.humanWins,45);assert.equal(home.botWins,2);
    assert.strictEqual(await store.home({q:human}),home,'Home count cache reused');
    assert.deepEqual(await (await fetch(base+'/home?q='+encodeURIComponent(human))).json(),home);
    const q={q:human,map:'q2duel5'},query=new URLSearchParams(q),filtered=rows.slice(0,47);
    for(const type of chartTypes){
      const res=await fetch(base+'/charts/'+type+'?'+query);assert.equal(res.status,200);
      assert.deepEqual(await res.json(),buildChart(filtered,type,q),type+' agrees after MongoDB projection');
    }
    const cached=await store.chart('duration',q);assert.strictEqual(await store.chart('duration',q),cached,'Identical aggregate reused');
    const selection=page=>fetch(base+'/chart-matches/duration?'+query+'&bucket=minute10&chartOutcome=human&chartPage='+page).then(r=>r.json());
    const a=await selection(1),b=await selection(2),c=await selection(3);
    assert.equal(a.total,45);assert.equal(a.pages,3);assert.equal(a.items.length,20);assert.equal(b.items.length,20);assert.equal(c.items.length,5);
    assert.equal(new Set([...a.items,...b.items,...c.items].map(m=>m.id)).size,45);
    assert.equal(a.items[0].recordedSettings,undefined);
    const bot=await store.chartMatches('duration',{...q,bucket:'minute10',chartOutcome:'bot'}),forfeit=await store.chartMatches('duration',{...q,bucket:'minute10',chartOutcome:'forfeit'});
    assert.equal(bot.total,1);assert.equal(forfeit.total,1);assert.notEqual(bot.items[0].id,forfeit.items[0].id);
    manifest.matches=rows.slice(0,1);await store.save(manifest);
    assert.equal((await store.home({q:human})).matches,1,'New import invalidates home counts too');
    assert.equal((await store.chart('duration',q)).totals.matches,1,'Fresh import invalidates old aggregate');
    assert.equal((await selection(1)).total,1,'Selection invalidated with aggregate');
    assert.equal((await fetch(base+'/charts/not-real')).status,400);
  }finally{await new Promise(r=>server.close(r));await store.close();}
});

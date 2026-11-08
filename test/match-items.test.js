import test from 'node:test';
import assert from 'node:assert/strict';
import {pickupGroups,itemPickups,comparisonBar,participantColor} from '../public/match-items.js';
const game=(a,b)=>({statsFormat:'extended',participants:[{name:'Bot-X[200]',isBot:true,stats:a},{name:'Player',isBot:false,stats:b}]});
test('pickups and map control render once, grouped by item type without summing their counts',()=>{
  const a={pickups:[{name:'Rockets',count:14},{name:'Combat Armor',count:11},{name:'Railgun',count:8},{name:'Health 25',count:3},{name:'Grenades',count:16}],control:[{name:'Mega Health',pickups:0},{name:'Combat Armor',pickups:11}]};
  const b={pickups:[{name:'Mega Health',count:13},{name:'Combat Armor',count:22}],control:[{name:'Mega Health',pickups:13},{name:'Combat Armor',pickups:22}]};
  const m=game(a,b),groups=pickupGroups(m);
  assert.deepEqual(groups.map(g=>g.id),['armor','health','weapons','ammo']);
  assert.deepEqual(groups.find(g=>g.id==='health').items.find(x=>x.name==='Mega Health').counts,[0,13]);
  assert.deepEqual(groups.find(g=>g.id==='ammo').items.map(x=>x.name),['Grenades','Rockets']);
  const html=itemPickups(m,{expanded:true});
  assert.equal((html.match(/data-item="Mega Health"/g)||[]).length,1);
  assert.equal((html.match(/data-item="Combat Armor"/g)||[]).length,1);
  assert.ok(!html.includes('pickup-map-counts'),'Equal counters need no duplicate line');
});
test('aliases across participants use one row; duplicate aliases do not double the value',()=>{
  const m=game({pickups:[{name:'MegaHealth',count:13},{name:'Mega Health',count:13},{name:'R.Launch',count:4}]},
    {pickups:[{name:'Mega Health',count:3},{name:'Rocket Launcher',count:6}]});
  const rows=pickupGroups(m).flatMap(g=>g.items);
  assert.equal(rows.length,2);assert.deepEqual(rows[0].counts,[13,3]);assert.deepEqual(rows[1].counts,[4,6]);
});
test('different map and total pickups are retained in the same row',()=>{
  const m=game({pickups:[{name:'Rocket Launcher',count:7}],control:[{name:'R.Launch',pickups:5}]},
    {pickups:[{name:'Rocket Launcher',count:13}],control:[{name:'Rocket Launcher',pickups:9}]});
  const row=pickupGroups(m)[0].items[0];assert.deepEqual(row.counts,[7,13]);assert.deepEqual(row.mapCounts,[5,9]);
  const html=itemPickups(m);assert.equal((html.match(/data-item="Rocket Launcher"/g)||[]).length,1);assert.ok(html.includes('Из них с карты'));
});
test('legacy and missing statistics retain unknown counts, extended sparse pickups have real zeroes',()=>{
  const m=game({format:'legacy',pickups:[],control:[{name:'MegaHealth',pickups:4}]},null);
  assert.deepEqual(pickupGroups(m)[0].items[0].counts,[4,null]);
  m.participants[1].stats={pickups:[]};assert.deepEqual(pickupGroups(m)[0].items[0].counts,[4,0]);
  m.statsFormat='legacy';assert.deepEqual(pickupGroups(m)[0].items[0].counts,[4,null]);
});
test('unknown pickups remain visible and escaped; all requested groups have English headings',()=>{
  const m=game({pickups:[{name:'Ammo Pack',count:3},{name:'<script>',count:1}]},{pickups:[]});
  const html=itemPickups(m,{lang:'en'});assert.ok(html.includes('Equipment and power-ups'));assert.ok(html.includes('Other items'));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('comparison colors follow participant roles, not participant order; empty counts have no colored share',()=>{
  const p=game(null,null).participants;
  assert.equal(participantColor(p[0]),'var(--duel-bot)');assert.equal(participantColor(p[1]),'var(--duel-human)');
  for(const values of [[0,0],[null,3]]){
    const html=comparisonBar('Mega',...values,p);assert.equal((html.match(/width="0"/g)||[]).length,2);
  }
  const reverse=comparisonBar('Mega',1,2,[...p].reverse());
  assert.ok(reverse.indexOf('fill="var(--duel-human)"')<reverse.indexOf('fill="var(--duel-bot)"'));
});

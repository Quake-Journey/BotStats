import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BOT_DEFINITIONS} from '../src/bot-achievements.js';
import {computeAchievements,publicAchievements,achievementDetail} from '../src/achievements.js';
import {achievementBadges,achievementsPage,achievementPage} from '../public/achievements-ui.js';
import {game} from './support/achievement-fixtures.js';
import {botCollection} from './support/bot-achievement-fixtures.js';
const win=(i,o={})=>game(i,{hs:2,bs:52,...o});
const awards=rows=>computeAchievements(rows).bots.get('David-X')?.awards||new Map();
const has=(rows,id)=>awards(rows).has('bot-'+id);
const series=(n,o={})=>Array.from({length:n},(_,i)=>win(i,o));

test('all 20 bot awards can be earned with evidence and separate assets',async()=>{
 const index=computeAchievements(botCollection()),catalog=publicAchievements(index);
 assert.equal(BOT_DEFINITIONS.length,20);assert.equal(new Set(BOT_DEFINITIONS.map(a=>a.id)).size,20);
 assert.equal(index.bots.get('David-X').awards.size,20);
 assert.equal(catalog.items.filter(a=>a.audience==='bot').length,20);
 for(const a of BOT_DEFINITIONS){
  const detail=achievementDetail(index,a.id,{player:'David-X'});assert.ok(detail.evidence.total>0,a.id);
  assert.ok(detail.holders.every(p=>p.kind==='bot'));
  const svg=await readFile(new URL('../public/'+a.icon,import.meta.url),'utf8');assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|href=|https?:\/\/(?!www.w3.org)/);
 }
 assert.deepEqual(publicAchievements(computeAchievements([])).items,[]);
});
test('Skynet requires +50, 600 full seconds, normal win; never score-only or rounded duration',()=>{
 assert.equal(has([win(0)],'skynet'),true);
 for(const o of [{bs:51},{seconds:599.999},{startObserved:false},{status:'forfeit'},{status:'interrupted'},{winnerIndex:0},{ratingExcluded:'opponent_changed'}])assert.equal(has([win(0,o)],'skynet'),false,JSON.stringify(o));
 const reversed=win(0);reversed.participants.reverse();reversed.winnerIndex=0;assert.equal(has([reversed],'skynet'),true);
});
test('Terminator counts forfeits even when behind, but losses/draws/unknown break the ordered streak',()=>{
 const rows=series(9,{seconds:30});rows.push(win(9,{seconds:1,status:'forfeit',hs:20,bs:0,winnerIndex:1}));
 assert.equal(has(rows,'terminator'),true);assert.equal(has(rows,'artificial-mind'),false);
 assert.equal(has(rows.slice(0,9),'terminator'),false);
 for(const patch of [{winnerIndex:0},{winnerIndex:null},{status:'interrupted'},{ratingExcluded:'opponent_changed'},{startedAt:null}]){
  const r=structuredClone(rows);Object.assign(r[5],patch);r.push(win(10));assert.equal(has(r,'terminator'),false,JSON.stringify(patch));
 }
 assert.equal(has([...rows,...rows],'terminator'),true);assert.equal(awards([...rows,...rows]).get('bot-terminator').evidence.length,10);
});
test('Artificial Mind excludes forfeit; Meat Factory includes only actual +20 technical wins',()=>{
 assert.equal(has(series(10,{seconds:5}),'artificial-mind'),true);
 assert.equal(has([...series(9),win(9,{status:'forfeit'})],'artificial-mind'),false);
 const rows=series(20,{seconds:20,hs:3,bs:23,status:'forfeit',winnerIndex:1});
 assert.equal(has(rows,'meat-factory'),true);
 rows[19].participants[1].score=22;assert.equal(has(rows,'meat-factory'),false);
 rows[19].participants[1].score=23;rows[19].winnerIndex=0;assert.equal(has(rows,'meat-factory'),false);
});
test('missing weapon/pickup values are not zeros; native abbreviated weapons and legacy names both work',()=>{
 const m=botCollection()[0];assert.equal(has([m],'rail-protocol'),true);assert.equal(has([m],'siege-engine'),true);
 m.participants[0].stats.pickups=[];assert.equal(has([m],'rail-protocol'),false);assert.equal(has([m],'armour-foundry'),false);
 m.participants[1].stats.weapons[0].hits=null;assert.equal(has([m],'red-eye'),false);assert.equal(has([m],'perfect-sight'),false);
 m.participants[1].stats.weapons[1].name='Rocket Launcher';assert.equal(has([m],'siege-engine'),true);
 m.statsComplete=false;for(const id of ['red-eye','siege-engine','steel-storm','plasma-core','iron-discipline'])assert.equal(has([m],id),false);
 const r=botCollection()[1];r.participants[0].stats.control=[];assert.equal(has([r],'reactor-lock'),false);
});
test('OT requires 600 regulation seconds, campaigns use distinct maps/humans and duplicate ids count once',()=>{
 const rows=botCollection();for(let i=1;i<=5;i++)rows[i].regulationSeconds=120;
 assert.equal(has(rows,'final-directive'),false);
 assert.equal(has([...series(99),...series(99)],'legion'),false);
 assert.equal(has(series(100),'all-sectors'),false);assert.equal(has(series(100),'hunter-net'),false);
 const m=win(0);m.scoreHistory=[{timeMs:-1,scores:[50,0]}];assert.equal(has([m],'reboot'),false);
});
test('bot identity groups skill variants without mixing a human with the same name or another bot',()=>{
 const rows=series(10,{human:'David-X'});rows[9].participants[1].name='David-X[50]';rows[9].participants[1].skill=50;
 const index=computeAchievements(rows);assert.equal(index.bots.get('David-X').awards.has('bot-artificial-mind'),true);
 assert.equal(index.players.get('David-X').awards.has('bot-artificial-mind'),false);
 rows[9].participants[1].profile='Purri-X';assert.equal(has(rows,'artificial-mind'),false);
 assert.equal(achievementDetail(computeAchievements(rows),'bot-artificial-mind',{player:'David-X'}),null);
});
test('machine badges, kind filters, profile links and evidence use bot ownership',()=>{
 const index=computeAchievements(botCollection()),catalog=publicAchievements(index),link=q=>'href="?'+new URLSearchParams(Object.entries(q).filter(([,v])=>v!=null))+'"';
 assert.equal(achievementBadges(catalog,'David-X',{lang:'en',link}), '');
 const badges=achievementBadges(catalog,'David-X',{lang:'en',link,kind:'bot'});assert.match(badges,/machine-badges/);assert.equal((badges.match(/<img/g)||[]).length,20);
 const options={lang:'ru',link,params:new URLSearchParams('awardKind=bot')};
 const page=achievementsPage(catalog,options);assert.match(page,/Серия машин/);assert.match(page,/kind=bot/);
 const detail=achievementPage(achievementDetail(index,'bot-skynet',{player:'David-X'}),options);assert.match(detail,/machine-award/);assert.match(detail,/Tester/);
});

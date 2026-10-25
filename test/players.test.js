import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMatches,filters} from '../src/store.js';
import {playersPage} from '../public/players-ui.js';
import {createNavigation} from '../public/navigation.js';
import {createService} from '../src/server.js';
import {testPath} from './support/paths.js';

const game=(id,name,status,winnerIndex,startedAt='2026-10-25T12:00:00Z')=>({id,map:'q2duel5',status,winnerIndex,startedAt,durationSeconds:600,
  participants:[{name,isBot:false,score:2},{name:'David-X[200]',profile:'David-X',isBot:true,skill:200,score:4}]});
const rows=[game('a','Winner','completed',0),game('b','Only forfeit','forfeit',1),game('c','No result','interrupted',null),game('d','Loser','completed',1)];

test('player directory includes every human, has its own sortable table and never inherits ranking mode',()=>{
  const summary=aggregateMatches(rows),params=new URLSearchParams('view=players&ranking=maps&theme=dark&lang=ru&sort_players=name&dir_players=asc');
  const {link}=createNavigation({base:'/botstats',params,getPreferences:()=>({lang:'ru',theme:'dark'})});
  const html=playersPage(summary,{lang:'ru',params,link,badges:p=>`<span data-award="${p.name}"></span>`});
  assert.ok(html.includes('data-table="players"'));assert.ok(!html.includes('ranking-choices'));assert.ok(!html.includes('class="rank"'));
  for(const name of ['Winner','Only forfeit','No result','Loser'])assert.ok(html.includes(name));
  assert.ok(!html.includes('David-X'));assert.equal((html.match(/data-sort-table="players"/g)||[]).length,8);
  assert.ok(html.indexOf('>Loser</a>')<html.indexOf('>Winner</a>'));
  assert.ok(html.includes('match=d'));assert.ok(html.includes('profile=Loser'));assert.ok(html.includes('theme=dark'));
});

test('latest game date and link remain paired across ordering, filters, forfeits and unknown dates',()=>{
  const old=game('old','q','completed',0,'2026-10-23T12:00:00Z'),last=game('last','q','forfeit',1),tie=game('zzz','q','interrupted',null),unknown=game('unknown','q','completed',0,null);
  const get=r=>aggregateMatches(r).players.find(p=>!p.isBot);
  for(const order of [[old,last,tie,unknown],[unknown,tie,last,old]]){const p=get(order);assert.equal(p.lastGameMatchId,'zzz');assert.equal(p.lastGameAt,'2026-10-25T12:00:00.000Z');}
  assert.equal(get([old]).lastGameMatchId,'old');assert.equal(get([unknown]).lastGameMatchId,null);
});

test('player search stays human-only and preserves bot, identity and date constraints',()=>{
  const q=filters({q:'David[',playerSearch:'1',bot:'David-X',identity:'David[',kind:'human',from:'2026-10-25'});
  assert.ok(q.$and.some(c=>c.participants?.$elemMatch?.isBot===false&&c.participants.$elemMatch.name?.$regex==='David\\['));
  assert.ok(q.$and.some(c=>c.participants?.$elemMatch?.profile==='David-X'));
  assert.ok(q.startedAt);assert.ok(!filters({q:'David'}).$and);
});

test('directory escapes nicknames and retains an explicit empty state in RU/EN',()=>{
  for(const lang of ['ru','en']){
    const params=new URLSearchParams(),{link}=createNavigation({base:'/botstats',params,getPreferences:()=>({lang,theme:'auto'})});
    const options={lang,params,link,badges:()=>''};
    const html=playersPage(aggregateMatches([game('a','<script>x</script>','forfeit',1)]),options);
    assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(playersPage(aggregateMatches([]),options).includes('class="empty"'));
  }
});

test('actual summary API supplies latest match IDs and searches human names independently of bot filter',async()=>{
  const config={database:'q2pro_botstats_players_test',mongoUri:'mongodb://127.0.0.1:27017/?directConnection=true',ingestToken:'players-test-only-'.repeat(4),storageDir:testPath('players-api'),basePath:'/botstats'};
  const {app,store}=await createService(config),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{
    await store.save({demo:{sha256:'c'.repeat(64)},parserVersion:'0.1.6',matches:rows});
    const get=async q=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/botstats/api/summary?`+q);assert.equal(r.status,200);return r.json();};
    const s=await get('playerSearch=1');assert.equal(s.players.filter(p=>!p.isBot).length,4);assert.equal(s.players.find(p=>p.name==='Only forfeit').lastGameMatchId,'b');
    assert.equal((await get('q=David&playerSearch=1')).matches,0,'Bot names cannot match a human name search');
    assert.equal((await get('q=Only&playerSearch=1&bot=David-X')).players.find(p=>!p.isBot).lastGameMatchId,'b');
    assert.equal((await get('q=David')).matches,4,'Other views retain general search');
    assert.equal((await get('map=q3t2')).matches,0);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
});

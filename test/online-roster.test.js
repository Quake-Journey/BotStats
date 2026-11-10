import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {once} from 'node:events';
import {parseClientStatus,parseClientTeams,readLiveRoster,applyLiveRoles} from '../src/online-roster.js';
import {onlineConfig,createServerDirectory} from '../src/servers.js';
import {reportStatus} from '../src/importer-status.js';

const clients=[{slot:0,name:'Human Name',team:1},{slot:2,name:'Bot-X[200]',team:2},{slot:3,name:'Viewer',team:0}];
const engine=(rows=clients,map='q2duel5')=>`Current map: ${map}\n\nnum score ping name            lastmsg address                rate pr fps\n--- ----- ---- --------------- ------- --------------------- ----- -- ---\n`+rows.map(c=>`${String(c.slot).padStart(3)} ${String(c.score??0).padStart(5)} ${String(c.ping??10).padStart(4)} ${c.name.padEnd(15).slice(0,15)}      50 198.51.100.99:12345     25000 35  100\n`).join('');
const teams=(rows=clients)=>'OTX_INTERMISSION_STATE frame=900 status=3 score_end=0 current=2 old=0 old_score=0,0 camera=0.0,0.0,0.0\n'+rows.map(c=>`OTX_INTERMISSION_CLIENT slot=${c.slot+1} bot=${c.slot===2?1:0} team=${c.team} pm_type=${c.dead?3:0} origin=0.0,0.0,-10.0\n`).join('');
const players=()=>clients.map(c=>({name:c.name,score:0,ping:10,spectator:null}));
async function fixture(responses,fn){
 const udp=dgram.createSocket('udp4');udp.bind(0,'127.0.0.1');await once(udp,'listening');const requests=[];
 udp.on('message',(packet,peer)=>{const m=/^\xff\xff\xff\xffrcon "fixture" (status|sv otx intermission)\n$/.exec(packet.toString('latin1'));assert.ok(m,'Only fixed read-only commands');requests.push(m[1]);const reply=responses(m[1],requests.length);if(reply===null)return;for(const chunk of Array.isArray(reply)?reply:[reply])udp.send(Buffer.from('\xff\xff\xff\xffprint\n'+chunk,'latin1'),peer.port,peer.address);});
 try{return await fn({server:'127.0.0.1:'+udp.address().port,rconPassword:'fixture'},requests);}finally{await new Promise(r=>udp.close(r));}
}
const short={timeoutMs:100,quietMs:5};

test('roster parses actual slot bases and explicit teams, never health, movement or score; private fields discarded',()=>{
 assert.deepEqual(parseClientStatus(engine()).clients,clients.map(c=>({slot:c.slot,name:c.name,spawned:true})));
 assert.deepEqual(parseClientTeams(teams([{...clients[0],dead:true},...clients.slice(1)])),[{slot:0,spectator:false},{slot:2,spectator:false},{slot:3,spectator:true}]);
 assert.ok(!JSON.stringify(parseClientStatus(engine())).includes('198.51.100.99'));
 assert.equal(parseClientStatus('Bad rcon_password.\n'),null);assert.equal(parseClientTeams('Unknown command'),null);
 assert.equal(parseClientTeams(teams([{...clients[0],team:9}])),null);
 assert.equal(parseClientTeams(teams([clients[0],clients[0]])),null);
 assert.equal(parseClientStatus(engine([clients[0],clients[0]])),null);
});
test('real RCON bracket maps playing and spectator clients and updates after moving into spectators',async()=>{
 let rows=clients;
 await fixture(cmd=>cmd==='status'?engine():[teams(rows).split('OTX_INTERMISSION_CLIENT')[0],teams(rows).slice(teams(rows).indexOf('OTX_INTERMISSION_CLIENT'))],async(config,requests)=>{
  const a=await readLiveRoster(config,short);assert.deepEqual(applyLiveRoles(players(),'q2duel5',a).map(p=>p.spectator),[false,false,true]);
  rows=clients.map(c=>({...c,team:c.slot===3?1:0}));const b=await readLiveRoster(config,short);
  assert.deepEqual(applyLiveRoles(players(),'q2duel5',b).map(p=>p.spectator),[true,true,false]);
  assert.deepEqual(requests,['status','sv otx intermission','status','status','sv otx intermission','status']);
 });
});
test('missing role rows never mark an unobserved client as spectator; missing response and unsupported commands are unknown',async()=>{
 await fixture(cmd=>cmd==='status'?engine():teams([clients[1]]),async config=>assert.deepEqual(applyLiveRoles(players(),'q2duel5',await readLiveRoster(config,short)).map(p=>p.spectator),[null,false,null]));
 for(const response of [null,'Unknown command\n','Bad rcon_password.\n'])await fixture(cmd=>cmd==='status'?engine():response,async config=>assert.equal(await readLiveRoster(config,short),null));
 assert.equal(await readLiveRoster({server:'example:27910',rconPassword:''},short),null);
 assert.equal(await readLiveRoster({server:'example:27910',rconPassword:'bad";quit'},short),null);
});
test('map changes, reused slots, connecting clients and ambiguous names do not inherit another role',async()=>{
 await fixture((cmd,n)=>cmd==='status'?engine(clients,n===3?'omf':'q2duel5'):teams(),async config=>assert.equal(await readLiveRoster(config,short),null));
 await fixture((cmd,n)=>cmd==='status'?engine(n===3?[{...clients[0],name:'Replacement'},...clients.slice(1)]:clients):teams(),async config=>assert.equal(applyLiveRoles(players(),'q2duel5',await readLiveRoster(config,short))[0].spectator,null));
 await fixture(cmd=>cmd==='status'?engine([{...clients[0],ping:'CNCT'},...clients.slice(1)]):teams(),async config=>assert.equal(applyLiveRoles(players(),'q2duel5',await readLiveRoster(config,short))[0].spectator,null));
 const duplicates=[{name:'123456789012345a',spectator:null},{name:'123456789012345b',spectator:null}],roster={map:'q2duel5',clients:[{name:'123456789012345',spectator:false}]};
 assert.deepEqual(applyLiveRoles(duplicates,'q2duel5',roster),duplicates);
 assert.deepEqual(applyLiveRoles(players(),'omf',{map:'q2duel5',clients:[{name:'Human Name',spectator:false}]}),players());
});
test('monitor merges current roles, does not cache old roles after a failure and isolates servers',async()=>{
 let roster={map:'q2duel5',clients:clients.map(c=>({name:c.name,spectator:c.team===0}))};
 const config=await onlineConfig({servers:[{id:'a',name:'A',address:'a.example:27910',access:'public',transport:'monitor'},{id:'b',name:'B',address:'b.example:27910',access:'public',transport:'monitor'}]});
 const directory=createServerDirectory(config,{pollMs:15,modeRead:async()=>({hardcore:1,training:0}),rosterRead:async c=>c.id==='a'?roster:null,fetchImpl:async()=>new Response(JSON.stringify({servers:config.servers.map(c=>({server:c.address,lastUpdated:new Date().toISOString(),serverInfo:{mapname:'q2duel5'},serverPlayers:players()}))}))});
 try{
  await Promise.all(config.servers.map(c=>directory.ready(c.id)));assert.deepEqual(directory.read('a').server.counts,{clients:3,players:2,spectators:1,unknown:0});assert.equal(directory.read('b').server.counts.unknown,3);
  roster=null;await new Promise(r=>setTimeout(r,35));await directory.ready('a');assert.equal(directory.read('a').server.counts.unknown,3);
  roster={map:'q2duel5',clients:clients.map(c=>({name:c.name,spectator:true}))};await new Promise(r=>setTimeout(r,35));await directory.ready('a');assert.equal(directory.read('a').server.counts.spectators,3);
 }finally{directory.close();}
});
test('importer transmits only role booleans through the existing report contract and preserves modes',async()=>{
 let sent;
 await reportStatus({serverId:'minipc',ingestToken:'fixture-secret',apiUrl:'http://127.0.0.1:1/botstats',status:{address:'127.0.0.1:27910'}},{query:async()=>({state:'online',info:{mapname:'q2duel5'},players:players()}),readModes:async()=>({hardcore:0,training:1}),readRoster:async()=>({map:'q2duel5',clients:clients.map(c=>({name:c.name,spectator:c.team===0}))}),fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);return new Response('{}');}});
 assert.deepEqual(sent.players.map(p=>p.spectator),[false,false,true]);assert.deepEqual(sent.modes,{hardcore:0,training:1});assert.ok(!JSON.stringify(sent).includes('fixture-secret'));assert.ok(!JSON.stringify(sent).includes('slot'));
});

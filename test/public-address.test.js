import test from 'node:test';
import assert from 'node:assert/strict';
import {onlineConfig,createServerDirectory} from '../src/servers.js';
import {parseStatusPacket,reportStatus} from '../src/importer-status.js';

const internal='10.10.1.51:27910',external='para.asuscomm.com:27910';
const spec=(id,extra={})=>({id,name:id,address:internal,access:'lan',transport:'report',sourceToken:('fixture-'+id+'-').repeat(8),...extra});
const report=(id,at,info={mapname:'omf'})=>({schemaVersion:1,serverId:id,observedAt:new Date(at).toISOString(),state:'online',info,players:[],modes:{hardcore:0,training:1}});

test('reporter forwards a valid advertised address and still polls internal UDP/RCON targets',async()=>{
  const packet=value=>Buffer.from('\xff\xff\xff\xffprint\n\\mapname\\omf\\sv_public_address\\'+value+'\\rcon_password\\private\n','latin1');
  for(const value of ['',external,'https://example.com:27910','host:99999','host:0','host:27910;quit','host:27910"']){
    const data=parseStatusPacket(packet(value));assert.equal(data.info.sv_public_address,value===external?external:undefined);assert.equal(data.info.rcon_password,undefined);
  }
  const targets=[];let sent;
  await reportStatus({serverId:'minipc',ingestToken:'fixture-token-'.repeat(4),apiUrl:'https://example.com/botstats',status:{address:internal,rconPassword:'fixture-only'}},{
    query:async address=>{targets.push(address);return {state:'online',...parseStatusPacket(packet(external))};},
    readModes:async config=>{targets.push(config.server);return {hardcore:0,training:1};},
    fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return new Response('{}');}
  });
  assert.deepEqual(targets,[internal,internal]);assert.equal(sent.info.sv_public_address,external);assert.equal(sent.serverId,'minipc');assert.ok(!JSON.stringify(sent).includes('fixture-only'));
});

test('advertised endpoint resolves per source, survives stale/offline and falls back on missing or invalid cvar',async()=>{
  let at=Date.now();const config=await onlineConfig({servers:[spec('minipc'),spec('default',{address:'91.227.18.67:27950',access:'public'})]});
  const directory=createServerDirectory(config,{now:()=>at});
  try{
    assert.equal(directory.read('minipc').metadata.address,internal);
    directory.report('minipc',report('minipc',at,{mapname:'omf',sv_public_address:external}));
    let current=directory.read('minipc');assert.equal(current.metadata.address,external);assert.equal(current.server.address,external);assert.equal(current.metadata.access,'public');assert.equal(current.metadata.q2tv,false);
    assert.equal(config.servers[0].server,internal);assert.equal(config.servers[0].address,internal);
    assert.equal(directory.read('default').metadata.address,'91.227.18.67:27950');
    at+=46000;assert.equal(directory.read('minipc').state,'stale');assert.equal(directory.read('minipc').metadata.address,external);
    directory.report('minipc',{...report('minipc',at),state:'offline',info:{},modes:{hardcore:null,training:null}});
    assert.equal(directory.read('minipc').metadata.address,external);
    at++;directory.report('minipc',report('minipc',at));assert.equal(directory.read('minipc').metadata.address,internal);assert.equal(directory.read('minipc').metadata.access,'lan');
    for(const value of ['', 'https://bad.example/', 'bad:0', 'bad:65536', 'bad:27910;quit']){
      at++;directory.report('minipc',report('minipc',at,{mapname:'omf',sv_public_address:value}));assert.equal(directory.read('minipc').metadata.address,internal);
    }
    at++;directory.report('minipc',report('minipc',at,{mapname:'omf',sv_public_address:'new.example:27920'}));assert.equal(directory.read('minipc').metadata.address,'new.example:27920');
  }finally{directory.close();}
});

test('monitor transport resolves advertised metadata without changing monitor/RCON/Q2TV configuration',async()=>{
  const config=await onlineConfig({servers:[spec('default',{address:'91.227.18.67:27950',access:'public',transport:'monitor',q2tv:true})]});let queried;
  const directory=createServerDirectory(config,{modeRead:async c=>{queried=c.server;return {hardcore:1,training:0};},fetchImpl:async()=>new Response(JSON.stringify({servers:[{server:'91.227.18.67:27950',lastUpdated:new Date().toISOString(),serverInfo:{mapname:'omf',sv_public_address:external},serverPlayers:[]}]}))});
  try{
    const result=await directory.ready('default');assert.equal(result.metadata.address,external);assert.equal(result.server.address,external);assert.equal(result.metadata.q2tv,true);assert.equal(queried,'91.227.18.67:27950');assert.equal(config.servers[0].server,'91.227.18.67:27950');
  }finally{directory.close();}
});

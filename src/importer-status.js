import dgram from 'node:dgram';
import {validAddress,safeText} from './servers.js';
import {readLiveModes} from './online-modes.js';

const unknownModes=()=>({hardcore:null,training:null});
// Public Quake II status response, not RCON output. Only public fields cross
// the reporter boundary; arbitrary cvars and credentials are never forwarded.
const infoKeys=new Set(['hostname','sv_hostname','mapname','map','maxclients','max_clients','gamename','game','version','otx_version','mod_version','time_remaining','timelimit','fraglimit','deathmatch','teamplay','gamedir']);
export function parseStatusPacket(packet){
  if(packet.length>65507||packet.length<11||packet.readInt32LE(0)!==-1||packet.toString('ascii',4,10)!=='print\n')throw Error('Invalid game status response');
  const [line,...rows]=packet.toString('latin1',10).replace(/\0+$/,'').split('\n');
  if(!line.startsWith('\\'))throw Error('Invalid game status info');
  const parts=line.slice(1).split('\\'),info={};
  if(parts.length%2)throw Error('Invalid game status fields');
  for(let i=0;i<parts.length;i+=2)if(infoKeys.has(parts[i]))info[parts[i]]=safeText(parts[i+1]);
  if(!info.mapname&&!info.map)throw Error('Missing game status map');
  const players=[];
  for(const row of rows){
    if(!row.trim())continue;
    const match=/^(-?\d+|spectator)\s+(\d+)\s+"(.*)"\s*$/i.exec(row.trim());
    if(!match||players.length>=256)throw Error('Invalid game status player');
    const score=/spectator/i.test(match[1])?null:Number(match[1]),ping=Number(match[2]);
    if(score!==null&&Math.abs(score)>100000||ping>99999)throw Error('Invalid game status values');
    // Ordinary Q2 status rows do not encode player/spectator membership.
    // A zero score must not be interpreted as proof of either role.
    players.push({name:safeText(match[3]).slice(0,128),score,ping,spectator:score===null?true:null});
  }
  return {info,players};
}
export async function queryGameStatus(address,{timeoutMs=1800}={}){
  if(!validAddress(address))throw Error('Invalid status query address');
  return new Promise(resolve=>{
    const socket=dgram.createSocket('udp4');let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);try{socket.close();}catch{}resolve(value);};
    const timer=setTimeout(()=>finish({state:'offline',info:{},players:[]}),timeoutMs);
    socket.on('error',()=>finish({state:'unavailable',info:{},players:[]}));
    socket.on('message',packet=>{try{finish({state:'online',...parseStatusPacket(packet)});}catch{finish({state:'unavailable',info:{},players:[]});}});
    const colon=address.lastIndexOf(':');
    socket.connect(Number(address.slice(colon+1)),address.slice(0,colon),()=>{if(!done)socket.send(Buffer.from('\xff\xff\xff\xffstatus\n','latin1'));});
  });
}
export function importerHeaders(config){
  if(config.serverId!==undefined&&!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(config.serverId))throw Error('Invalid importer serverId');
  return {'x-ingest-token':config.ingestToken,...(config.serverId?{'x-botstats-server':config.serverId}:{})};
}
export function ingestBase(config){
  const base=config.apiUrl.replace(/\/$/,''),url=new URL(base);
  if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.protocol==='http:'))throw Error('Remote ingest requires HTTPS');
  return base;
}
export async function reportStatus(config,{query=queryGameStatus,readModes=readLiveModes,fetchImpl=fetch,now=Date.now}={}){
  if(!config.serverId||!validAddress(config.status?.address))throw Error('Status reporter requires serverId and status.address');
  const headers=importerHeaders(config),base=ingestBase(config);
  const [snapshot,modes]=await Promise.all([query(config.status.address),readModes({server:config.status.address,rconPassword:config.status.rconPassword})]);
  const body={schemaVersion:1,serverId:config.serverId,observedAt:new Date(now()).toISOString(),...snapshot,modes:snapshot.state==='online'?modes:unknownModes()};
  const r=await fetchImpl(base+'/api/ingest/status',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000),redirect:'error'});
  if(!r.ok)throw Error('Status report HTTP '+r.status);
  await r.body?.cancel();return body.state;
}
export function startStatusReporter(config,{report=reportStatus,onError=()=>console.error('Status reporting unavailable')}={}){
  if(!config.status)return ()=>{};
  const seconds=config.status.pollSeconds??10;
  if(!Number.isInteger(seconds)||seconds<5||seconds>30||!config.serverId||!validAddress(config.status.address))throw Error('Invalid status reporter configuration');
  importerHeaders(config);ingestBase(config);
  let stopped=false,timer;
  const run=async()=>{try{await report(config);}catch{onError();}finally{if(!stopped){timer=setTimeout(run,seconds*1000);timer.unref?.();}}};
  run();return ()=>{stopped=true;clearTimeout(timer);};
}

import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {timingSafeEqual} from 'node:crypto';
import {createModeMonitor} from './online-modes.js';
import {readLiveRoster,applyLiveRoles} from './online-roster.js';

export const DEFAULT_SERVER = '91.227.18.67:27950';
export const safeText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300);
const privateKey = /password|passwd|rcon|token|secret|api.?key/i;
export const validAddress = value => typeof value==='string' && /^[a-z0-9.-]+:\d{1,5}$/i.test(value) && Number(value.split(':').at(-1))>0 && Number(value.split(':').at(-1))<=65535;
const idPattern=/^[a-z0-9][a-z0-9_-]{0,47}$/;
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function origin(value) {
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Invalid online service origin');
  return u.origin;
}

export async function onlineConfig(config={}) {
  let env={};
  // The legacy single-server installation keeps its existing named settings.
  // Explicit registries never inherit a different server's RCON credential.
  if(!config.servers)try{env=parseEnv(await readFile(config.tournamentEnv||'C:/nodejs/Tournament/.env','utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Cannot read Tournament environment');}
  const legacy=!config.servers;
  const entries=config.servers||[{id:'default',name:'Q2PRO-X',address:config.server||DEFAULT_SERVER,access:'public',transport:'monitor',q2tv:true,
    rconPassword:config.rconPassword||process.env.BOTSTATS_ONLINE_RCON_PASSWORD||env.BOTSTATS_ONLINE_RCON_PASSWORD||''}];
  if(!Array.isArray(entries)||!entries.length||entries.length>32)throw Error('Configure between 1 and 32 servers');
  const ids=new Set(),tokens=new Set();
  const servers=entries.map(s=>{
    if(!idPattern.test(s.id)||ids.has(s.id))throw Error('Invalid or duplicate server ID');ids.add(s.id);
    if(typeof s.name!=='string'||!s.name.trim()||s.name.length>120||!validAddress(s.address))throw Error('Invalid server metadata');
    if(!['public','lan','private'].includes(s.access)||!['monitor','report'].includes(s.transport))throw Error('Invalid server access or transport');
    if(s.q2tv!==undefined&&typeof s.q2tv!=='boolean')throw Error('Invalid Q2TV setting');
    if(s.sourceToken!==undefined&&(typeof s.sourceToken!=='string'||s.sourceToken.length<32||s.sourceToken.startsWith('REPLACE_')||tokens.has(s.sourceToken)))throw Error('Invalid or duplicate source credential');
    if(s.sourceToken)tokens.add(s.sourceToken);
    if(s.transport==='report'&&!s.sourceToken)throw Error('Status reporter requires a source credential');
    const staleSeconds=s.staleSeconds??(s.transport==='report'?45:120);
    if(!Number.isInteger(staleSeconds)||staleSeconds<15||staleSeconds>300)throw Error('Invalid status freshness limit');
    return {...s,name:safeText(s.name),server:s.address,staleSeconds,legacy,
      monitorOrigin:origin(s.monitorOrigin||config.monitorOrigin||env.SERVERS_API||'http://127.0.0.1:3001'),
      tournamentOrigin:origin(s.tournamentOrigin||config.tournamentOrigin||`http://127.0.0.1:${Number(env.SITE_PORT)||3000}`)};
  });
  const defaultId=config.defaultServerId||servers[0].id;
  if(!ids.has(defaultId))throw Error('Unknown default server ID');
  return {...servers.find(s=>s.id===defaultId),servers,defaultId,pollSeconds:10};
}

// Polling/RCON retain configured targets; Q2TV uses this public endpoint only
// when explicitly enabled for the same authenticated/configured source.
export const publicServer=(s,advertisedAddress)=>{
  const advertised=validAddress(advertisedAddress)?advertisedAddress:null;
  const access=advertised?'public':s.access;
  return {id:s.id,name:s.name,address:advertised||s.address,access,transport:s.transport,q2tv:s.q2tv===true&&access==='public',staleSeconds:s.staleSeconds};
};
export function sourceAuth(servers,legacyToken) {
  if(servers.some(s=>s.sourceToken&&equal(s.sourceToken,legacyToken)))throw Error('Source credential must differ from the legacy ingest credential');
  return (req,res,next)=>{
    const id=req.headers['x-botstats-server'],token=req.headers['x-ingest-token'];
    const server=id===undefined?null:servers.find(s=>s.id===id);
    if(id===undefined? !equal(token,legacyToken):!server?.sourceToken||!equal(token,server.sourceToken))return res.status(401).json({error:'Unauthorized'});
    req.sourceServer=server;next();
  };
}

export function normalizeServer(data,address,now=Date.now(),staleSeconds=120) {
  if(!Array.isArray(data?.servers))throw Error('Invalid monitor response');
  const srv=data.servers.find(s=>s.server===address||`${s.ip}:${s.port}`===address||s.allAddrs?.includes(address));
  if(!srv)return null;
  const info=Object.fromEntries(Object.entries(srv.serverInfo||{}).filter(([k,v])=>!privateKey.test(k)&&['number','string','boolean'].includes(typeof v)).slice(0,100).map(([k,v])=>[safeText(k),safeText(v)]));
  const players=(Array.isArray(srv.serverPlayers)?srv.serverPlayers:[]).slice(0,256).map(p=>{
    const score=typeof p.score==='number'||typeof p.score==='string'&&/^-?\d+$/.test(p.score.trim())?Number(p.score):null;
    const ping=p.ping!==''&&p.ping!=null&&Number.isFinite(Number(p.ping))?Number(p.ping):null;
    // A score (including zero, missing or a sentinel) is not a player role.
    // Preserve explicit roles and the monitor's literal spectator marker only.
    const spectator=typeof p.spectator==='boolean'?p.spectator:
      p.spectator===undefined&&typeof p.score==='string'&&/^spectator$/i.test(p.score.trim())?true:null;
    return {name:safeText(p.name),score:Number.isFinite(score)?score:null,ping,spectator};
  });
  const stamp=Date.parse(srv.lastUpdated),valid=Number.isFinite(stamp)&&stamp<=now+5000;
  const counts={clients:players.length,players:0,spectators:0,unknown:0};
  for(const p of players)counts[p.spectator===true?'spectators':p.spectator===false?'players':'unknown']++;
  return {address,info,players,counts,updatedAt:valid?new Date(stamp).toISOString():null,stale:srv.stale===true||!valid||now-stamp>staleSeconds*1000};
}

async function boundedJSON(response) {
  let size=0;const chunks=[];
  for await(const part of response.body){size+=part.length;if(size>2*1024*1024)throw Error('Monitor response too large');chunks.push(part);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createMonitor(config,{fetchImpl=fetch,now=Date.now,cacheMs=5000}={}) {
  let snapshot=null,lastAttempt=-Infinity,pending;
  return async()=>{
    if(pending)return pending;if(now()-lastAttempt<cacheMs)return snapshot;lastAttempt=now();
    pending=(async()=>{
      try{
        const r=await fetchImpl(config.monitorOrigin+'/api/servers?game=q2&not_empty=0&ignore_bots=0',{signal:AbortSignal.timeout(7000),redirect:'error'});
        if(!r.ok)throw Error('Monitor unavailable');
        const server=normalizeServer(await boundedJSON(r),config.server,now(),config.staleSeconds);
        snapshot={server,state:!server?'missing':server.stale?'stale':'online',checkedAt:new Date(now()).toISOString()};
      }catch{snapshot={server:snapshot?.server?{...snapshot.server,stale:true}:null,state:'unavailable',checkedAt:new Date(now()).toISOString()};}
      finally{pending=null;}return snapshot;
    })();return pending;
  };
}

const noModes=()=>({hardcore:null,training:null,state:'unavailable',checkedAt:null});
const badReport=()=>Object.assign(Error('Invalid status report'),{status:400});
export function createServerDirectory(config,{now=Date.now,fetchImpl=fetch,modeRead,rosterRead=readLiveRoster,pollMs=10000}={}) {
  const entries=new Map();let stopped=false;
  for(const server of config.servers){
    const entry={config:server,publicAddress:null,snapshot:{server:null,state:'missing',checkedAt:null,modes:noModes()},receivedAt:null,pending:null,timer:null};entries.set(server.id,entry);
    if(server.transport==='monitor'){
      const status=createMonitor(server,{now,fetchImpl,cacheMs:0}),modes=createModeMonitor(server,{now,...(modeRead?{read:modeRead}:{}),cacheMs:0});
      const poll=()=>{entry.pending=Promise.all([status(),modes(),Promise.resolve().then(()=>rosterRead(server)).catch(()=>null)]).then(([snapshot,currentModes,roster])=>{
        if(snapshot.state==='online'&&snapshot.server){
          const players=applyLiveRoles(snapshot.server.players,snapshot.server.info.mapname||snapshot.server.info.map,roster);
          const counts={clients:players.length,players:0,spectators:0,unknown:0};for(const p of players)counts[p.spectator===true?'spectators':p.spectator===false?'players':'unknown']++;
          snapshot={...snapshot,server:{...snapshot.server,players,counts}};
        }
        entry.snapshot={...snapshot,modes:currentModes};if(snapshot.state==='online')entry.publicAddress=snapshot.server?.info.sv_public_address;
      }).finally(()=>{entry.pending=null;if(!stopped){entry.timer=setTimeout(poll,pollMs);entry.timer.unref?.();}});};poll();
    }
  }
  function read(id){
    const e=entries.get(id);if(!e)return null;
    let snapshot=e.snapshot;
    const expired=snapshot.checkedAt&&now()-Date.parse(snapshot.checkedAt)>e.config.staleSeconds*1000;
    if(expired)snapshot={...snapshot,state:'stale',server:snapshot.server?{...snapshot.server,stale:true}:null};
    if(snapshot.state!=='online')snapshot={...snapshot,modes:noModes()};
    const metadata=publicServer(e.config,e.publicAddress);
    return {...snapshot,server:snapshot.server?{...snapshot.server,address:metadata.address}:null,metadata,receivedAt:e.receivedAt};
  }
  function report(id,body){
    const e=entries.get(id);
    if(!e||e.config.transport!=='report')throw Object.assign(Error('Status reporting is disabled for this source'),{status:403});
    const keys=['schemaVersion','serverId','observedAt','state','info','players','modes'];
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k))||body.schemaVersion!==1||body.serverId!==id||!['online','offline','unavailable'].includes(body.state))throw badReport();
    const stamp=typeof body.observedAt==='string'?Date.parse(body.observedAt):NaN;
    if(!Number.isFinite(stamp)||stamp>now()+5000||now()-stamp>e.config.staleSeconds*1000)throw badReport();
    if(e.snapshot.checkedAt&&stamp<=Date.parse(e.snapshot.checkedAt))throw Object.assign(Error('Outdated status report'),{status:409});
    if(!body.info||Array.isArray(body.info)||typeof body.info!=='object'||Object.keys(body.info).length>100||Object.entries(body.info).some(([k,v])=>k.length>100||privateKey.test(k)||typeof v!=='string'||v.length>300))throw badReport();
    if(!Array.isArray(body.players)||body.players.length>256||body.players.some(p=>!p||Object.keys(p).some(k=>!['name','score','ping','spectator'].includes(k))||typeof p.name!=='string'||p.name.length>128||!(p.score===null||Number.isInteger(p.score)&&Math.abs(p.score)<=100000)||!(p.ping===null||Number.isInteger(p.ping)&&p.ping>=0&&p.ping<=99999)||!['undefined','boolean'].includes(typeof p.spectator)&&p.spectator!==null))throw badReport();
    if(!body.modes||Object.keys(body.modes).some(k=>!['hardcore','training'].includes(k))||!['hardcore','training'].every(k=>[0,1,null].includes(body.modes[k])))throw badReport();
    if(body.state!=='online'&&(Object.keys(body.info).length||body.players.length||body.modes.hardcore!==null||body.modes.training!==null))throw badReport();
    const checkedAt=new Date(stamp).toISOString();
    const server=body.state==='online'?normalizeServer({servers:[{server:e.config.address,serverInfo:body.info,serverPlayers:body.players.map(p=>({...p,spectator:p.spectator??null})),lastUpdated:checkedAt}]},e.config.address,now(),e.config.staleSeconds):null;
    e.receivedAt=new Date(now()).toISOString();
    e.snapshot={server,state:body.state,checkedAt,modes:{...body.modes,state:body.modes.hardcore!==null&&body.modes.training!==null?'current':'unavailable',checkedAt}};
    // A failed observation must not replace a known public address with the LAN
    // polling address. A successful response without the cvar restores fallback.
    if(body.state==='online')e.publicAddress=body.info.sv_public_address;
    return {accepted:true,serverId:id,receivedAt:e.receivedAt};
  }
  return {read,report,list:()=>config.servers.map(s=>read(s.id)),ready:async id=>{await entries.get(id)?.pending;return read(id);},close:()=>{stopped=true;for(const e of entries.values())clearTimeout(e.timer);}};
}

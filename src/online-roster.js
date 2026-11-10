import dgram from 'node:dgram';

// Existing read-only commands. "sv otx intermission" only prints client state;
// it does not start intermission. Never use the large "sv otx status" dump.
const COMMANDS=new Set(['status','sv otx intermission']);
const validSlot=n=>Number.isInteger(n)&&n>=0&&n<256;
function readText({server,rconPassword},command,{timeoutMs=1200,quietMs=70}={}){
  if(!COMMANDS.has(command)||typeof rconPassword!=='string'||!rconPassword||/["\r\n\x00-\x1f]/.test(rconPassword)||!/^[-a-z0-9.]+:\d{1,5}$/i.test(server||''))return Promise.resolve(null);
  const colon=server.lastIndexOf(':'),port=Number(server.slice(colon+1));if(port<1||port>65535)return Promise.resolve(null);
  return new Promise(resolve=>{
    const socket=dgram.createSocket('udp4');let done=false,text='',quiet;
    const finish=ok=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(quiet);try{socket.close();}catch{}resolve(ok&&text?text:null);};
    const timer=setTimeout(()=>finish(false),timeoutMs);socket.on('error',()=>finish(false));
    socket.on('message',packet=>{
      if(done||packet.length<10||packet.readInt32LE(0)!==-1||packet.toString('ascii',4,10)!=='print\n')return;
      if(text.length+packet.length>65536){finish(false);return;}
      text+=packet.toString('latin1',10).replace(/\0+$/,'');
      clearTimeout(quiet);quiet=setTimeout(()=>finish(true),quietMs);
    });
    socket.connect(port,server.slice(0,colon),()=>{if(!done)socket.send(Buffer.from('\xff\xff\xff\xffrcon "'+rconPassword+'" '+command+'\n','latin1'),e=>{if(e)finish(false);});});
  });
}

export function parseClientStatus(text){
  if(typeof text!=='string')return null;
  const maps=[...text.matchAll(/^Current map: ([^\r\n]+)\r?$/gm)];
  if(maps.length!==1||!/^num score ping name\s+lastmsg address\s+rate pr fps\r?$/m.test(text))return null;
  const clients=[],seen=new Set();
  for(const line of text.split(/\r?\n/)){
    // The engine's fixed 15-byte name column may contain spaces. Addresses,
    // protocol details and other private RCON fields are discarded here.
    const m=/^\s*(\d{1,3})\s+(-?\d+)\s+(\d+|ZMBI|ASGN|CNCT|PRIM|DNLD|HTTP) (.{15})\s+\d+\s+\S+\s+\d+\s+\d+\s+\d+\s*$/.exec(line);
    if(!m)continue;
    const slot=Number(m[1]);if(!validSlot(slot)||seen.has(slot))return null;seen.add(slot);
    const name=m[4].trimEnd();if(!name||/[\x00-\x1f]/.test(name))continue;
    clients.push({slot,name,spawned:/^\d+$/.test(m[3])});
  }
  return {map:maps[0][1].trim(),clients};
}

export function parseClientTeams(text){
  if(typeof text!=='string'||!/^OTX_INTERMISSION_STATE frame=\d+ status=\d+\b/m.test(text))return null;
  const clients=[],seen=new Set();
  for(const line of text.split(/\r?\n/)){
    if(!line.startsWith('OTX_INTERMISSION_CLIENT '))continue;
    const m=/^OTX_INTERMISSION_CLIENT slot=(\d+) bot=([01]) team=([012]) pm_type=\d+ origin=-?[\d.]+,-?[\d.]+,-?[\d.]+\s*$/.exec(line);
    if(!m)return null;
    // Mod edict IDs are one-based; engine client slots are zero-based.
    const slot=Number(m[1])-1;if(!validSlot(slot)||seen.has(slot))return null;seen.add(slot);
    clients.push({slot,spectator:m[3]==='0'});
  }
  return clients;
}

export async function readLiveRoster(config,options={}){
  try{
    const before=parseClientStatus(await readText(config,'status',options));if(!before)return null;
    const roles=parseClientTeams(await readText(config,'sv otx intermission',options));if(!roles)return null;
    const after=parseClientStatus(await readText(config,'status',options));if(!after||before.map!==after.map)return null;
    const clients=[];
    for(const role of roles){
      const first=before.clients.find(c=>c.slot===role.slot),last=after.clients.find(c=>c.slot===role.slot);
      if(first?.spawned&&last?.spawned&&first.name===last.name&&before.clients.filter(c=>c.name===first.name).length===1&&after.clients.filter(c=>c.name===last.name).length===1)clients.push({name:last.name,spectator:role.spectator});
    }
    return {map:after.map,clients};
  }catch{return null;}
}

export function applyLiveRoles(players,map,roster){
  if(!roster||roster.map!==map||!Array.isArray(roster.clients))return players;
  const prefixOf=p=>String(p.name).slice(0,15).trimEnd(),counts=new Map(),roles=new Map();
  for(const p of players){const key=prefixOf(p);counts.set(key,(counts.get(key)||0)+1);}
  for(const c of roster.clients)if(typeof c.spectator==='boolean')roles.set(c.name,roles.has(c.name)?null:c.spectator);
  return players.map(player=>{
    const prefix=prefixOf(player),role=roles.get(prefix);
    return counts.get(prefix)===1&&typeof role==='boolean'?{...player,spectator:role}:player;
  });
}

import {readFileSync} from 'node:fs';
import {applyGameplayHistory} from './gameplay-history.js';

const expectedParams=JSON.parse(readFileSync(new URL('./mvd-settings-schema1.json',import.meta.url),'utf8'));
const inventory=JSON.parse(readFileSync(new URL('./mvd-gameplay-inventory.json',import.meta.url),'utf8'));
// Bounds apply to decoded strings, independently of native packet chunking.
const limits={parts:1024,fragments:256,value:65536,fields:1024,record:131072};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const flag=x=>x===0||x===1;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const styles=new Set(['default','arcade','defence','chaotic']);
const canonical=x=>JSON.stringify(x,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);

// JSON.parse accepts duplicate keys. Reject those before interpreting a server
// record, including escaped duplicate names, rather than silently choosing one.
function strictJson(text){
  const value=JSON.parse(text),stack=[];
  for(const token of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]]/g)){
    const t=token[0];
    if(t==='{')stack.push(new Set());
    else if(t==='[')stack.push(null);
    else if(t==='}'||t===']')stack.pop();
    else if(stack.at(-1)&&/^\s*:/.test(text.slice(token.index+t.length))){
      const key=JSON.parse(t),keys=stack.at(-1);
      if(keys.has(key))throw new Error('duplicate_json_key');
      keys.add(key);
    }
  }
  return value;
}

export function settingsRecords(e){
  if(e.kind!=='print'||e.level!==2)return [];
  const records=[];
  for(const line of e.text.split(/\r?\n/)){
    const m=/^(OTX_MATCH_SETTINGS|OTX_MATCH_BOT|OTX_MATCH_PARAMS|OTX_MATCH_GAMEPLAY|OTX_MATCH_BASE_PARAMS|OTX_MATCH_PARAM_TEXT) (.+)$/.exec(line);
    if(!m)continue;
    const record={tag:m[1],seq:e.seq??null,timeMs:e.time_ms??0,segment:e.segment??0,raw:line};
    try{
      if(line.length>limits.record)throw new Error('record_limit');
      const p=strictJson(m[2]);record.payload=p;
      if(!object(p)||p.schema!==1){record.error='unsupported_schema';}
      else if(!integer(p.snapshot)||!['start','change','end'].includes(p.event))record.error='invalid_snapshot';
      else if(m[1]==='OTX_MATCH_SETTINGS'){
        if(!integer(p.frame)||typeof p.map!=='string'||!p.map||
          ['hardcore','hardcore_server','training_server','pa','pa_server'].some(k=>k in p&&!flag(p[k]))||
          ['training_override','pa_override'].some(k=>k in p&&![-1,0,1].includes(p[k]))||
          ('duration_seconds' in p&&(!Number.isFinite(p.duration_seconds)||p.duration_seconds<0)))record.error='invalid_settings';
      }else if(m[1]==='OTX_MATCH_BOT'){
        if(!integer(p.frame)||!integer(p.slot)||!integer(p.bot)||!integer(p.team)||typeof p.name!=='string'||typeof p.profile!=='string'||
          ('training' in p&&!flag(p.training))||('skill' in p&&(!Number.isFinite(p.skill)||p.skill<1||p.skill>250))||
          ('skill_cap' in p&&(!Number.isFinite(p.skill_cap)||p.skill_cap<1||p.skill_cap>250))||
          ('skill' in p&&'skill_cap' in p&&p.skill>p.skill_cap)||('style' in p&&!styles.has(p.style)))record.error='invalid_bot';
      }else if(m[1]==='OTX_MATCH_GAMEPLAY'){
        if(!integer(p.frame)||typeof p.id!=='string'||!p.id||p.id.length>128||!flag(p.modified)||!integer(p.generation)||!integer(p.pending)||!integer(p.opponent)||typeof p.factory_sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.factory_sha256))record.error='invalid_gameplay';
      }else if(m[1]==='OTX_MATCH_PARAM_TEXT'){
        if(!['effective','configured'].includes(p.source)||typeof p.cvar!=='string'||!p.cvar||p.cvar.length>256||!integer(p.part)||p.part>=limits.fragments||!flag(p.last)||typeof p.value!=='string'||p.value.length>limits.value)record.error='invalid_param_text';
      }else if(!integer(p.part)||p.part>=limits.parts||!object(p.values)||Object.keys(p.values).length>limits.fields||Object.entries(p.values).some(([k,v])=>!k||k.length>256||typeof v!=='string'||v.length>limits.value))record.error='invalid_params';
    }catch(error){record.error=['duplicate_json_key','record_limit'].includes(error.message)?error.message:'invalid_json';}
    records.push(record);
  }
  return records;
}

export function assembleSettings(records){
  const groups=new Map(),unparsed=[];
  for(const r of records){
    if(r.error)unparsed.push(r);
    const p=r.payload;
    if(!object(p)||!integer(p.snapshot))continue;
    const key=`${r.segment}:${p.snapshot}`;
    if(!groups.has(key))groups.set(key,{segment:r.segment,snapshot:p.snapshot,event:p.event,timeMs:r.timeMs,records:[],errors:[]});
    const g=groups.get(key);g.records.push(r);
    if(r.error)g.errors.push(`${r.tag}:${r.error}`);
    if(g.event!==p.event)g.errors.push('conflicting_event');
  }
  const snapshots=[];
  for(const g of groups.values()){
    const unique=(rows,label)=>{
      if(rows.some(r=>r.error)){g.errors.push(`invalid_${label}`);return null;}
      const values=[...new Map(rows.map(r=>[canonical(r.payload),r.payload])).values()];
      if(values.length>1){g.errors.push(`conflicting_${label}`);return null;}
      return values[0]??null;
    };
    const settings=unique(g.records.filter(r=>r.tag==='OTX_MATCH_SETTINGS'),'settings');
    const gameplay=unique(g.records.filter(r=>r.tag==='OTX_MATCH_GAMEPLAY'),'gameplay');
    const bots=[];
    for(const slot of new Set(g.records.filter(r=>r.tag==='OTX_MATCH_BOT').map(r=>r.payload.slot))){
      const bot=unique(g.records.filter(r=>r.tag==='OTX_MATCH_BOT'&&r.payload.slot===slot),`bot_${slot}`);
      if(bot)bots.push(bot);
    }
    // A roster entry cannot describe two slots within the same snapshot.
    for(const b of [...bots])if(bots.filter(x=>x.bot===b.bot).length>1){g.errors.push(`conflicting_roster_${b.bot}`);}
    const validBots=bots.filter(b=>!g.errors.includes(`conflicting_roster_${b.bot}`));
    const extended=g.records.some(r=>['OTX_MATCH_GAMEPLAY','OTX_MATCH_BASE_PARAMS','OTX_MATCH_PARAM_TEXT'].includes(r.tag));
    const known=extended?gameplay?.factory_sha256===inventory.factoryFingerprint:true;
    const expected=extended?inventory.parameters:expectedParams;
    const collect=source=>{
      const tag=source==='effective'?'OTX_MATCH_PARAMS':'OTX_MATCH_BASE_PARAMS';
      const rows=g.records.filter(r=>r.tag===tag),texts=g.records.filter(r=>r.tag==='OTX_MATCH_PARAM_TEXT'&&r.payload.source===source);
      const values=Object.create(null),parts=[],conflicts=new Set(),errors=[],fragments=[];
      const put=(key,value)=>{if(key in values&&values[key]!==value){conflicts.add(key);errors.push(`conflicting_param_${key}`);}else values[key]=value;};
      for(const part of [...new Set(rows.map(r=>r.payload.part))].sort((a,b)=>a-b)){
        const chunk=rows.filter(r=>r.payload.part===part),data=unique(chunk,`${source}_part_${part}`);
        if(!data){for(const r of chunk)if(object(r.payload.values))for(const key of Object.keys(r.payload.values))conflicts.add(key);errors.push(`invalid_part_${part}`);continue;}
        parts.push(part);for(const [key,value]of Object.entries(data.values))put(key,value);
      }
      for(const cvar of new Set(texts.map(r=>r.payload.cvar))){
        const chunks=texts.filter(r=>r.payload.cvar===cvar),ordered=[],faults=[];
        for(const part of [...new Set(chunks.map(r=>r.payload.part))].sort((a,b)=>a-b)){
          const data=unique(chunks.filter(r=>r.payload.part===part),`${source}_${cvar}_fragment_${part}`);
          if(data)ordered.push(data);else faults.push('invalid_fragment');
        }
        if(!ordered.length||ordered.some((p,i)=>p.part!==i))faults.push('missing_fragment');
        if(ordered.filter(p=>p.last===1).length!==1||ordered.at(-1)?.last!==1)faults.push('invalid_last');
        const size=ordered.reduce((n,p)=>n+p.value.length,0);
        if(size>limits.value||ordered.length>limits.fragments)faults.push('value_limit');
        if(faults.length){conflicts.add(cvar);errors.push(`incomplete_text_${cvar}`);}
        else put(cvar,ordered.map(p=>p.value).join(''));
        fragments.push({cvar,parts:ordered.map(p=>p.part),complete:!faults.length,errors:faults});
      }
      for(const k of conflicts)delete values[k];
      if(parts.some((p,i)=>p!==i))errors.push('missing_part');
      if(rows.some(r=>r.error)||texts.some(r=>r.error))errors.push('invalid_record');
      const missing=expected.filter(k=>!Object.hasOwn(values,k)),unknown=Object.keys(values).filter(k=>!expected.includes(k));
      const inventoryKnown=known&&!unknown.length;
      const status=!rows.length&&!texts.length?'not_recorded':errors.length||missing.length?'incomplete':inventoryKnown?'complete':'unknown_inventory';
      g.errors.push(...errors.map(e=>`${source}:${e}`));
      return {values,parts,missing,unknown,fragments,status,inventoryKnown};
    };
    const effective=collect('effective'),configured=extended?collect('configured'):null;
    const frames=[...new Set(g.records.filter(r=>r.payload.frame!==undefined).map(r=>r.payload.frame))];
    if(frames.length>1)g.errors.push('conflicting_frame');
    const usable=!g.errors.some(x=>x==='conflicting_event'||x==='conflicting_frame');
    const completeness={format:extended?'extended_schema1':'legacy_schema1',inventory:known?(extended?inventory.sourceRevision:'legacy_108'):null,
      settings:settings?'complete':'incomplete',bots:validBots.length?'observed':'not_recorded',gameplay:!extended?'not_recorded':gameplay?'complete':'incomplete',
      effective:{...effective,values:undefined},configured:configured?{...configured,values:undefined}:{status:'not_recorded'}};
    const complete=Boolean(usable&&settings&&validBots.length&&effective.status==='complete'&&(!extended||gameplay&&configured.status==='complete')&&!g.errors.length);
    snapshots.push({...g,settings:usable?settings:null,bots:usable?validBots:[],gameplay:usable?gameplay:null,
      params:usable?effective.values:{},baseParams:usable&&configured?configured.values:{},parts:effective.parts,missingParams:effective.missing,
      completeness,complete,frame:frames.length===1?frames[0]:null});
  }
  snapshots.sort((a,b)=>a.timeMs-b.timeMs||(a.records[0].seq??0)-(b.records[0].seq??0));
  return {schema:1,snapshots,unparsed};
}

function timeline(observations,end){
  const intervals=[];
  for(const x of observations.sort((a,b)=>a.at-b.at||(a.priority??0)-(b.priority??0))){
    const at=Math.min(end,Math.max(0,x.at));
    if(intervals.at(-1)?.value===x.value)continue;
    if(intervals.at(-1)?.fromMs===at)intervals.pop();
    if(intervals.length)intervals.at(-1).toMs=at;
    intervals.push({fromMs:at,toMs:end,value:x.value});
  }
  return intervals;
}

function summarizeMode(observations,end){
  const initial=observations.find(x=>x.initial)?.value??null;
  const values=observations.map(x=>({at:x.at,value:x.value}));
  if(!values.length||values[0].at>0)values.unshift({at:0,value:null});
  return {initial,final:observations.at(-1)?.value??null,
    variable:new Set(observations.map(x=>x.value)).size>1,
    changed:initial!==null&&observations.some(x=>x.value!==initial),
    timeline:timeline(values,end),observations};
}

// Match BOT records to an actual slot incarnation. A same-named spectator or a
// new connection reusing a disconnected slot must not supply the duel settings.
export function participantBotRows(snapshot,participant,segment,plain){
  if(!participant)return [];
  return snapshot.bots.filter(b=>{
    if(![1,2].includes(b.team))return false;
    const identities=segment.identities.filter(x=>x.slot===b.slot&&x.timeMs<=snapshot.timeMs);
    const latest=identities.at(-1);
    if(!latest?.name||latest.name!==plain(b.name))return false;
    const disconnected=identities.findLastIndex(x=>!x.name);
    const names=identities.slice(disconnected+1).map(x=>x.name);
    const base=n=>n.replace(/(?:\[\d+(?:\.\d+)?\]|>\d+(?:\.\d+)?)$/,'');
    const anchor=segment.frames?.find(f=>f.slot===b.slot&&/^(Match|Overtime)$/.test(f.status)&&(f.name===participant.name||participant.isBot&&base(f.name)===participant.profile));
    if(anchor&&segment.identities.some(x=>x.slot===b.slot&&!x.name&&x.timeMs>anchor.timeMs&&x.timeMs<=snapshot.timeMs))return false;
    return names.includes(participant.name)||participant.isBot&&base(plain(b.name))===participant.profile;
  });
}

export function applyMatchSettings(match,data,segment,gameTime,plain){
  if(!data.snapshots.length&&!data.unparsed.length)return match;
  match.recordedSettings=data;
  const hc=[],training=[],end=match.timelineDurationMs;
  const active=match.participants.find(p=>p.isBot);
  const botRows=[];
  for(const s of data.snapshots){
    const initial=match.startObserved&&s.event==='start'&&s.timeMs>=match.startMs&&s.timeMs<=match.startMs+250;
    const at=initial?0:Math.min(end,gameTime(s.timeMs));
    const source={at,initial:Boolean(initial),snapshot:s.snapshot,frame:s.frame,recordingMs:s.timeMs,event:s.event};
    if(flag(s.settings?.hardcore))hc.push({...source,value:Boolean(s.settings.hardcore)});
    const rows=participantBotRows(s,active,segment,plain);
    if(rows.length===1){
      const b=rows[0];botRows.push({...source,bot:b});
      if(flag(b.training))training.push({...source,value:Boolean(b.training)});
    }
    // These are optional future fields; schema 1's reference recording has no
    // explicit version. Keep the existing scoreboard version when absent.
    const version=s.settings?.mod_version;
    if(!match.modVersion&&typeof version==='string'&&/^(?:OpenTDM-X Beta )?[\d.]+[A-Za-z]?(?: (?:Preview|hotfix)[ -]?\d+)?$/i.test(version))match.modVersion=version.replace(/^OpenTDM-X Beta /i,'');
    if(initial&&Number.isFinite(s.settings?.duration_seconds))match.configuredDurationSeconds=s.settings.duration_seconds;
  }
  match.modes={hardcore:summarizeMode(hc,end),training:summarizeMode(training,end)};
  for(const field of ['skill','style']){
    const observations=botRows.filter(x=>field==='skill'?Number.isFinite(x.bot.skill):styles.has(x.bot.style));
    if(!observations.length)continue;
    const key=field+'Timeline';
    const merged=[...(active[key]||[]).map(x=>({at:x.fromMs,value:x.value,priority:0})),
      ...observations.map(x=>({at:x.at,value:x.bot[field],priority:1}))];
    active[key]=timeline(merged,end);
    active[field]=active[key].at(-1)?.value??active[field];
    active[field+'Variable']=new Set(active[key].map(x=>x.value).filter(x=>x!==null)).size>1;
    active[field+'Source']='match_metadata';
    for(const x of observations)active.settingsHistory.push({kind:field,value:x.bot[field],name:plain(x.bot.name),timeMs:x.recordingMs,matchMs:x.at,source:'OTX_MATCH_BOT'});
  }
  const profiles=[...new Set(botRows.map(x=>x.bot.profile.toLowerCase()))];
  if(profiles.length===1)active.metadataProfile=profiles[0];
  if(profiles.length>1){match.ratingExcluded='opponent_changed';if(!match.warnings.includes('opponent_changed'))match.warnings.push('opponent_changed');}
  if(match.modVersion)match.warnings=match.warnings.filter(x=>x!=='unknown_mod_version');
  applyGameplayHistory(match,data,botRows,gameTime);
  if(data.unparsed.length||data.snapshots.some(x=>!x.complete))match.warnings.push('partial_match_metadata');
  return match;
}

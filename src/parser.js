import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import {normalizeMatchResult} from '../public/match-result.js';
import {settingsRecords,assembleSettings,applyMatchSettings,participantBotRows} from './match-settings.js';

export const PARSER_VERSION = '0.2.0';
const styles = '(default|arcade|defence|chaotic)';
export const plain = text => [...text].map(c => c.charCodeAt(0) >= 128 && c.charCodeAt(0) < 256 ? String.fromCharCode(c.charCodeAt(0) & 127) : c).join('').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
const botName = name => /-X(?:\[\d+\]|>\d+)$/.test(name);
const baseName = name => name.replace(/(?:\[\d+\]|>\d+)$/, '');
const skillInName = name => Number(name.match(/(?:\[(\d+)\]|>(\d+))$/)?.slice(1).find(Boolean)) || null;
const demoError=(code,message)=>Object.assign(new Error(message),{code});
// These exact messages are emitted by the mod at PRINT_CHAT too. Player chat
// includes a name prefix and must not be accepted as a control/result message.
const controlReason=text=>/^Restarting the match\.\.\.\s*$/.test(text)?'restart':
  /^Match aborted\.\s*$/.test(text)?'abort':
  /^(?:Match interrupted by (?:vote: map change to [A-Za-z0-9_-]+\.|map vote\. Match ended\.)|New map: [A-Za-z0-9_-]+)\s*$/.test(text)?'map_change':null;


export function recordingDateFromName(name, utcOffset='+03:00') {
  const current=name.match(/^(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)-(\d\d)_/);
  const legacy=name.match(/^(\d{4}-\d\d-\d\d)-(\d\d)\.(\d\d)(?:\.(\d\d))?-/);
  const date=current||legacy;
  if(!date)return null;
  const local=`${date[1]}T${date[2]}:${date[3]}:${date[4]||'00'}`;
  const utc=new Date(local+'Z');
  // Reject invalid dates instead of letting Date silently roll February into March.
  if(!Number.isFinite(utc.getTime())||utc.toISOString().slice(0,19)!==local)return null;
  const value=local+utcOffset;
  return Number.isFinite(Date.parse(value))?value:null;
}

export function assertClosedMvd(input) {
  let b;
  try {b=input[0]===31&&input[1]===139?gunzipSync(input,{maxOutputLength:512*1024*1024}):input;}
  catch {throw demoError('MVD_INVALID','Invalid or incomplete compressed MVD2');}
  if (b.subarray(0, 4).toString() !== 'MVD2') throw demoError('MVD_INVALID','Not an MVD2 recording');
  let p = 4;
  while (p + 2 <= b.length) {
    const n = b.readUInt16LE(p); p += 2;
    if (!n) { if (p !== b.length) throw demoError('MVD_INVALID','Data after MVD end marker'); return; }
    if (p + n > b.length) break;
    p += n;
  }
  throw demoError('MVD_NOT_CLOSED','MVD has no complete end marker: recording may still be active');
}

export function parseTable(text) {
  text=text.replace(/\r\n?/g,'\n');
  const header = text.match(/^Map (\S+): (.+?) (-?\d+) - (-?\d+) (.+)$/m);
  if (!header) return null;
  const participants = [{ name: header[2], score: +header[3] }, { name: header[5], score: +header[4] }];
  for (const p of participants) {
    p.isBot = botName(p.name); p.profile = p.isBot ? baseName(p.name) : null;
    p.skill = skillInName(p.name); p.style = null; p.stats = null;
  }
  const blocks = [...text.matchAll(/^--- (.+?) ---\n([\s\S]*?)(?=^--- |^={10,}|$(?![\s\S]))/gm)];
  for (const [, label, block] of blocks) {
    const settings = label.match(new RegExp(`^(.*) (\\d+) ${styles}$`));
    const name = settings ? settings[1] : label;
    const p = participants.find(x => x.name === name);
    if (!p) continue;
    if (settings) { p.isBot = true; p.profile = baseName(name); p.skill = +settings[2]; p.style = settings[3]; }
    const totals = block.match(/Kills Deaths Suic TKs Tele\s+Dealt\s+Recvd TDealt TRecvd\n\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    const pickupBlock = block.match(/All pickups:\s*([\s\S]*?)\s*$/);
    if (!totals || !pickupBlock) continue;
    p.stats = Object.fromEntries(['kills','deaths','suicides','teamKills','telefrags','damageDealt','damageReceived','teamDamageDealt','teamDamageReceived'].map((k,i) => [k,+totals[i+1]]));
    p.stats.weapons = [...block.matchAll(/^\s+(\S+)\s+(\d+%|-)\s+(\d+)\/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+|-)\s+(\d+|-)\s*$/gm)].map(m => ({ name:m[1], hits:+m[3], shots:+m[4], kills:+m[5], deaths:+m[6], damageDealt:+m[7], damageReceived:+m[8], pickups:m[9]==='-'?null:+m[9], opponentPickups:m[10]==='-'?null:+m[10] }));
    p.stats.pickups = pickupBlock[1].replace(/\n\s*/g,' ').split(',').map(x => x.trim().match(/^(.+?) (\d+)$/)).filter(Boolean).map(m => ({ name:m[1], count:+m[2] }));
    const items = block.match(/Item\s+Pick Miss\n([\s\S]*?)\s+Kills Deaths/);
    p.stats.control = items ? [...items[1].matchAll(/^\s*(.+?)\s+(\d+)\s+(\d+)\s*$/gm)].map(m=>({name:m[1],pickups:+m[2],opponentPickups:+m[3]})) : [];
  }
  return { map:header[1], participants, complete:participants.every(p=>p.stats) && /^={10,}\s*$/m.test(text), forfeit:/MATCH STATS.*forfeit/i.test(text) };
}

export function parseLegacyStats(text) {
  const result=new Map();
  const weaponNames=new Set(['Blaster','Shotgun','Super Shotgun','Machinegun','Chaingun','Grenades','Grenade Launcher','Rocket Launcher','HyperBlaster','Railgun','BFG10K']);
  for(const block of plain(text).replace(/\r\n?/g,'\n').split(/^Stats for /m).slice(1)){
    const name=block.match(/^(.+?):\n/)?.[1];
    const totals=block.match(/^Player\s*\|\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/m);
    if(!name||!totals||!/^\s*Item\s*\|\s*Acc\. Kills Deaths Dealt Recvd Pick Miss\s*$/m.test(block))continue;
    const stats=Object.fromEntries(['kills','deaths','suicides','teamKills','telefrags','damageDealt','damageReceived','teamDamageDealt','teamDamageReceived'].map((k,i)=>[k,+totals[i+1]]));
    Object.assign(stats,{format:'legacy',weapons:[],pickups:[],control:[]});
    const number=value=>value==='-'?null:Number(value);
    for(const row of block.matchAll(/^\s*(.+?)\s+\|\s+(\d+%|-)\s+(-?\d+|-)\s+(-?\d+|-)\s+(-?\d+|-)\s+(-?\d+|-)\s+(-?\d+|-)\s+(-?\d+|-)\s*$/gm)){
      const item=row[1].trim()==='MegaHealth'?'Mega Health':row[1].trim();
      const picks=number(row[7]),misses=number(row[8]);
      if(picks!==null)stats.pickups.push({name:item,count:picks});
      if(weaponNames.has(item))stats.weapons.push({name:item,accuracyPercent:row[2]==='-'?null:parseInt(row[2],10),hits:null,shots:null,kills:number(row[3]),deaths:number(row[4]),damageDealt:number(row[5]),damageReceived:number(row[6]),pickups:picks,opponentPickups:misses});
      else stats.control.push({name:item,pickups:picks,opponentPickups:misses});
    }
    if(stats.weapons.length||stats.control.length)result.set(name,stats);
  }
  return result;
}

export function settingChange(text, timeMs) {
  let voted=text.match(/^OpenTDM-X: (.+?) uses style (default|arcade|defence|chaotic) while .+ stays in this duel\.\s*$/);
  if(voted)return {timeMs,kind:'style',name:voted[1],value:voted[2],source:text.trim()};
  voted=text.match(/^OpenTDM-X: (.+?) now plays at skill (\d+) \(configured \d+\) while .+ stays in this duel\.\s*$/);
  if(voted)return {timeMs,kind:'skill',name:voted[1],value:+voted[2],source:text.trim()};
  let m = text.match(/^OpenTDM-X: (.+?) style: (default|arcade|defence|chaotic)\.\s*$/);
  if (m) return { timeMs, kind:'style', name:m[1], value:m[2], source:text.trim() };
  m = text.match(/^OpenTDM-X: (.+?) (?:is back to its configured skill|plays at the voted skill) (\d+)(?: again)?\.\s*$/);
  if (m) return {timeMs,kind:'skill',name:m[1],value:+m[2],source:text.trim()};
  m = text.match(/^OpenTDM-X: the voted skill (\d+) moves to the new opponent (.+?)(?:; this profile's maximum is \d+, so it plays at (\d+))?\.\s*$/);
  if(m) return {timeMs,kind:'skill',name:m[2],value:+(m[3]||m[1]),source:text.trim()};
  return null;
}

export class Collector {
  constructor() { this.parts=new Map(); this.result=null; }
  part(id=0) {
    if (!this.parts.has(id)) this.parts.set(id,{id,configs:new Map(),prints:[],metadata:[],seen:new Set(),frames:[],identities:[],pings:new Map(),names:new Map(),end:0,version:null,timer:null,status:null});
    return this.parts.get(id);
  }
  accept(e) {
    if(e.kind==='decode_result') { this.result=e;return; }
    const s=this.part(e.segment); s.end=Math.max(s.end,e.time_ms||0);
    if(e.kind==='segment_facts') {s.map=e.map; s.end=Math.max(s.end,e.end_ms);return;}
    if(e.kind==='configstring') {
      const value=plain(e.text); s.configs.set(e.index,value);
      if(e.index>=1312 && e.index<1568) {const slot=e.index-1312,name=value.split('\\')[0];if(s.names.get(slot)!==name)s.identities.push({timeMs:e.time_ms,slot,name});s.names.set(slot,name);}
    } else if(e.kind==='layout') {
      const version=plain(e.text).match(/OpenTDM-X Beta ([\d.]+[A-Za-z]?(?: (?:Preview|hotfix)[ -]?\d+)?)(?: by ly)/i);
      if(version) s.version=version[1];
      for(const m of plain(e.text).matchAll(/\bstring2? "([^"\n]+?):(\d+)\([^"\n]*\)"/g)) {
        s.pings.set(`${e.time_ms}:${m[1]}`,{timeMs:e.time_ms,name:m[1],ping:+m[2]});
      }
    } else if(e.kind==='print') {
      s.metadata.push(...settingsRecords(e));
      const text=plain(e.text),key=`${e.time_ms}:${e.level}:${text}`;
      if(!s.seen.has(key)) {s.seen.add(key);s.prints.push({timeMs:e.time_ms,level:e.level,text});}
    } else if(e.kind==='player_state') {
      const a=e.stats; if(a[17]||a[16])return; // discard spectators/chase copies
      const name=s.names.get(e.slot); if(!name)return;
      const status=(s.configs.get(a[26])||'').trim(),timer=(s.configs.get(a[22])||'').trim();
      const last=s.frames.at(-1);
      const tick=Math.floor(e.time_ms/500); // score changes are always retained
      s.previous ||= new Map(); const prev=s.previous.get(e.slot);
      if(!prev || prev.tick!==tick || prev.score!==a[14] || prev.status!==status || prev.name!==name) {
        s.frames.push({timeMs:e.time_ms,name,slot:e.slot,score:a[14],health:a[1],armor:a[5],status,timer,
          teamNames:[s.configs.get(a[18])?.trim(),s.configs.get(a[19])?.trim()],teamScores:[a[23],a[24]]});
        s.previous.set(e.slot,{tick,score:a[14],status,name});
      }
    }
  }
}

export function overtimeState(prints,frames,start,end,gameTime) {
  const events=[];
  for(const p of prints.filter(p=>p.timeMs>=start&&p.timeMs<=end)) {
    if(/^Scores are tied -?\d+ - -?\d+, adding [\d.]+ minutes? overtime\.\s*$/.test(p.text))events.push({timeMs:p.timeMs,kind:'overtime',source:'server_announcement'});
    else if(/^Scores are tied -?\d+ - -?\d+, entering Sudden Death!\s*$/.test(p.text))events.push({timeMs:p.timeMs,kind:'sudden_death',source:'server_announcement'});
    else if(/^Timelimit extended, (?:overtime|sudden death) canceled!\s*$/.test(p.text))events.push({timeMs:p.timeMs,kind:null,source:'server_announcement'});
  }
  for(const f of frames) {
    if(f.timeMs>end)continue;
    if(f.status==='Overtime'||f.timer==='Sudden Death')events.push({timeMs:f.timeMs,kind:f.timer==='Sudden Death'?'sudden_death':'overtime',source:'hud'});
  }
  events.sort((a,b)=>a.timeMs-b.timeMs||Number(a.source==='hud')-Number(b.source==='hud'));
  const periods=[];let active=null,canceledAt=-1;
  for(const e of events){
    if(e.kind===null){if(active){active.toMs=gameTime(e.timeMs);active.canceled=true;}active=null;canceledAt=e.timeMs;continue;}
    if(e.source==='hud'&&(active||e.timeMs<=canceledAt+200))continue;
    if(active){active.toMs=gameTime(e.timeMs);}
    active={kind:e.kind,fromMs:gameTime(e.timeMs),toMs:gameTime(end),source:e.source,canceled:false};periods.push(active);
  }
  return {overtime:Boolean(active),overtimeKind:active?.kind||null,overtimePlayed:periods.length>0,overtimePeriods:periods};
}

export function summarize(collector, meta) {
  const matches=[];
  for(const s of collector.parts.values()) {
    const prints=s.prints.filter(p=>p.level!==3 || controlReason(p.text)!==null);
    const resets=prints.filter(p=>/^Restarting the match/.test(p.text)).map(p=>p.timeMs);
    let completed=false;
    for(const p of prints){if(p.text.includes('MATCH STATS')||/^.+? wins(?:,| by )/.test(p.text)||controlReason(p.text))completed=true;if(completed&&p.text.trim()==='Fight!'){resets.push(p.timeMs);completed=false;}}
    const bounds=[0,...[...new Set(resets)].filter(t=>t>0).sort((a,b)=>a-b),s.end+1];
    for(let k=0;k<bounds.length-1;k++) {
      let start=bounds[k],end=bounds[k+1];
      const ps=prints.filter(p=>p.timeMs>=start && p.timeMs<end);
      // Restart is the boundary of the old match, not the result of the new one.
      const restart=prints.find(p=>p.timeMs===end&&controlReason(p.text)==='restart');
      if(restart)ps.push(restart);
      if(k>0) {
        const fight=ps.find(p=>p.text.trim()==='Fight!');
        if(!fight)continue; start=fight.timeMs;
      }
      const firstMatch=s.frames.find(f=>f.timeMs>=start&&f.timeMs<end&&/^(Match|Overtime)$/.test(f.status));
      // Manual recordings can contain warmup/countdown before the first Fight.
      // A later Fight after already recorded match frames is a resume, not start.
      const firstFight=ps.find(p=>p.text.trim()==='Fight!'&&(!firstMatch||p.timeMs<=firstMatch.timeMs+200));
      if(firstFight)start=firstFight.timeMs;
      const fs=s.frames.filter(f=>f.timeMs>=start && f.timeMs<end && /^(Match|Overtime)$/.test(f.status));
      let tableText='',tableTime=null,collect=false;
      for(const p of ps) {
        if(p.text.includes('MATCH STATS')) {tableText='';collect=true;tableTime=p.timeMs;}
        if(collect) {tableText+=p.text;if(/^={10,}\s*$/m.test(p.text))collect=false;}
      }
      const table=parseTable(tableText);
      if(!table && !fs.length)continue;
      let participants=table?.participants;
      if(!participants) {
        const last=fs.at(-1);
        const named=[...fs].reverse().find(f=>f.teamNames.every(name=>s.identities.some(x=>x.name===name&&x.timeMs<=f.timeMs)))||last;
        participants=named.teamNames.map((name,i)=>({name,score:last.teamScores[i],isBot:botName(name||''),profile:botName(name||'')?baseName(name):null,skill:skillInName(name||''),style:null,stats:null}));
      }
      const recordedSettings=assembleSettings(s.metadata.filter(r=>r.timeMs>=start&&r.timeMs<end));
      for(const p of participants)if(recordedSettings.snapshots.some(x=>participantBotRows(x,p,s,plain).length===1)){
        p.isBot=true;p.profile||=baseName(p.name);
      }
      if(participants.length!==2 || participants.some(p=>!p.name) || participants.filter(p=>p.isBot).length!==1)continue;
      const participantIndex=name=>participants.findIndex(p=>p.name===name||(p.isBot&&baseName(name)===p.profile));
      const ended=ps.find(p=>/Timelimit hit\. Match ended| wins, | wins by |Match drawn/i.test(p.text));
      const ff=ps.find(p=>/^.+? (?:wins by forfeit[!.]|(?:has )?forfeited(?: the match)?[!.])\s*$/i.test(p.text));
      const human=participants.find(p=>!p.isBot);
      const interrupted=ps.find(p=>p.timeMs>=start&&(!ended||p.timeMs<=ended.timeMs)&&controlReason(p.text));
      // A transient disconnect followed by a resume is not a forfeit. Prefer
      // the explicit server result; a departure ending active play is final.
      const departure=!ended&&!ff?ps.find(p=>p.level===2&&p.timeMs>start&&
        (p.text.trim()===human.name+' disconnected'||p.text.trim().startsWith(human.name+" left team '"))&&
        !fs.some(f=>f.timeMs>p.timeMs+1000&&f.teamNames.includes(human.name))&&
        !s.prints.some(q=>q.timeMs>=p.timeMs&&q.timeMs<bounds[k+1]&&q.text.startsWith(human.name+' disconnected and has ')&&/ to reconnect\.\s*$/.test(q.text))):null;
      const termination=interrupted||departure;
      const status=ff || table?.forfeit || termination ? 'forfeit' : ended ? 'completed' : 'interrupted';
      const endReason=interrupted?controlReason(interrupted.text):departure?'human_departure':status==='forfeit'?'server_forfeit':null;

      const legacy=!table&&ended?parseLegacyStats(ps.filter(p=>p.level===2&&p.timeMs>=ended.timeMs-200&&p.timeMs<=ended.timeMs+2000).map(p=>p.text).join('')):new Map();
      if(!table)for(const p of participants)p.stats=legacy.get(p.name)||null;
      const statsComplete=Boolean(table?.complete||(!table&&participants.every(p=>p.stats)));
      let scoreSource=table?'server_stats':'hud_before_reset';
      // Old mods lack the final table; the winner announcement includes a last
      // frag which may never reach a Match HUD frame (especially sudden death).
      const announcedResult=ps.map(p=>p.text.match(/^(.+?) wins, (-?\d+) to (-?\d+)\.\s*$/)).find(Boolean);
      if(!table&&status==='completed'&&announcedResult) {
        const winner=participantIndex(announcedResult[1]);
        if(winner>=0){participants[winner].score=+announcedResult[2];participants[1-winner].score=+announcedResult[3];scoreSource='server_result';}
      }
      end=termination?.timeMs??tableTime??ended?.timeMs??(k<bounds.length-2?end:fs.at(-1)?.timeMs??end);
      // OTX_MvdBeginMatch runs AFTER broadcasting Fight. The native automatic
      // filename plus the initial 0:0/full-minute HUD identifies these starts
      // even when the earlier broadcast is absent from the recording.
      const autoName=/^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_[A-Za-z0-9_-]+_.+-vs-.+-(?:style)?(?:default|arcade|defence|chaotic)(?:_-?\d+--?\d+)?_\d+\.mvd2$/i.test(meta.originalName);
      const firstFrame=fs[0];
      const opening=recordedSettings.snapshots.find(x=>x.event==='start'&&x.timeMs>=start&&x.timeMs<=start+250)?.settings;
      const clock=firstFrame?.timer.match(/^(\d+):(\d\d)$/);
      const configured=opening?.duration_seconds;
      const clockMatches=clock&&Number.isFinite(configured)&&Math.abs(+clock[1]*60+ +clock[2]-configured)<=1;
      const initialHud=k===0&&firstFrame?.timeMs<=200&&firstFrame.status==='Match'&&firstFrame.teamScores.every(n=>n===0);
      const autoStart=initialHud&&autoName&&/^\d+:00$/.test(firstFrame.timer)&&(!Number.isFinite(configured)||clockMatches);
      const metadataStart=initialHud&&Boolean(opening&&clockMatches);
      const startObserved=Boolean(firstFight||autoStart||metadataStart);
      const startSource=firstFight?'fight_announcement':autoStart?'server_autorecord':metadataStart?'settings_and_initial_hud':'unconfirmed';
      let pausedAt=null,pausedMs=0;const pauses=[];
      for(const p of ps.filter(p=>p.timeMs>=start&&p.timeMs<=end)) {
        if(/(?:has |is )?paused the game|Game paused|Match paused|game is paused|^OpenTDM-X: paused while/i.test(p.text) && pausedAt===null)pausedAt=p.timeMs;
        if(p.text.trim()==='Fight!' && pausedAt!==null) {pausedMs+=p.timeMs-pausedAt;pauses.push([pausedAt,p.timeMs]);pausedAt=null;}
      }
      if(pausedAt!==null){pausedMs+=end-pausedAt;pauses.push([pausedAt,end]);}
      const gameTime=t=>Math.max(0,t-start-pauses.reduce((sum,[a,b])=>sum+Math.max(0,Math.min(t,b)-Math.max(start,a)),0));
      const extraTime=overtimeState(ps,fs,start,end,gameTime);
      let durationSeconds=startObserved ? Math.max(0,(end-start-pausedMs)/1000) : null;
      const remaining=fs[0]?.timer.match(/^(\d+):(\d\d)$/);
      if(status==='completed' && !extraTime.overtimePlayed && /Timelimit hit/.test(ended?.text||'') && startObserved && remaining) {
        durationSeconds=(+remaining[1]*60 + +remaining[2]);
      }
      const knownSettings=prints.filter(p=>p.timeMs<=end).map(p=>p.level===2?settingChange(p.text,p.timeMs):null).filter(Boolean);
      const changes=knownSettings.filter(x=>x.timeMs>=start).map(x=>({...x,matchMs:gameTime(x.timeMs)}));
      const fileStyle=meta.originalName.match(new RegExp(`-(?:style)?${styles}(?:_|\\.)`))?.[1]||null;
      for(const p of participants) {
        p.aliases=[...new Set(fs.filter(f=>p.isBot ? baseName(f.name)===p.profile : f.name===p.name).map(f=>f.name))];
        p.settingsHistory=changes.filter(c=>baseName(c.name)===baseName(p.name));
        if(p.isBot && !p.style) {p.style=fileStyle;p.styleSource=fileStyle?'filename':null;} else p.styleSource=p.style?'server_stats':null;
        p.skillSource=p.isBot?(table?'server_stats':'name'):null;
        const identities=s.identities.filter(x=>baseName(x.name)===baseName(p.name)&&x.timeMs<end);
        const atStart=identities.filter(x=>x.timeMs<=start).at(-1);
        const skillEvents=[{timeMs:start,value:skillInName(atStart?.name||p.aliases[0]||p.name)},
          ...identities.filter(x=>x.timeMs>start).map(x=>({timeMs:x.timeMs,value:skillInName(x.name)})),
          ...p.settingsHistory.filter(x=>x.kind==='skill'&&x.timeMs>=start&&x.timeMs<end).map(x=>({timeMs:x.timeMs,value:x.value,announcement:true}))
        ].sort((a,b)=>a.timeMs-b.timeMs||Number(Boolean(a.announcement))-Number(Boolean(b.announcement)));
        p.skillTimeline=[];
        if(p.isBot)for(const x of skillEvents){const value=x.value;if(value===null||p.skillTimeline.at(-1)?.value===value)continue;if(p.skillTimeline.length)p.skillTimeline.at(-1).toMs=gameTime(x.timeMs);p.skillTimeline.push({fromMs:gameTime(x.timeMs),toMs:gameTime(end),value});}
        p.skillVariable=new Set(p.skillTimeline.map(x=>x.value)).size>1;
        if(p.skillTimeline.length){p.skill=p.skillTimeline.at(-1).value;p.skillSource='name_history';}
        const styleChanges=p.settingsHistory.filter(x=>x.kind==='style');
        const initialStyle=knownSettings.filter(x=>x.kind==='style'&&x.timeMs<=start&&baseName(x.name)===baseName(p.name)).at(-1)?.value;
        if(p.isBot&&initialStyle!==undefined&&!styleChanges.length){p.style=initialStyle;p.styleSource='server_announcement';}
        p.styleTimeline=p.isBot?[{fromMs:0,toMs:gameTime(end),value:initialStyle??(styleChanges.length&&styleChanges[0].timeMs>start?null:p.style)}]:[];
        for(const x of styleChanges){const last=p.styleTimeline.at(-1);if(last?.value===x.value)continue;if(last)last.toMs=x.matchMs;p.styleTimeline.push({fromMs:x.matchMs,toMs:gameTime(end),value:x.value});}
        p.styleVariable=new Set(p.styleTimeline.map(x=>x.value).filter(x=>x!==null)).size>1;if(styleChanges.length){p.style=styleChanges.at(-1).value;p.styleSource='server_announcement';}
        const samples=[...s.pings.values()].filter(x=>x.timeMs>=start&&x.timeMs<=end&&baseName(x.name)===baseName(p.name)).sort((a,b)=>a.timeMs-b.timeMs);
        let weight=0,total=0;
        for(let j=0;j<samples.length;j++){const w=Math.min(5000,Math.max(0,(samples[j+1]?.timeMs??end)-samples[j].timeMs));weight+=w;total+=w*samples[j].ping;}
        p.ping=samples.length?{averageMs:weight?Math.round(total/weight*10)/10:samples[0].ping,minMs:Math.min(...samples.map(x=>x.ping)),maxMs:Math.max(...samples.map(x=>x.ping)),samples:samples.length,observedSeconds:weight/1000,source:'scoreboard',maxHoldSeconds:5}:null;
      }
      const scoreHistory=[];
      for(const f of fs.filter(f=>f.timeMs<=end)) {
        const scores=participants.map(p=>{const i=f.teamNames.findIndex(n=>baseName(n||'')===baseName(p.name));return i>=0?f.teamScores[i]:null;});
        if(scores.some(x=>x===null))continue;
        if(!scoreHistory.length || scoreHistory.at(-1).scores.some((x,i)=>x!==scores[i]))scoreHistory.push({timeMs:gameTime(f.timeMs),scores});
      }
      if(['server_stats','server_result'].includes(scoreSource)&&(!scoreHistory.length||scoreHistory.at(-1).scores.some((x,i)=>x!==participants[i].score)))scoreHistory.push({timeMs:gameTime(end),scores:participants.map(p=>p.score)});
      const stateHistory=participants.map(p=>({name:p.name,samples:fs.filter(f=>f.timeMs<=end && f.timeMs%1000<100 && baseName(f.name)===baseName(p.name)).map(f=>({timeMs:gameTime(f.timeMs),health:f.health,armor:f.armor}))}));
      const winnerMessage=ps.map(p=>p.text.match(/^(.+?) wins(?:,| by )/)).find(Boolean);
      const winnerName=winnerMessage?.[1];
      const winner=status==='forfeit'?participants.findIndex(p=>p.isBot):status==='interrupted'?null:winnerName?participantIndex(winnerName):participants[0].score===participants[1].score?null:participants[0].score>participants[1].score?0:1;
      const botProfiles=[...new Set(fs.filter(f=>f.timeMs<=end).flatMap(f=>f.teamNames).filter(n=>botName(n||'')).map(baseName))];
      const ratingExcluded=botProfiles.length>1?'opponent_changed':null;
      const match=normalizeMatchResult({id:`${meta.sha256}-${s.id}-${k}`,segment:s.id,ordinal:k,map:table?.map||s.map||meta.originalName.split('_')[2],
        startedAt:meta.recordedAt?new Date(Date.parse(meta.recordedAt)+start).toISOString():null,
        startMs:start,endMs:end,timelineDurationMs:gameTime(end),recordedSeconds:Math.max(0,(end-start)/1000),durationSeconds,startObserved,startSource,
        status,winnerIndex:winner<0?null:winner,forfeitBy:status==='forfeit'?human.name:null,
        ...(endReason?{endReason}:{}),
        scoreSource,statsComplete,statsFormat:table?'extended':legacy.size?'legacy':null,modVersion:s.version,
        ...extraTime,botProfiles,ratingExcluded,
        participants,scoreHistory,stateHistory,settingsChanges:changes,
        events:ps.filter(p=>p.timeMs<=end && !p.text.includes('MATCH STATS') && (p===termination||p.level===1||/forfeit| wins|Timelimit|Restarting|paused|resum|^Scores are tied|^Fight!|^OpenTDM-X: .* (?:style:|skill)/i.test(p.text))).map(p=>({timeMs:gameTime(p.timeMs),text:p.text.trim()})),
        warnings:[...(!startObserved?['partial_start']:[]),...(!statsComplete?['no_final_stats']:[]),...(!s.version?['unknown_mod_version']:[]),...(ratingExcluded?[ratingExcluded]:[])]});
      // End metadata follows the result table. It describes settings, not a
      // new result or extra playing time. Never extend the actual match with it.
      recordedSettings.snapshots=recordedSettings.snapshots.filter(x=>x.timeMs<=end||x.event==='end'&&x.timeMs<=end+2000);
      matches.push(applyMatchSettings(match,recordedSettings,s,gameTime,plain));
    }
  }
  return {schemaVersion:1,parserVersion:PARSER_VERSION,demo:meta,matches};
}

export async function parseMvd(file, decoder, {serverUtcOffset='+03:00'}={}) {
  const before=await stat(file);
  if(before.size>128*1024*1024)throw demoError('MVD_TOO_LARGE','Demo exceeds the supported 128 MiB limit');
  const bytes=await readFile(file);assertClosedMvd(bytes);
  const originalName=path.basename(file),sha256=createHash('sha256').update(bytes).digest('hex');
  const recordedAt=recordingDateFromName(originalName,serverUtcOffset);
  const meta={sha256,size:bytes.length,originalName,recordedAt,dateSource:recordedAt?'filename':null};
  const c=new Collector();
  const child=spawn(decoder,[file],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error='',failure=null;
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code)=>resolve(code));});
  child.stderr.on('data',b=>{if(error.length<4096)error+=b.toString();});
  const timeout=setTimeout(()=>{failure=demoError('MVD_DECODE_TIMEOUT','MVD decoding exceeded 120 seconds');child.kill();},120000);
  try {
    for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})) {
      if(/^\{"kind":"(?:configstring|print|layout|player_state|segment_facts|decode_result)"/.test(line)) {
        let event;try{event=JSON.parse(line);}catch{throw failure||demoError('MVD_DECODE_FAILED','Decoder produced an invalid event; recording was not imported');}
        c.accept(event);
      }
    }
    const code=await exited;
    if(failure)throw failure;
    if(code!==0||!c.result||c.result.return_code!==0||c.result.quality!==0)throw demoError(c.result?.return_code===-4?'MVD_DECODE_LIMIT':'MVD_DECODE_FAILED',`MVD decoder failed: ${error||JSON.stringify(c.result)}`);
  } finally {clearTimeout(timeout);if(child.exitCode===null)child.kill();}
  const after=await stat(file);
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('Recording changed during parsing');
  const output=summarize(c,meta);
  if(!output.matches.length)throw demoError('MVD_UNSUPPORTED','No supported human-versus-bot duel found');
  return output;
}

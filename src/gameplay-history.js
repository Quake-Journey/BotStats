// Observed metadata only. Factories describe an inventory, never missing values.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const own=(o,k)=>Object.hasOwn(o,k);
function summary(rows,key,end){
  const known=rows.filter(r=>r.values[key]!==undefined),initial=known.find(r=>r.initial)?.values[key]??null;
  const timeline=[];
  if(!known.length||!rows[0]?.initial)timeline.push({fromMs:0,toMs:end,value:null});
  for(const r of rows){
    const value=r.values[key]??null;if(equal(timeline.at(-1)?.value,value))continue;
    if(timeline.length)timeline.at(-1).toMs=r.at;
    timeline.push({fromMs:r.at,toMs:end,value});
  }
  return {initial,final:rows.at(-1)?.values[key]??null,variable:new Set(known.map(r=>JSON.stringify(r.values[key]))).size>1,timeline};
}
export function applyGameplayHistory(match,data,botRows,gameTime){
  const observations=[],history=[],previous=Object.fromEntries(['gameplay','effective','configured','bot'].map(k=>[k,Object.create(null)]));
  for(const s of data.snapshots){
    const initial=Boolean(match.startObserved&&s.event==='start'&&s.timeMs>=match.startMs&&s.timeMs<=match.startMs+250);
    const at=initial?0:Math.min(match.timelineDurationMs,gameTime(s.timeMs));
    const b=botRows.find(r=>r.snapshot===s.snapshot&&r.recordingMs===s.timeMs)?.bot;
    const header=s.gameplay,values={};
    if(header){values.preset=header.id;values.modified=Boolean(header.modified);values.pending=header.pending;}
    // opponent is a roster number, not a client slot. A mismatch cannot label
    // another connected/spectating bot as the actual opponent.
    const bound=b&&(!header||header.opponent===0||header.opponent===b.bot)?b:null;
    const prefix=bound?`otx_bot${bound.bot}_`:null;
    if(prefix&&own(s.params,prefix+'model'))values.model=s.params[prefix+'model'];
    if(prefix&&own(s.params,prefix+'aggression')){
      const raw=s.params[prefix+'aggression'];
      if(raw.trim()!==''&&Number.isFinite(Number(raw))&&(Number(raw)===-1||Number(raw)>=0&&Number(raw)<=100))values.aggression=Number(raw);
    }
    const bot=bound?Object.fromEntries(['skill','style','training','pa_target_ms'].filter(k=>own(bound,k)).map(k=>[k,bound[k]])):{};
    const state={gameplay:header?Object.fromEntries(['id','modified','generation','pending','opponent','factory_sha256'].map(k=>[k,header[k]])):{},effective:s.params,configured:s.baseParams,bot};
    const changes=[];
    for(const [scope,fields]of Object.entries(state))for(const [key,after]of Object.entries(fields)){
      if(!equal(previous[scope][key],after)){
        if(observations.length)changes.push({scope,key,before:previous[scope][key]??null,after});
        previous[scope][key]=after;
      }
    }
    const source={snapshot:s.snapshot,frame:s.frame,recordingMs:s.timeMs,at,initial,event:s.event};
    s.matchMs=at;s.initial=initial;s.opponent=bound?{bot:bound.bot,slot:bound.slot,name:bound.name}:null;
    observations.push({...source,values});
    if(changes.length)history.push({...source,changes});
  }
  if(!data.snapshots.some(s=>s.gameplay||Object.keys(s.baseParams).length))return;
  match.gameplay={schema:1,...Object.fromEntries(['preset','modified','pending','model','aggression'].map(k=>[k,summary(observations,k,match.timelineDurationMs)])),history,observations};
}

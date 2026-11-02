// Explicitly synthetic protocol stream; not a real result or ranking fixture.
import {Collector,summarize} from '../../src/parser.js';
import {readFileSync} from 'node:fs';
export const inventory=JSON.parse(readFileSync(new URL('../../src/mvd-gameplay-inventory.json',import.meta.url),'utf8'));
export function gameplayScene({fight=true}={}){
  const collector=new Collector();let seq=0;
  const emit=(kind,body)=>collector.accept({kind,seq:seq++,segment:0,time_ms:0,...body});
  for(const [index,text]of [[1312,'David-X[200]\\male/grunt'],[1313,'Пример Пресеты\\male/grunt'],[1568,'David-X[200]'],[1569,'Пример Пресеты'],[1572,fight?'10:00':'8:00'],[1574,'Match']])emit('configstring',{index,text});
  if(fight)emit('print',{level:2,text:'Fight!\n'});
  const frame=(time,scores)=>{const stats=Array(32).fill(0);Object.assign(stats,{18:1568,19:1569,22:1572,23:scores[0],24:scores[1],26:1574});emit('player_state',{time_ms:time,slot:0,stats});};frame(0,[0,0]);
  const record=(tag,p,time=0)=>emit('print',{time_ms:time,level:2,text:`OTX_MATCH_${tag} ${JSON.stringify(p)}\n`});
  const snapshot=(n,time,event='change',opts={})=>{
    const common={schema:1,snapshot:n,event},native={...common,frame:900+n*13};
    record('GAMEPLAY',{...native,id:'regular',modified:0,generation:4,pending:0,opponent:1,factory_sha256:inventory.factoryFingerprint,...opts.header},time);
    record('SETTINGS',{...native,map:'q2duel5',duration_seconds:600,hardcore:0,...opts.settings},time);
    record('BOT',{...native,slot:0,bot:1,team:1,name:'David-X[200]',profile:'david',skill:200,style:'default',training:0,...opts.bot},time);
    const defaults=Object.fromEntries(inventory.parameters.map(k=>[k,'0']));Object.assign(defaults,{otx_bot1_model:'regular',otx_bot1_aggression:'-1'});
    record('PARAMS',{...common,part:0,values:{...defaults,...opts.effective}},time);
    record('BASE_PARAMS',{...common,part:0,values:{...defaults,...opts.configured}},time);
  };
  const meta={sha256:'c'.repeat(64),size:6,originalName:'synthetic-gameplay.mvd2',recordedAt:'2026-11-02T10:00:00+03:00',dateSource:'filename'};
  const finish=()=>{frame(600000,[2,1]);emit('print',{time_ms:600000,level:2,text:'David-X[200] wins, 2 to 1.\n'});return summarize(collector,meta).matches[0];};
  return {collector,record,emit,snapshot,frame,finish,meta};
}

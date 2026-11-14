// Public snapshot only; never connect to or write a production database.
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {computeProgressAchievements,PROGRESS_DEFINITIONS} from '../src/progress-achievements.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node tools/audit-progress-achievements.mjs snapshot.json report.json');
const snapshot=JSON.parse(await readFile(input,'utf8')),start=performance.now();
const groups=computeProgressAchievements(snapshot.matches);
const audit=PROGRESS_DEFINITIONS.map(d=>{
  const leaders=[...groups[d.audience].values()].map(p=>({name:p.name,value:p.metrics.get(d.metric)||0})).sort((a,b)=>b.value-a.value);
  return {id:d.id,name:d.name.ru,audience:d.audience,metric:d.metric,threshold:d.threshold,alreadyEligible:leaders.filter(p=>p.value>=d.threshold),leaders:leaders.slice(0,3)};
});
const report={checkedAt:new Date().toISOString(),snapshotAt:snapshot.finishedAt,matches:snapshot.matches.length,elapsedMs:performance.now()-start,conditions:audit.length,alreadyEligible:audit.filter(d=>d.alreadyEligible.length),audit};
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,audit:undefined}));
if(report.alreadyEligible.length)process.exitCode=1;

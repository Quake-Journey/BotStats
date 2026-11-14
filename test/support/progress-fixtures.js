import {game} from './achievement-fixtures.js';
export const activation='2026-10-01T00:00:00.000Z';
export function progressSeries(def, countOverride=null){
  const metric=def.metric,amount=metric==='longSeconds'?600:1;
  const size=countOverride??Math.ceil(def.threshold/amount),maps=['q2duel5','ztn2dm3','q3t2','q2duel1','koldduel1','cor'];
  return Array.from({length:size},(_,i)=>{
    const bot=def.audience==='bot',m=game(i,{human:'Пример игрока',bot:'Purri-X',hs:bot?2:12,bs:bot?12:2});
    m.id=def.id+'-'+i;m.startedAt=new Date(Date.parse(activation)+86400000+i*(metric==='days'?86400000:1200000)).toISOString();
    const p=m.participants[bot?1:0];p.stats={kills:0,suicides:0,weapons:[],pickups:[]};
    if(metric==='closeWins'){m.participants[bot?1:0].score=12;m.participants[bot?0:1].score=11;}
    if(metric==='winsClean10kills')p.stats.kills=10;
    if(metric==='games15kills')p.stats.kills=15;
    if(metric==='wins3weapons')p.stats.weapons=['Railgun','C.Gun','R.Launch'].map(name=>({name,kills:3}));
    if(metric==='rail50Wins')p.stats.weapons=[{name:'Railgun',shots:16,hits:8}];
    if(metric==='wins5kills:Chaingun')p.stats.weapons=[{name:'C.Gun',kills:5}];
    if(metric.endsWith(':kills'))p.stats.weapons=[{name:metric.slice(0,-6),kills:1}];
    if(metric.startsWith('pickups:'))p.stats.pickups=[{name:metric.slice(8),count:1}];
    if(metric==='hardcoreNoTrainingWins')m.modes={hardcore:{initial:true},training:{initial:false}};
    if(metric==='godMaxWins'){Object.assign(m.participants[1],{profile:'GOD-X',name:'GOD-X[250]',skill:250});}
    if(metric==='overtimeGames')m.overtime=true;
    if(metric==='mapsWon')m.map=maps[i%maps.length];
    if(metric.startsWith('wins2min:')){m.map=metric.slice(9);m.durationSeconds=m.recordedSeconds=120;m.timelineDurationMs=120000;}
    if(metric.startsWith('mapWins:'))m.map=metric.slice(8);
    return m;
  });
}

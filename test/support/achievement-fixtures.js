export function game(i,options={}){
  const {human='Tester',bot='David-X',skill=200,hs=20,bs=0,seconds=600,map='q2duel5',status='completed',...rest}=options;
  return {id:'award-'+i,startedAt:new Date(Date.UTC(2026,9,1)+i*1200000).toISOString(),startObserved:true,status,map,
    durationSeconds:seconds,recordedSeconds:seconds,timelineDurationMs:seconds*1000,statsComplete:true,
    winnerIndex:hs===bs?null:hs>bs?0:1,
    participants:[{name:human,isBot:false,score:hs,stats:{kills:hs,deaths:bs,control:[]}},{name:bot+'['+skill+']',profile:bot,isBot:true,skill,score:bs,stats:{kills:bs,deaths:hs,control:[]}}],
    scoreHistory:[{timeMs:0,scores:[0,0]},{timeMs:seconds*1000,scores:[hs,bs]}],...rest};
}
export function collection(){
  const rows=[];let i=0;
  const add=(o={})=>{const m=game(++i,o);rows.push(m);return m;};
  for(let j=0;j<100;j++)add({map:['q2duel5','ztn2dm3','q3t2'][j%3],bot:['David-X','Pacifist-X','OptiMus-X','GOD-X','Polosatiy-X'][j%5]});
  add({hs:15});
  for(let j=0;j<5;j++)add({hs:1,seconds:610,overtime:true,overtimePlayed:true,overtimeKind:'sudden_death',overtimePeriods:[{fromMs:600000,toMs:610000,kind:'sudden_death'}],scoreHistory:[{timeMs:0,scores:[0,0]},{timeMs:599900,scores:[0,0]},{timeMs:610000,scores:[1,0]}]});
  for(let j=0;j<10;j++)add({status:'forfeit',winnerIndex:1});
  for(let j=0;j<10;j++)add({hs:2,bs:1});
  for(let j=0;j<15;j++)add({skill:50});
  add({scoreHistory:[{timeMs:0,scores:[0,0]},{timeMs:300000,scores:[0,10]},{timeMs:600000,scores:[20,10]}],bs:10});
  add({hs:0,bs:20});add();
  add({map:'ztn2dm3'}).participants[0].stats.control=[{name:'Mega Health',pickups:3}];
  for(let j=0;j<10;j++)add({human:'Training dummy',hs:0,bs:10});
  return rows;
}

import {game} from './achievement-fixtures.js';
const win=(i,o={})=>game(i,{hs:2,bs:52,...o});
const series=(n,o={})=>Array.from({length:n},(_,i)=>win(i,o));
export function botCollection(){
 const rows=series(100);
 rows[0].participants[0].score=0;
 const s=rows[0].participants[1].stats;s.suicides=0;
 s.weapons=[{name:'Railgun',hits:20,shots:20},{name:'R.Launch',kills:15},{name:'C.Gun',damageDealt:2000},{name:'H.Blaster',kills:10}];
 s.pickups=[{name:'Railgun',count:10},{name:'Body Armor',count:10}];
 rows[0].participants[0].stats.pickups=[{name:'Railgun',count:0},{name:'Body Armor',count:2}];
 rows[0].scoreHistory=[{timeMs:100000,scores:[10,0]},{timeMs:600000,scores:[0,52]}];
 for(let i=1;i<=5;i++){rows[i].overtime=true;rows[i].regulationSeconds=600;rows[i].durationSeconds=650;}
 rows[1].map='ztn2dm3';rows[1].participants[1].stats.control=[{name:'Mega Health',pickups:3}];rows[1].participants[0].stats.control=[{name:'Mega Health',pickups:0}];
 rows[2].map='q2duel1';rows[3].map='q3t2';
 for(let i=1;i<5;i++)rows[i].participants[0].name='Human-'+i;
 return rows;
}
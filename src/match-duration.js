// Correct old imports before sorting/projection/aggregation. The old parser
// replaced active time with the opening HUD at a normal timelimit ending,
// even if the limit had changed. Do not rewrite operator data or reparse MVDs
// on requests. A fresh import supplies the corrected duration directly.
export function matchDurationStages(){
  const numeric={$and:[{$isNumber:'$durationSeconds'},{$isNumber:'$timelineDurationMs'}]};
  const eligible={$and:[{$eq:['$status','completed']},{$eq:['$startObserved',true]},
    {$ne:['$overtime',true]},{$ne:['$overtimePlayed',true]},
    {$cond:[numeric,{$and:[{$gte:['$timelineDurationMs',0]},
      {$gt:[{$abs:{$subtract:['$timelineDurationMs',{$multiply:['$durationSeconds',1000]}]}},1000]}]},false]}]};
  const ended={$anyElementTrue:[{$map:{input:{$ifNull:['$events',[]]},as:'e',
    in:{$eq:['$$e.text','Timelimit hit. Match ended.']}}}]};
  const snapshots={$filter:{input:{$ifNull:['$recordedSettings.snapshots',[]]},as:'s',cond:{$and:[
    {$isNumber:'$$s.settings.duration_seconds'},{$isNumber:'$$s.timeMs'},
    {$gte:['$$s.timeMs',{$ifNull:['$startMs',0]}]},
    {$or:[{$lte:['$$s.timeMs','$endMs']},{$and:[{$eq:['$$s.event','end']},{$lte:['$$s.timeMs',{$add:['$endMs',2000]}]}]}]}
  ]}}};
  const correction={$let:{vars:{elapsed:{$divide:['$timelineDurationMs',1000]},last:{$arrayElemAt:[snapshots,-1]}},in:{$let:{
    vars:{limit:'$$last.settings.duration_seconds'},in:{
      durationSeconds:{$cond:[{$cond:[{$isNumber:'$$limit'},{$and:[{$gt:['$$limit',0]},{$lte:[{$abs:{$subtract:['$$limit','$$elapsed']}},1]}]},false]},'$$limit','$$elapsed']},
      durationCorrection:'active_time_after_timelimit_change'
    }
  }}}};
  return [{$set:{__botstatsDuration:{$cond:[eligible,{$cond:[ended,correction,{}]},{}]}}},
    {$replaceRoot:{newRoot:{$mergeObjects:['$$ROOT','$__botstatsDuration']}}},{$unset:'__botstatsDuration'}];
}

// Read-time counterpart of public/match-result.js. It runs before filters,
// pagination and all projections so already imported records need no rewrite.
export function matchResultStages(){
  const validDuel={$and:[{$eq:[{$size:{$ifNull:['$participants',[]]}},2]},
    ...[true,false].map(value=>({$eq:[{$size:{$filter:{input:{$ifNull:['$participants',[]]},as:'p',cond:{$eq:['$$p.isBot',value]}}}},1]}))]};
  return [{$set:{__botstatsResult:{$cond:[validDuel,{$let:{
    vars:{bi:{$indexOfArray:['$participants.isBot',true]}},in:{$let:{
      vars:{human:{$arrayElemAt:['$participants.name',{$subtract:[1,'$$bi']}]},s0:{$arrayElemAt:['$participants.score',0]},s1:{$arrayElemAt:['$participants.score',1]}},
      in:{$switch:{branches:[
        {case:{$eq:['$status','interrupted']},then:{status:'forfeit',winnerIndex:'$$bi',forfeitBy:'$$human',resultCorrection:'interrupted_as_forfeit'}},
        {case:{$and:[{$eq:['$status','forfeit']},{$or:[{$ne:['$winnerIndex','$$bi']},{$ne:[{$ifNull:['$forfeitBy',null]},'$$human']}]}]},then:{winnerIndex:'$$bi',forfeitBy:'$$human',resultCorrection:'forfeit_winner'}},
        {case:{$and:[{$eq:['$status','completed']},{$eq:[{$ifNull:['$winnerIndex',null]},null]},{$isNumber:'$$s0'},{$isNumber:'$$s1'},{$ne:['$$s0','$$s1']}]},
          then:{winnerIndex:{$cond:[{$gt:['$$s0','$$s1']},0,1]},resultCorrection:'winner_from_score'}}
      ],default:{}}}
    }}}
  },{}]}}},{$replaceRoot:{newRoot:{$mergeObjects:['$$ROOT','$__botstatsResult']}}},{$unset:'__botstatsResult'}];
}

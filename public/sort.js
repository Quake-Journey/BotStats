// Compare raw values, never localized display strings. Missing data stays last.
export function compareValues(a,b,locale='ru') {
  if(Array.isArray(a)&&Array.isArray(b)){
    for(let i=0;i<Math.max(a.length,b.length);i++){const n=compareValues(a[i],b[i],locale);if(n)return n;}
    return 0;
  }
  if(typeof a==='number'&&typeof b==='number')return a-b;
  return String(a??'').localeCompare(String(b??''),locale,{numeric:true,sensitivity:'base'});
}
export function sortRows(rows,value,direction='asc',locale='ru') {
  return rows.map((row,index)=>({row,index,value:value(row)})).sort((a,b)=>{
    const absent=x=>x===null||x===undefined||Number.isNaN(x);
    if(absent(a.value)||absent(b.value))return Number(absent(a.value))-Number(absent(b.value))||a.index-b.index;
    return (direction==='desc'?-1:1)*compareValues(a.value,b.value,locale)||a.index-b.index;
  }).map(x=>x.row);
}

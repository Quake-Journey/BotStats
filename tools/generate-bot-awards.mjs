// Original vector machine awards. Each award has a full-size, distinct silhouette.
// Shared materials unify the series; the subject, not a tiny label, identifies it.
import {mkdir,writeFile} from 'node:fs/promises';
import {BOT_DEFINITIONS} from '../src/bot-achievements.js';
const metal='url(#metal)',dark='url(#dark)',red='url(#red)',ice='url(#ice)';
const p=(d,fill=metal,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const circle=(x,y,r,fill=metal,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const rect=(x,y,w,h,fill=metal,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}" ${extra}/>`;
const line=(d,color='#cedbe4',width=6)=>p(d,'none',`stroke="${color}" stroke-width="${width}" stroke-linecap="round"`);
const glow=(art,color='#ff3545')=>`<g fill="${color}" stroke="none" opacity=".6" filter="url(#glow)">${art}</g>`;
const bolt=(x,y)=>circle(x,y,5,'#a8bac7','stroke="#182633" stroke-width="3"');
const subjects={
 'skynet':
  p('M192 24 345 298H39Z',dark)+p('M192 24 213 61 63 298H39Z','#b9cbd8')+p('M192 24 345 298H318L192 72Z','#5e7182')+
  line('M68 275H316','#cddbe5',9)+
  line('M192 116V72M143 202 93 246M240 202 291 246','#f74b58',12)+
  p('M192 105 258 143V221L192 260 126 221V143Z',metal)+
  p('M192 105V182L258 143Z','#e1eaf0')+p('M192 182V260L258 221V143Z','#374d5e')+p('M126 143 192 182V260L126 221Z','#768c9d')+
  circle(192,182,25,'#101b28')+circle(192,182,14,red)+
  [ [192,57],[63,284],[321,284] ].map(([x,y])=>circle(x,y,18,dark)+circle(x,y,8,red)).join('')+
  p('M75 319H309L282 350H102Z',metal)+line('M128 333H256','#ff5360',7),
 'terminator':
  p('M106 49 161 25H224L279 49 317 112 302 218 268 250 260 309 228 350H155L122 309 114 250 80 218 67 112Z',metal)+
  p('M115 61 163 41H220L269 61 287 108 243 93H141L96 108Z',dark)+
  p('M87 129 174 150 161 194 102 185Z','#0a111a')+p('M297 129 210 150 223 194 282 185Z','#0a111a')+
  glow('<ellipse cx="133" cy="166" rx="30" ry="12"/><ellipse cx="251" cy="166" rx="30" ry="12"/>')+
  p('M100 151 161 164 150 178 109 174Z',red)+p('M284 151 223 164 234 178 275 174Z',red)+
  p('M181 175 165 231 192 244 219 231 203 175Z',dark)+
  p('M97 204 121 222 139 260 118 245 91 224Z','#344b60')+p('M287 204 263 222 245 260 266 245 293 224Z','#344b60')+
  p('M137 270H247V311L224 331H160L137 311Z',dark)+
  Array.from({length:7},(_,i)=>rect(144+i*14,274,10,33,metal,'stroke-width="2"')).join('')+
  line('M138 249 161 259H223L246 249','#f0f6fa',7)+bolt(89,112)+bolt(295,112),
 'artificial-mind':
  p('M181 42C151 17 111 40 111 74 64 62 47 103 64 134 24 155 32 206 61 217 44 259 80 287 112 278 112 319 153 346 181 319Z',metal)+
  p('M203 42C233 17 273 40 273 74 320 62 337 103 320 134 360 155 352 206 323 217 340 259 304 287 272 278 272 319 231 346 203 319Z',metal)+
  line('M181 89H141L120 111V149H78M181 168H144L127 190V235L106 254M180 276H151V309','#354d61',12)+
  line('M203 89H243L264 111V149H306M203 168H240L257 190V235L278 254M204 276H233V309','#354d61',12)+
  rect(145,134,94,111,dark)+rect(165,156,54,66,red)+
  line('M192 169V207M177 188H207','#ffe1db',7)+
  [[102,102],[76,203],[150,280],[282,102],[308,203],[234,280]].map(([x,y])=>circle(x,y,10,red)).join('')+
  line('M176 332V355M208 332V355','#c1d3de',10),
 'meat-factory':
  p('M55 46H329L296 126H88Z',metal)+p('M79 62H305L278 104H106Z',dark)+
  p('M52 127H332L355 169V267L328 298H56L29 267V169Z',dark)+
  rect(49,150,286,129,metal)+rect(65,164,254,100,'#101a24')+
  [107,192,277].map((x,i)=>`<g transform="translate(${x} 214) rotate(${i*15})">`+
   p('M-14-47H14L19-33 32-32 38-41 51-20 39-10 43 3 55 9 45 33 30 29 21 39 21 53H-6L-10 38-24 34-35 43-51 22-38 12-43-2-56-8-45-32-30-28-21-38Z',metal,'stroke-width="4"')+circle(0,0,27,red)+circle(0,0,11,dark)+'</g>').join('')+
  p('M64 298H320V333H64Z',metal)+line('M88 316H296','#ed3549',9)+
  p('M76 334H106V356H58ZM278 334H308L326 356H278Z',dark),
 'judgment-day':
  glow('<path d="M69 159C20 150 20 101 55 88 57 46 105 29 139 43 159 9 226 10 245 43 282 27 329 50 330 85 368 102 367 149 327 163Z"/>')+
  p('M67 160C27 158 16 117 45 96 37 58 91 31 126 51 139 13 203 13 225 39 264 18 319 43 315 78 360 76 376 131 339 156L298 180H91Z',metal)+
  p('M76 119C89 82 123 107 143 79 166 56 195 70 205 92 230 67 263 87 267 111 301 93 324 117 312 143H85Z',red)+
  p('M133 166H251L231 202 226 267 260 298H124L158 267 153 202Z',metal)+
  p('M179 179H204L195 235 209 277H168L185 232Z',red)+
  p('M33 314 95 285 132 297H255L287 285 352 314 316 340H69Z',dark)+
  line('M48 346H336','#a9c1ce',8)+line('M44 228 80 239M340 227 304 240M97 203 110 219M286 205 274 220','#ff4b5a',10),
 'endoskeleton':
  p('M158 31H226L239 68 222 100H162L145 68Z',metal)+p('M160 58H224V74H160Z',red)+
  rect(175,101,34,30,dark)+p('M124 117 192 140 260 117 281 153 253 174H131L103 153Z',metal)+
  p('M68 121 118 136 97 179 48 164Z',metal)+p('M316 121 266 136 287 179 336 164Z',metal)+
  line('M68 174 45 258M316 174 339 258','#afc3d0',20)+circle(44,264,20,dark)+circle(340,264,20,dark)+
  line('M55 281 77 333M329 281 307 333','#afc3d0',24)+
  rect(174,153,36,153,dark)+
  [170,204,238].map((y,i)=>p(`M122 ${y} 174 ${y+16}V${y+32}L${130+i*8} ${y+22}Z`,metal)+p(`M262 ${y} 210 ${y+16}V${y+32}L${254-i*8} ${y+22}Z`,metal)).join('')+
  [175,213,251].map(y=>circle(192,y,8,red)).join('')+
  p('M141 290 192 309 243 290 254 329 219 349H165L130 329Z',metal),
 'red-eye':
  p('M19 180 77 99 126 73H258L307 99 365 180 307 257 255 284H128L77 257Z',metal)+
  p('M35 180 92 130 140 114H244L292 130 349 180 292 229 245 247H139L92 229Z',dark)+
  circle(192,180,101,dark)+circle(192,180,84,metal)+circle(192,180,66,'#120c14')+
  glow('<circle cx="192" cy="180" r="51"/>')+circle(192,180,52,red)+circle(192,180,26,'#160b13')+
  circle(179,165,13,'#fff1dc','stroke="none"')+circle(211,200,7,'#fb8d8d','stroke="none"')+
  [0,90,180,270].map(r=>`<g transform="rotate(${r} 192 180)">${rect(185,86,14,20,'#dbe9f0','stroke-width="2"')}</g>`).join('')+
  p('M126 299H258L238 329H146Z',metal)+line('M163 312H221','#e84755',6),
 'perfect-sight':
  p('M44 136V44H136V72H72V136ZM248 44H340V136H312V72H248ZM340 248V340H248V312H312V248ZM136 340H44V248H72V312H136Z',metal)+
  circle(192,192,91,dark)+circle(192,192,64,metal)+circle(192,192,42,'#12202e')+
  line('M192 29V147M192 237V355M29 192H147M237 192H355','#e7f0f5',12)+
  p('M192 158 205 180 229 192 205 204 192 227 180 204 157 192 180 180Z',red)+circle(192,192,6,'#fff2df','stroke="none"'),
 'siege-engine':
  p('M32 289 92 262 126 293 91 352 76 311Z',red)+p('M52 296 95 279 111 294 89 325Z','#ffb28b')+
  p('M78 247 119 191 157 229 111 278Z',dark)+
  p('M112 249 256 83 300 126 142 281Z',metal)+p('M134 248 269 104 281 116 145 263Z','#eef5f8')+
  p('M256 83 333 34 300 126Z',red)+
  p('M117 202 92 190 113 151 193 139ZM187 254 202 280 238 254 246 170Z',metal)+
  line('M208 138 249 178','#ac263a',14)+
  line('M36 222 72 184M149 341 183 304','#b2cbd6',8)+bolt(223,152),
 'steel-storm':
  p('M66 252 171 58 255 46 330 116 311 204 134 315Z',dark)+
  p('M94 244 187 73 220 82 124 268Z',metal)+p('M124 268 220 82 246 111 153 286Z','#869eae')+
  p('M150 286 249 114 281 130 183 300Z',metal)+
  p('M67 239 131 216 196 256 195 314 128 352 67 313Z',metal)+
  [[99,265],[140,253],[168,281],[143,314],[101,311],[128,284]].map(([x,y])=>circle(x,y,13,'#111c2a')+circle(x-2,y-2,5,'#9d2435','stroke="none"')).join('')+
  p('M248 46 316 72 342 135 321 174 300 141 278 104 233 78Z',metal)+
  [0,1,2,3,4].map(i=>`<g transform="translate(${233+i*21} ${268-i*7}) rotate(-19)">${rect(0,0,17,50,'#c5a06c')+p('M0 0 8-13 17 0Z',red,'stroke-width="3"')}</g>`).join(''),
 'plasma-core':
  p('M132 28H252L281 73V310L250 356H135L104 310V73Z',dark)+
  p('M132 28H252L267 61H118Z',metal)+p('M118 322H267L250 356H135Z',metal)+
  rect(132,78,120,232,'#0b2631')+
  glow('<path d="M208 88 150 199H185L170 291 234 171H198Z"/>','#47e3e8')+
  p('M207 88 146 202H184L169 290 238 170H199Z',ice)+
  [96,145,229,276].map(y=>p(`M104 ${y}H133V${y+22}H104ZM251 ${y}H281V${y+22}H251Z`,metal)).join('')+
  line('M83 121V263M301 121V263','#96b4c8',12)+
  circle(83,192,11,red)+circle(301,192,11,red),
 'rail-protocol':
  p('M38 155H85L108 124H243L271 145H346V190H275L248 214H153L119 257H73L92 202H38Z',metal)+
  p('M41 165H103V190H41Z',dark)+p('M139 133H255V196H139Z',dark)+
  [151,177,203,229].map(x=>rect(x,139,13,52,red,'stroke-width="3"')).join('')+
  p('M109 114V87H213V114Z',dark)+rect(122,93,73,16,'#bdcfdb')+
  p('M146 211H219L205 249H128Z',dark)+p('M89 250H119L108 294H65Z',dark)+
  line('M277 164H360','#79eff3',9)+line('M274 180H324','#9baebb',6)+
  line('M76 319H303','#a3b9c7',5)+p('M316 305 347 319 316 333Z',red),
 'reactor-lock':
  p('M192 21 346 108V279L192 366 38 279V108Z',metal)+
  p('M192 46 323 121V264L192 339 61 264V121Z',dark)+
  circle(192,181,88,metal)+circle(192,181,67,'#132333')+
  [0,120,240].map(a=>`<g transform="rotate(${a} 192 181)">${p('M177 148 151 117Q192 90 233 117L207 148Z',red)}</g>`).join('')+
  circle(192,181,18,red)+
  p('M224 268V248C224 201 291 201 291 248V268H275V249C275 226 240 226 240 249V268Z',metal)+
  rect(211,262,91,75,metal)+circle(256,290,12,dark)+rect(251,295,10,21,dark,'stroke-width="2"')+
  bolt(79,132)+bolt(303,132)+bolt(192,69),
 'armour-foundry':
  p('M122 50 162 76H222L262 50 323 75 346 144 285 165 268 285 192 321 116 285 99 165 38 144 61 75Z',metal)+
  p('M124 80 162 102H222L260 80 274 147 251 266 192 295 133 266 110 147Z',red)+
  p('M146 103 192 120 238 103 227 170H157Z','#cf6670')+
  p('M162 192H222L232 251 192 270 152 251Z',dark)+
  p('M60 86 95 73 105 131 57 140ZM324 86 289 73 279 131 327 140Z',dark)+
  p('M64 310H320L300 332H226V351H158V332H89Z',metal)+
  line('M165 210H219','#e4edf1',6),
 'iron-discipline':
  p('M192 23 315 69V208C315 279 252 327 192 362 132 327 69 279 69 208V69Z',metal)+
  p('M192 49 291 86V207C291 263 244 306 192 336 140 306 93 263 93 207V86Z',dark)+
  p('M111 189 141 161 179 200 248 113 278 139 182 265Z',red)+
  line('M129 190 178 239 261 135','#ffb0a7',5)+
  p('M45 108 28 131 35 166 52 145ZM38 186 25 211 41 243 55 219ZM56 259 53 288 83 310 87 284ZM339 108 356 131 349 166 332 145ZM346 186 359 211 343 243 329 219ZM328 259 331 288 301 310 297 284Z',metal),
 'reboot':
  p('M306 84 346 43V162H227L270 119C221 72 136 99 108 153L69 134C110 44 232 20 306 84Z',metal)+
  p('M78 300 38 341V222H157L114 265C163 312 248 285 276 231L315 250C274 340 152 364 78 300Z',metal)+
  circle(192,192,68,dark)+
  p('M164 144C120 174 133 238 178 248 225 259 259 210 241 172L220 146 207 162C250 199 204 246 174 222 151 205 154 181 178 162Z',red)+
  rect(183,118,19,83,'#d9e8f0')+line('M83 113 105 88M301 272 279 296','#ff4b57',10),
 'final-directive':
  p('M69 31H315V74H69ZM69 310H315V353H69Z',metal)+
  p('M99 74H285L276 127 225 192 276 257 285 310H99L108 257 159 192 108 127Z',dark)+
  p('M123 87H261L252 125 192 173 132 125Z',red)+
  p('M192 208 249 264 260 298H124L135 264Z',red)+
  line('M192 175V228','#fff0d5',9)+
  line('M85 86V298M299 86V298','#a1b9c9',14)+
  bolt(91,51)+bolt(293,51)+bolt(91,332)+bolt(293,332),
 'all-sectors':
  p('M192 129 354 218 192 355 30 218Z',dark)+
  p('M192 46 250 79 192 119 134 79Z',metal)+p('M134 79 192 119V182L134 146Z','#66859b')+p('M250 79 192 119V182L250 146Z','#b5cbd7')+
  p('M98 140 155 174 98 214 41 174Z',metal)+p('M41 174 98 214V277L41 241Z','#66859b')+p('M155 174 98 214V277L155 241Z','#b5cbd7')+
  p('M286 140 343 174 286 214 229 174Z',metal)+p('M229 174 286 214V277L229 241Z','#66859b')+p('M343 174 286 214V277L343 241Z','#b5cbd7')+
  p('M192 232 249 266 192 306 135 266Z',metal)+p('M135 266 192 306V366L135 332Z','#66859b')+p('M249 266 192 306V366L249 332Z','#b5cbd7')+
  [[192,41],[98,135],[286,135],[192,227]].map(([x,y])=>line(`M${x} ${y+34}V${y-30}`,'#263d50',7)+p(`M${x} ${y-30}H${x+33}L${x+21} ${y-14}H${x}Z`,red,'stroke-width="3"')).join(''),
 'hunter-net':
  circle(192,192,151,metal)+circle(192,192,132,dark)+
  [48,88,118].map(r=>circle(192,192,r,'none','stroke="#607b8f" stroke-width="3"')).join('')+
  line('M192 62V322M62 192H322','#607b8f',3)+
  p('M192 192 192 64A128 128 0 0 1 308 247Z','#304c51','stroke="none"')+
  line('M192 192 304 247','#c8f4e5',7)+
  [[135,115],[265,145],[114,218],[228,283],[222,207]].map(([x,y])=>circle(x,y,13,red)+circle(x,y,4,'#fff1e1','stroke="none"')).join('')+
  circle(192,192,9,metal)+
  p('M177 28V11H207V28ZM356 177H373V207H356ZM177 356V373H207V356ZM28 177H11V207H28Z',dark),
 'legion':
  p('M24 326V264L49 249H123L151 278 173 326Z',dark)+p('M211 326 233 278 261 249H335L360 264V326Z',dark)+
  [76,308].map(x=>`<g transform="translate(${x-66} 72) scale(.7)">`+
    p('M29 79 61 44H128L161 79 150 171 119 208H72L40 171Z',metal)+p('M43 100H147L135 125H55Z',red)+p('M65 146H125V182H65Z',dark)+'</g>').join('')+
  p('M72 359V285L120 249H264L312 285V359Z',metal)+p('M113 287 192 316 271 287 282 359H102Z',dark)+
  p('M118 57 155 23H229L266 57 255 181 225 242H159L129 181Z',metal)+
  p('M134 89H250L236 124H148Z',red)+p('M154 155H230L223 211H161Z',dark)+
  line('M177 164V200M207 164V200','#bfced9',8)+p('M175 329H209V350H175Z',red)
};
const defs=`<defs>
 <linearGradient id="metal" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#f1f6fa"/><stop offset=".25" stop-color="#bccbd6"/><stop offset=".46" stop-color="#687f92"/><stop offset=".52" stop-color="#d4e0e8"/><stop offset="1" stop-color="#526b80"/></linearGradient>
 <linearGradient id="dark" x2=".6" y2="1"><stop stop-color="#344c60"/><stop offset="1" stop-color="#101b28"/></linearGradient>
 <linearGradient id="red" x2=".7" y2="1"><stop stop-color="#ffb5a6"/><stop offset=".23" stop-color="#ff5664"/><stop offset=".7" stop-color="#c51d3d"/><stop offset="1" stop-color="#6f1530"/></linearGradient>
 <linearGradient id="ice" x2=".4" y2="1"><stop stop-color="#f0fffb"/><stop offset=".35" stop-color="#9ff7ef"/><stop offset="1" stop-color="#24aebe"/></linearGradient>
 <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
 </defs>`;
const out=new URL('../public/achievements/bots/',import.meta.url);await mkdir(out,{recursive:true});
for(const a of BOT_DEFINITIONS){
 const id=a.id.slice(4);if(!subjects[id])throw new Error('Missing artwork: '+id);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384"><title>${a.name.en}</title>${defs}<g stroke="#111d2b" stroke-width="5" stroke-linejoin="round">${subjects[id]}</g></svg>`;
 await writeFile(new URL(id+'.svg',out),svg);
}
console.log(`Generated ${BOT_DEFINITIONS.length} distinct machine emblems`);

// Native SVG assets: distinct central silhouettes remain legible at 36px.
import {mkdir,writeFile} from 'node:fs/promises';
import {PROGRESS_DEFINITIONS} from '../src/progress-definitions.js';
const glyphs=[
// Humans: hourglass, summit, burning shield, razor, broom, trident, scalpel,
// press, tracks, rocket envelope, ticket, health reserve, backpack, home,
// overtime clock, arena arch, snowflake, broken halo, calendar, chain links.
'<path d="M27 23h46v8L57 49l16 21v8H27v-8l16-21-16-18z"/><path class="cut" d="M36 32h28L50 46zM36 70l14-16 14 16z"/>',
'<path d="M16 76 41 25l13 27 10-18 23 42z"/><path class="cut" d="m34 40 7-15 8 16-8-3zM58 48l6-14 7 16-8-3z"/><path class="line" d="M74 15v14m-7-7h14"/>',
'<path d="M50 80C12 66 26 42 36 34c-1 14 6 14 7 10-3-21 10-28 15-32-2 18 15 25 18 39 4 17-10 29-26 29z"/><path class="cut" d="m50 41 14 7-2 17-12 10-12-10-2-17z"/>',
'<path d="m18 61 44-44 22 22-44 44-8-9-8 1 1-8z"/><path class="cut" d="m35 55 19-19 10 10-19 19z"/>',
'<path d="m58 18 8 5-21 35-8-5zM34 51l15 9 11 21H17z"/><path class="line" d="m23 77 12-17m9 20 1-15M74 33v16m-8-8h16"/>',
'<path d="M45 83V49L21 36V20l9 4v9l15 8V14h10v27l15-8v-9l9-4v16L55 49v34z"/>',
'<path d="m25 81-8-8 29-31 11 11zM48 39l23-25 15 5c-2 15-15 28-26 31z"/><path class="line" d="M25 20v15m-7-8h15"/>',
'<path d="M20 20h60v11H55v17H45V31H20zM31 53h38v10H31zM17 72h66v11H17z"/><path class="line" d="M27 37v10m46-10v10M41 64v7m18-7v7"/>',
'<path d="M31 17h10L34 83H22zM59 17h10l9 66H66z"/><path class="line" d="M35 26h30M32 40h36M29 55h42M26 72h48"/>',
'<path d="M18 48h48v32H18z"/><path class="cut" d="m18 49 24 19 24-19v8L42 76 18 57z"/><path d="M58 42c1-17 10-26 25-28 0 18-8 29-23 34l-11 1z"/><path class="cut" d="m66 33 7-7 5 5-7 7z"/>',
'<path d="M18 27h64v14c-12 0-12 18 0 18v14H18V59c12 0 12-18 0-18z"/><path class="cut" d="m48 35 16 6-2 15-14 11-14-11-2-15z"/>',
'<path d="M25 22h50v13h9v48H16V35h9z"/><path class="cut" d="M44 40h12v11h12v12H56v11H44V63H32V51h12z"/>',
'<path d="M34 26v-8h32v8h10l8 18v36H16V44l8-18z"/><path class="cut" d="M42 24h16v7H42zM27 53h46v20H27z"/><path class="line" d="M29 38h42M38 47h24"/>',
'<path d="m13 46 37-31 37 31-8 10-7-6v31H28V50l-7 6z"/><path class="cut" d="M44 58h12v23H44z"/><path class="line" d="M39 39h22"/>',
'<circle cx="47" cy="51" r="30"/><circle class="cut" cx="47" cy="51" r="20"/><path class="line" d="M47 37v15l-12 9M73 15v20m-10-10h20"/>',
'<path d="M17 80V28l13-11h40l13 11v52H67V36H33v44z"/><path class="cut" d="m17 28 16 8-16 9m66-17-16 8 16 9"/><path class="line" d="M44 60h12m-6-6v25"/>',
'<path class="line" d="M50 14v72M19 32l62 36M19 68l62-36M41 20l9 9 9-9M41 80l9-9 9 9M22 44l12-4-2-13M78 56l-12 4 2 13M22 56l12 4-2 13M78 44l-12-4 2-13"/>',
'<path d="M18 41h64v12H18zM29 61h42v18H29z"/><path class="line" d="M20 29c-3-18 63-18 60 0M36 15l9 13-6 11M60 57l-8 10 8 12"/>',
'<path d="M19 23h62v58H19z"/><path class="cut" d="M25 39h50v35H25z"/><path class="line" d="M34 17v13m32-13v13M36 49l25 17m-25 0 25-17"/>',
'<path class="line" d="M47 30 37 20c-17-15-36 9-19 23l16 14c8 7 16 5 23-2M53 70l10 10c17 15 36-9 19-23L66 43c-8-7-16-5-23 2M34 34l32 32"/>',
// Bots: 50 cog, verdict hammer, battery, gas valve, calculator, check shield,
// conveyor, ion orbit, bomb, ammunition belt, furnace, barrels, target,
// multitool, warehouse, reactor, icy gate, duel swords, underground stairs, hex map.
'<path d="m40 14 20 0 4 10 11 1 10 16-6 10 6 10-10 16-11-1-4 10H40l-4-10-11 1-10-16 6-10-6-10 10-16 11-1z"/><text class="cut" x="50" y="62" text-anchor="middle" font-size="31" font-family="sans-serif" font-weight="900">50</text>',
'<path d="m19 33 20-20 25 25-20 20zM52 53l8-8 25 25-8 8zM17 77h44v9H17z"/><path class="cut" d="m29 28 5-5 20 20-5 5z"/>',
'<path d="M41 13h18v10h17v61H24V23h17z"/><path class="cut" d="m54 31-19 28h13l-3 17 20-29H52z"/>',
'<path d="M16 44h68v13H16zM43 30h14v40H43z"/><circle cx="50" cy="35" r="19"/><circle class="cut" cx="50" cy="35" r="11"/><path class="line" d="m34 70 32 14m-32 0 32-14"/>',
'<path d="M25 15h50v70H25z"/><path class="cut" d="M34 25h32v14H34zM34 49h10v10H34zM56 49h10v10H56zM34 68h10v10H34zM56 68h10v10H56z"/>',
'<path d="m50 14 32 13-4 36-28 23-28-23-4-36z"/><path class="cut" d="m29 49 8-8 10 12 17-23 9 8-25 33z"/>',
'<rect x="13" y="57" width="74" height="23" rx="11"/><path class="cut" d="M22 63h56v11H22z"/><path d="M21 29h24v21H21zM55 18h24v32H55z"/><path class="line" d="M28 65v7m22-7v7m22-7v7"/>',
'<ellipse class="line" cx="50" cy="50" rx="34" ry="14" transform="rotate(-35 50 50)"/><ellipse class="line" cx="50" cy="50" rx="34" ry="14" transform="rotate(65 50 50)"/><circle cx="50" cy="50" r="10"/><circle cx="76" cy="30" r="6"/>',
'<circle cx="45" cy="58" r="25"/><path d="m51 32 6-15 15 6-6 16z"/><path class="line" d="m67 20 11-10M82 12v13m-6-7h13"/><path class="cut" d="m29 57 13-15 4 5-13 15z"/>',
'<path d="M19 25h62v52H19z"/><path class="cut" d="M25 34h8v34h-8zM38 34h8v34h-8zM51 34h8v34h-8zM64 34h8v34h-8z"/><path class="line" d="M23 18h54M23 84h54"/>',
'<path d="M21 26h58v57H21zM66 15h12v17H66z"/><path class="cut" d="M29 36h42v38H29z"/><path d="M50 70c-17-6-15-17-7-23l3 7 8-13c11 14 13 24-4 29z"/>',
'<path d="m21 17 24 0v48l-4 19H25l-4-19zM55 17h24v48l-4 19H59l-4-19z"/><circle class="cut" cx="33" cy="32" r="7"/><circle class="cut" cx="67" cy="32" r="7"/><path class="line" d="M25 60h50"/>',
'<circle class="line" cx="50" cy="50" r="30"/><circle class="line" cx="50" cy="50" r="14"/><path class="line" d="M50 10v26m0 28v26M10 50h26m28 0h26"/><circle cx="50" cy="50" r="5"/>',
'<path d="M42 80V53L18 27l5-12 23 26h8l23-26 5 12-24 26v27z"/><path class="line" d="m21 71 56-33M20 62l11 19M73 31l10 18"/>',
'<path d="m12 38 38-23 38 23v45H12z"/><path class="cut" d="M23 46h54v30H23z"/><path d="M29 51h16v19H29zM55 51h16v19H55z"/>',
'<path class="line" d="M34 15h32M29 85h42M38 17l-9 25v23l8 19m25-67 9 25v23l-8 19"/><path d="m50 33 16 25-16 17-16-17z"/><path class="cut" d="m50 42 5 16-5 8-5-8z"/>',
'<path d="M18 20h64v65H68V34H32v51H18z"/><path class="line" d="M50 41v37M36 50l28 18M36 68l28-18"/>',
'<path d="M17 14l13 3 47 56-7 7-53-53zM83 14l-13 3-47 56 7 7 53-53z"/><path class="line" d="m16 66 19 16m30 0 19-16"/>',
'<path d="M17 18h66v12H29v53H17zM37 38h46v12H49v33H37zM57 58h26v12H69v13H57z"/>',
'<path class="line" d="m50 16 29 17v34L50 84 21 67V33zM50 16v68M21 33l58 34M21 67l58-34"/><circle cx="50" cy="50" r="9"/>'
];
if(glyphs.length!==PROGRESS_DEFINITIONS.length)throw Error('One distinct glyph per achievement required');
const folder=new URL('../public/achievements/progress/',import.meta.url);await mkdir(folder,{recursive:true});
for(const [i,d]of PROGRESS_DEFINITIONS.entries()){
  const bot=d.audience==='bot',colors=bot?['#ff774c','#ffbe80','#ff4b4e']:['#41dabb','#a3edff','#e9c673'];
  const accent=colors[i%3],frame=bot?'<path d="m50 3 40 23v48L50 97 10 74V26z"/>':'<circle cx="50" cy="50" r="46"/>';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 100 100"><title>${d.name.en.replaceAll('&','&amp;')}</title><defs><linearGradient id="bg" x2=".8" y2="1"><stop stop-color="#344651"/><stop offset=".5" stop-color="#15232e"/><stop offset="1" stop-color="#080e17"/></linearGradient><linearGradient id="metal" x2=".3" y2="1"><stop stop-color="#fff2d5"/><stop offset=".45" stop-color="${accent}"/><stop offset="1" stop-color="${bot?'#b13b30':'#277b87'}"/></linearGradient></defs><g fill="url(#bg)" stroke="${accent}" stroke-width="2">${frame}</g><path d="M22 22h13M65 78h13" stroke="${accent}" opacity=".4" stroke-width="2"/><g fill="url(#metal)" transform="translate(8 8) scale(.84)">${glyphs[i]}</g><style>.cut{fill:#13212c}.line{fill:none;stroke:${accent};stroke-width:6;stroke-linecap:round;stroke-linejoin:round}</style></svg>\n`;
  await writeFile(new URL(d.id+'.svg',folder),svg);
}
console.log(`Generated ${glyphs.length} distinct SVG achievement icons.`);

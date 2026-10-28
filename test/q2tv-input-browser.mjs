// Manual integration regression: real input, browser zoom, and server-side
// removal after close/abort. Uses only the authorized game server via preview.
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const root='O:/Claude2/_agent_temp/botstats_online_20261028';
async function status(){return new Promise((resolve,reject)=>{const socket=dgram.createSocket('udp4');const timer=setTimeout(()=>{socket.close();reject(Error('status timeout'));},2500);socket.once('message',b=>{clearTimeout(timer);socket.close();resolve(b.toString('latin1'));});socket.send(Buffer.from('\xff\xff\xff\xffstatus\n','latin1'),27950,'91.227.18.67');});}
async function absent(name){for(let n=0;n<12;n++){if(!(await status()).includes('"'+name+'"'))return n*250;await new Promise(r=>setTimeout(r,250));}throw Error('TV remains on game server after close: '+name);}
const browser=await chromium.launch({headless:true,args:['--mute-audio','--enable-unsafe-swiftshader']}),results=[];
try{for(const variant of ['desktop','mobile']){
  const name=variant==='desktop'?'TV-input-D':'TV-input-M';
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1.25});
  await context.route(/\/botstats\/q2tv(?:-mobile)?\/\?/,async route=>{
    const response=await route.fetch();let body=await response.text();
    body=body.replace('Module.locateFile=',`Module.arguments.push('+name','${name}');Module.locateFile=`);
    await route.fulfill({response,body});
  });
  await context.addInitScript(()=>{window.tvIO={sent:0,received:0};const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);const send=this.send.bind(this);this.send=x=>{window.tvIO.sent++;return send(x)};this.addEventListener('message',()=>window.tvIO.received++);}};});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:3085/botstats/?view=online&lang=ru&onlinePlayer='+variant);
  await page.locator('#online-watch:not([disabled])').click();
  const getFrame=()=>page.frames().find(f=>/\/q2tv(?:-mobile)?\//.test(f.url()));
  for(let n=0;n<60;n++){const f=getFrame();if(f&&await f.evaluate(()=>window.q2tvViewerState?.status===2).catch(()=>false))break;await page.waitForTimeout(1000);}
  const frame=getFrame();assert.ok(frame);
  assert.equal(await frame.evaluate(()=>window.q2tvViewerState.status),2);
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'online-watch');
  const connectedStatus=await status();console.log(variant,connectedStatus.split('\n').slice(-6).join(' | '));
  assert.ok(connectedStatus.includes('"'+name+'"'),'unique test spectator is present');
  await page.keyboard.press('Enter');await page.keyboard.press('Space');await page.waitForTimeout(500);assert.ok(!frame.isDetached(),'keys after loading must not close TV');
  for(const zoom of [1,1.25,1.5]){
    await frame.evaluate(z=>{document.documentElement.style.zoom=String(z);},zoom);
    const boxes=await frame.evaluate(()=>{const control=document.querySelector('#controls');const canvas=document.querySelector('#canvas');const button=control?.querySelector('input[type=button]');return {row:control?.getBoundingClientRect().toJSON(),canvas:canvas.getBoundingClientRect().toJSON(),button:button?.getBoundingClientRect().toJSON()};});
    if(boxes.row){assert.ok(boxes.canvas.top>=boxes.row.bottom-1,'canvas outside controls at zoom '+zoom);assert.ok(boxes.button.bottom<=boxes.row.bottom,'fullscreen visible at zoom '+zoom);}
  }
  await frame.evaluate(()=>document.documentElement.style.zoom='1');
  const before=await frame.evaluate(()=>({...window.tvIO}));
  for(let n=0;n<3;n++){
    await frame.locator('#canvas').click({position:{x:300,y:180}});await page.mouse.move(700+n*20,450);await page.keyboard.press('Space');await page.keyboard.press('Enter');await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  const after=await frame.evaluate(()=>({io:window.tvIO,state:window.q2tvViewerState,focus:document.activeElement?.id}));
  assert.ok(after.io.sent>before.sent+100,'native frame loop sends input after mouse/audio activation');assert.ok(after.io.received>before.received+30);assert.equal(after.state.status,2);assert.equal(after.focus,'canvas');assert.deepEqual(errors,[]);
  await frame.evaluate(()=>document.exitPointerLock?.());await page.keyboard.press('Escape');
  await page.locator('#online-fullscreen').click();await page.waitForTimeout(700);assert.ok(await page.evaluate(()=>document.fullscreenElement?.id==='online-player'));
  await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(300);
  await page.locator('#online-player').screenshot({path:root+'/input-fixed-'+variant+'.png'});
  await frame.evaluate(()=>document.exitPointerLock?.());await page.keyboard.press('Escape');await page.locator('#online-close').click();
  assert.ok(frame.isDetached());const removedAfterCloseMs=await absent(name);
  // A native abort closes the socket too, even though WASM cannot disconnect.
  await page.locator('#online-watch').click();
  let crashedFrame;
  for(let n=0;n<60;n++){crashedFrame=getFrame();if(crashedFrame&&await crashedFrame.evaluate(()=>window.q2tvViewerState?.status===2).catch(()=>false))break;await page.waitForTimeout(1000);}
  assert.ok((await status()).includes('"'+name+'"'));
  await crashedFrame.evaluate(()=>Module.onAbort('controlled lifecycle test'));
  const removedAfterAbortMs=await absent(name);
  results.push({variant,before,after,removedAfterCloseMs,removedAfterAbortMs,errors});console.log(JSON.stringify(results.at(-1)));
  await context.close();
}}finally{await browser.close();await writeFile(root+'/input-regression.json',JSON.stringify(results,null,2));}

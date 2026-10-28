// Explicit manual integration test only: this joins as a spectator on the one
// authorized server via the loopback PO preview, then attempts a blocked join.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const evidence='O:/Claude2/_agent_temp/botstats_online_20261028';
const browser=await chromium.launch({headless:true,args:['--mute-audio','--enable-unsafe-swiftshader']});
const results=[];
try{
  for(const variant of (process.env.Q2TV_VARIANTS||'desktop,mobile').split(',')){
    const context=await browser.newContext({viewport:{width:1100,height:850}});
    await context.addInitScript(()=>{
      const Native=window.WebSocket;
      window.WebSocket=class extends Native{
        constructor(...args){
          super(...args);window.testTVSocket=this;const send=this.send.bind(this);
          this.send=data=>{
            const a=data instanceof ArrayBuffer?new Uint8Array(data):ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):null;
            if(a&&a.length>6){
              const view=new DataView(a.buffer,a.byteOffset,a.byteLength);
              if(view.getInt32(2,true)===-1){const m=/^connect (\d+) (\d+)/.exec(new TextDecoder().decode(a.subarray(6)));if(m)this.testHeader=8+(m[1]==='34'?2:Number(m[2])?1:0);}
              else if(this.testJoin&&this.testHeader){
                this.testJoin=false;const cmd=new TextEncoder().encode('join\0'),offset=2+this.testHeader,next=new Uint8Array(a.length+cmd.length+1);
                next.set(a.subarray(0,offset));next[offset]=4;next.set(cmd,offset+1);next.set(a.subarray(offset),offset+1+cmd.length);new DataView(next.buffer).setUint16(0,next.length-2,true);data=next.buffer;
              }
            }
            send(data);
          };
        }
      };
    });
    const page=await context.newPage(),errors=[];let received=0;
    page.on('pageerror',e=>{errors.push(e.message);console.log(variant,'ERROR',e.message);});page.on('websocket',socket=>socket.on('framereceived',()=>received++));
    await page.goto(`http://127.0.0.1:3085/botstats/?view=online&lang=ru&theme=dark&onlinePlayer=${variant}`);
    await page.waitForSelector('.online-name');await page.locator('#online-watch').click();
    for(let n=0;n<9&&received<120;n++){await page.waitForTimeout(10000);console.log(variant,'elapsed',(n+1)*10,'frames',received);if(errors.length)break;}
    if(errors.length||received<120){await page.screenshot({path:evidence+`/failed-${variant}.png`});console.log(await page.frames().at(-1).evaluate(()=>document.body.innerText.slice(-1800)));}
    assert.ok(received>=120,'Require active game stream, not just WebSocket handshake/keepalives');
    const frame=page.frames().find(f=>f.url().includes('/q2tv/'))||page.frames().find(f=>f.url().includes('/q2tv-mobile/'));
    const metrics=async()=>await(await fetch('http://127.0.0.1:39030/preview-metrics')).json();
    const before=await metrics(),frameCount=received;
    await frame.evaluate(()=>{window.testTVSocket.testJoin=true;});await page.waitForTimeout(3000);
    const after=await metrics();assert.ok((after.blockedCommands.join||0)>(before.blockedCommands.join||0),'join blocked at gateway');assert.ok(received>frameCount+10,'viewing continues after blocked join');
    assert.equal(await frame.evaluate(()=>window.q2tvViewerState?.status),2,'Q2TV remains a spectator after blocked join');
    // The engine may hold pointer lock; release it as the user does with Esc
    // before interacting with controls outside the canvas.
    await frame.evaluate(()=>document.exitPointerLock?.());
    // Status refresh and theme changes must not replace/reconnect the player.
    const identity=await frame.evaluate(()=>{window.previewIdentity='keep-player';return true;});
    await page.locator('#online-reload').click();await page.locator('#theme').selectOption('light');await page.waitForTimeout(1000);assert.equal(await frame.evaluate(()=>window.previewIdentity),'keep-player');
    await page.locator('#online-player').screenshot({path:evidence+`/verified-${variant}.png`});
    await frame.evaluate(()=>document.exitPointerLock?.());await page.keyboard.press('Escape');await page.waitForTimeout(200);
    const detached=page.waitForEvent('framedetached',{predicate:f=>f===frame});await page.locator('#online-close').click();await detached;assert.equal(page.frames().length,1);
    assert.deepEqual(errors,[]);results.push({variant,received,before,after,errors,refreshPreservesPlayer:identity});await context.close();
  }
}finally{await browser.close();await writeFile(evidence+'/live-verified.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));

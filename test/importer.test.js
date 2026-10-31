import {testPath} from './support/paths.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,utimes} from 'node:fs/promises';
import {runOnce} from '../src/importer.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter,once} from 'node:events';
import {Readable,PassThrough} from 'node:stream';
import {createServer} from 'node:http';
import path from 'node:path';

function mockBuiltin(t,object,name,replacement){
  t.mock.method(object,name,replacement);syncBuiltinESMExports();
  t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();});
}
async function incoming(t){
  const root=await fs.mkdtemp(testPath('import-race-'));
  await mkdir(path.join(root,'incoming'));
  return {root,config:{sourceDir:path.join(root,'incoming'),queueDir:path.join(root,'queue'),decoder:'fixture-decoder',apiUrl:'http://127.0.0.1:1/botstats',settleSeconds:0}};
}
function decoderFixture(t){
  // The native decoder is unchanged: isolate it with its real NDJSON contract.
  const events=[
    {kind:'configstring',index:1312,text:'Noob-X[25]\\male/grunt'},
    {kind:'configstring',index:1313,text:'Gils\\male/grunt'},
    {kind:'configstring',index:1568,text:'Noob-X[25]'},
    {kind:'configstring',index:1569,text:'Gils'},
    {kind:'configstring',index:1572,text:'5:00'},
    {kind:'configstring',index:1574,text:'Match'},
    {kind:'segment_facts',map:'q2duel5',end_ms:300000},
    {kind:'print',level:2,text:'Fight!\n'},
    {kind:'player_state',slot:0,stats:Array.from({length:32},(_,i)=>({1:100,18:1568,19:1569,22:1572,26:1574}[i]||0))},
    {kind:'print',time_ms:300000,level:2,text:'Noob-X[25] wins, 2 to -1.\n'},
    {kind:'decode_result',return_code:0,quality:0}
  ].map(event=>JSON.stringify({...event,segment:0,time_ms:event.time_ms||0})+'\n');
  mockBuiltin(t,childProcess,'spawn',()=>{
    const child=new EventEmitter();child.exitCode=null;child.stdout=Readable.from(events);child.stderr=new PassThrough();
    child.kill=()=>{};
    child.stdout.on('end',()=>setImmediate(()=>{child.exitCode=0;child.stderr.end();child.emit('close',0);}));
    return child;
  });
}

test('rename between directory scan and stat does not abort other files; next scan imports the new name once',async t=>{
  const {config}=await incoming(t);
  const old=path.join(config.sourceDir,'2026-10-31_00-09-33_q2duel5_Noob-X[25]-vs-Gils-defence_002.mvd2');
  const renamed=old.replace('_002.mvd2','_2--1_002.mvd2');
  await writeFile(old,Buffer.from('MVD2\0\0'));
  await writeFile(path.join(config.sourceDir,'z-other.mvd2'),'invalid');
  const realStat=fs.stat;let changed=false;
  mockBuiltin(t,fs,'stat',async(file,...args)=>{
    if(file===old&&!changed){changed=true;await fs.rename(old,renamed);}
    return realStat(file,...args);
  });
  const first=await runOnce(config);
  assert.equal(changed,true);assert.equal(first.pending,1);assert.equal(first.ignored,1);assert.equal(first.errors.length,0);
  decoderFixture(t);
  const manifests=[],uploads=[];
  const server=createServer(async(req,res)=>{
    const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);
    if(req.method==='PUT')uploads.push(body);else manifests.push(JSON.parse(body));
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({accepted:true,duplicate:false}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  config.apiUrl=`http://127.0.0.1:${server.address().port}/botstats`;
  const second=await runOnce(config);
  assert.equal(second.imported,1);assert.deepEqual(second.errors,[]);
  assert.equal(manifests.length,1);assert.equal(manifests[0].demo.originalName,path.basename(renamed));
  assert.deepEqual(uploads,[Buffer.from('MVD2\0\0')]);
  const third=await runOnce(config);assert.equal(third.skipped,1);assert.equal(uploads.length,1);
});

test('temporary stat access failure is retried without recording the demo as ignored',async t=>{
  const {config}=await incoming(t);const file=path.join(config.sourceDir,'locked.mvd2');await writeFile(file,'invalid');
  const realStat=fs.stat;let fail=true;
  mockBuiltin(t,fs,'stat',async(name,...args)=>{
    if(name===file&&fail){fail=false;throw Object.assign(new Error('temporary access denied'),{code:'EACCES'});}
    return realStat(name,...args);
  });
  const first=await runOnce(config);assert.equal(first.ignored,0);assert.equal(first.errors.length,1);
  const second=await runOnce(config);assert.equal(second.ignored,1);assert.deepEqual(second.errors,[]);
});

test('rename after parsing but before upload remains retryable under the new name',async t=>{
  const {config}=await incoming(t),old=path.join(config.sourceDir,'2026-10-31_00-09-33_q2duel5_Noob-X[25]-vs-Gils-defence_002.mvd2');
  const renamed=old.replace('_002.mvd2','_2--1_002.mvd2');await writeFile(old,Buffer.from('MVD2\0\0'));
  decoderFixture(t);
  const server=createServer(async(req,res)=>{
    for await(const part of req){}res.writeHead(200,{'content-type':'application/json'});res.end('{"accepted":true,"duplicate":false}');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  config.apiUrl=`http://127.0.0.1:${server.address().port}/botstats`;
  const realRename=fs.rename;let moved=false;
  mockBuiltin(t,fs,'rename',async(from,to)=>{
    if(to.startsWith(config.queueDir)&&to.endsWith('.json')&&!to.endsWith('state.json')&&!moved){moved=true;await realRename(old,renamed);}
    return realRename(from,to);
  });
  const first=await runOnce(config);assert.equal(moved,true);assert.equal(first.errors.length,1);assert.equal(first.imported,0);
  const state=Object.values(JSON.parse(await readFile(path.join(config.queueDir,'state.json'),'utf8')));
  assert.equal(state[0].done,false);assert.notEqual(state[0].ignored,true);
  const second=await runOnce(config);assert.equal(second.imported,1);assert.deepEqual(second.errors,[]);
});

test('a disappearing nested directory does not prevent scanning the remaining directories',async t=>{
  const {config}=await incoming(t);const gone=path.join(config.sourceDir,'a-moving');await mkdir(gone);
  const healthy=path.join(config.sourceDir,'b-healthy');await mkdir(healthy);await writeFile(path.join(healthy,'demo.mvd2'),'invalid');
  const realRead=fs.readdir;let moved=false;
  mockBuiltin(t,fs,'readdir',async(dir,...args)=>{
    if(dir===gone&&!moved){moved=true;await fs.rename(gone,gone+'-new');}
    return realRead(dir,...args);
  });
  const result=await runOnce(config);assert.equal(moved,true);assert.equal(result.ignored,1);assert.equal(result.errors.length,1);
  assert.deepEqual((await runOnce(config)).errors,[]);
});

test('real watch process survives a scan failure and a queue read failure, then resumes without a restart',{timeout:12000},async t=>{
  const {root,config}=await incoming(t);config.pollSeconds=0.03;
  const missing=config.sourceDir+'-away';await fs.rename(config.sourceDir,missing);
  const configFile=path.join(root,'watch.json');await writeFile(configFile,JSON.stringify(config));
  const proc=childProcess.spawn(process.execPath,['src/importer.js',configFile,'--watch'],{cwd:path.resolve(import.meta.dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';proc.stdout.on('data',b=>{output+=b;});proc.stderr.on('data',b=>{output+=b;});
  const closed=new Promise(resolve=>proc.once('close',resolve));
  t.after(async()=>{if(proc.exitCode===null)proc.kill();await closed;});
  const waitFor=async(predicate)=>{const deadline=Date.now()+7000;while(!predicate()){
    assert.equal(proc.exitCode,null,output);assert.ok(Date.now()<deadline,output);await new Promise(r=>setTimeout(r,20));
  }};
  await waitFor(()=>output.includes('ENOENT'));
  const state=path.join(config.queueDir,'state.json');await writeFile(state,'{broken');
  output='';await waitFor(()=>output.includes('JSON'));
  assert.equal(await readFile(state,'utf8'),'{broken');
  await writeFile(state,'{}');await fs.rename(missing,config.sourceDir);
  await writeFile(path.join(config.sourceDir,'recovered.mvd2'),'invalid');
  await waitFor(()=>output.includes('"file":"recovered.mvd2"'));
  await waitFor(()=>{
    try{return Object.values(JSON.parse(fsSync.readFileSync(state,'utf8'))).length===1;}catch{return false;}
  });
  assert.equal(proc.exitCode,null);
});

test('watcher excludes DM2, remembers invalid MVD and retries an unfinished file only when it changes',async()=>{
  const root=testPath('import-filter-')+Date.now();
  await mkdir(root+'/incoming',{recursive:true});
  await writeFile(root+'/incoming/demo.dm2','not an MVD');
  await writeFile(root+'/incoming/bad.mvd2','not an MVD');
  await writeFile(root+'/incoming/recording.mvd2',Buffer.from('4d5644320300010203','hex'));
  const config={sourceDir:root+'/incoming',queueDir:root+'/queue',decoder:'not-invoked.exe',apiUrl:'http://127.0.0.1:1/botstats',settleSeconds:0};
  const first=await runOnce(config);assert.equal(first.ignored,1);assert.equal(first.pending,1);assert.equal(first.errors.length,0);
  const before=await readFile(root+'/queue/state.json','utf8');assert.equal(Object.keys(JSON.parse(before)).length,2);
  const second=await runOnce(config);assert.equal(second.ignored,1);assert.equal(second.pending,1);assert.equal(await readFile(root+'/queue/state.json','utf8'),before);
  await writeFile(root+'/incoming/recording.mvd2','changed invalid recording');await utimes(root+'/incoming/recording.mvd2',new Date(),new Date());
  const third=await runOnce(config);assert.equal(third.ignored,2);assert.equal(third.pending,0);assert.equal(third.errors.length,0);
});

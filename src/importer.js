import {readFile,writeFile,mkdir,readdir,stat,rename,open} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseMvd,PARSER_VERSION} from './parser.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const atomicJson=async(file,data)=>{await writeFile(file+'.tmp',JSON.stringify(data,null,2));await rename(file+'.tmp',file);};
const reportError=(summary,file,e)=>{summary.errors.push({file,error:e.message,code:e.code});console.error(file,e.message);};
async function files(dir,onError){
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true});}
  catch(e){onError(dir,e);return [];}
  const out=[];
  for(const e of entries){
    if(e.isSymbolicLink())continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())out.push(...await files(p,onError));
    else if(e.isFile()&&/\.mvd2$/i.test(e.name))out.push(p);
  }
  return out.sort();
}
async function* demoBytes(file){
  // Open lazily inside the awaited body iterator. An eager ReadStream can emit
  // ENOENT before fetch has attached its reader when a demo is renamed.
  const handle=await open(file,'r');
  try{yield* handle.createReadStream({autoClose:false});}
  finally{await handle.close();}
}
export async function sendManifest(config,file,manifest){
  const base=config.apiUrl.replace(/\/$/,''),headers={'x-ingest-token':config.ingestToken};
  const url=new URL(base);if(url.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Remote ingest requires HTTPS');
  let r=await fetch(`${base}/api/ingest/demos/${manifest.demo.sha256}`,{method:'PUT',headers:{...headers,'content-type':'application/octet-stream'},body:demoBytes(file),duplex:'half',signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw new Error(`Demo upload HTTP ${r.status}: ${await r.text()}`);
  r=await fetch(`${base}/api/ingest/manifests`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(manifest),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`Manifest HTTP ${r.status}: ${await r.text()}`);return r.json();
}
export async function runOnce(config,{force=false}={}){
  const queue=path.resolve(root,config.queueDir||'data/queue');await mkdir(queue,{recursive:true});
  const stateFile=path.join(queue,'state.json');let state=JSON.parse(await readFile(stateFile,'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
  const summary={imported:0,skipped:0,ignored:0,pending:0,errors:[]};
  for(const file of await files(config.sourceDir,(dir,e)=>reportError(summary,dir,e))){
    let info;
    try{info=await stat(file);}
    catch(e){
      // A recording can be renamed to include its score after enumeration.
      // Do not cache a failure for that stale path: the next poll discovers
      // the new name. Other stat errors are visible and retried as well.
      if(e.code==='ENOENT'||e.code==='ENOTDIR')summary.pending++;
      else reportError(summary,file,e);
      continue;
    }
    if(!info.isFile()){summary.pending++;continue;}
    const key=createHash('sha256').update(config.apiUrl+'\n'+path.resolve(file)).digest('hex'),prev=state[key];
    if(Date.now()-info.mtimeMs<(config.settleSeconds??15)*1000){summary.pending++;continue;}
    if(!force&&prev?.size===info.size&&prev?.mtimeMs===info.mtimeMs&&prev?.version===PARSER_VERSION&&prev?.done){summary.skipped++;continue;}
    if(!force&&prev?.size===info.size&&prev?.mtimeMs===info.mtimeMs&&prev?.version===PARSER_VERSION&&(prev?.ignored||prev?.pending)){if(prev.ignored)summary.ignored++;else summary.pending++;continue;}
    if(!force&&prev?.size===info.size&&prev?.mtimeMs===info.mtimeMs&&prev?.nextRetryAt>Date.now()){summary.pending++;continue;}
    try{
      const manifest=await parseMvd(file,config.decoder,config);
      await atomicJson(path.join(queue,manifest.demo.sha256+'.json'),manifest);
      const ack=await sendManifest(config,file,manifest);
      state[key]={file,size:info.size,mtimeMs:info.mtimeMs,version:PARSER_VERSION,sha256:manifest.demo.sha256,done:ack.accepted};
      summary.imported++;console.log(JSON.stringify({file:path.basename(file),recordedAt:manifest.demo.recordedAt,parserVersion:manifest.parserVersion,matches:manifest.matches.map(m=>({map:m.map,score:m.participants.map(p=>p.score),status:m.status,full:m.statsComplete,startConfirmed:m.startObserved})),duplicate:ack.duplicate}));
    }catch(e){
      if(['MVD_INVALID','MVD_NOT_CLOSED','MVD_TOO_LARGE','MVD_DECODE_FAILED','MVD_DECODE_LIMIT','MVD_DECODE_TIMEOUT','MVD_UNSUPPORTED'].includes(e.code)){
        const pending=e.code==='MVD_NOT_CLOSED';
        state[key]={file,size:info.size,mtimeMs:info.mtimeMs,version:PARSER_VERSION,done:false,ignored:!pending,pending,reason:e.code,error:e.message};
        if(pending)summary.pending++;else {summary.ignored++;console.log(JSON.stringify({file:path.basename(file),ignored:true,reason:e.code,message:e.message}));}
      }else {const attempts=prev?.size===info.size&&prev?.mtimeMs===info.mtimeMs?(prev?.attempts||0)+1:1;state[key]={file,size:info.size,mtimeMs:info.mtimeMs,done:false,error:e.message,attempts,nextRetryAt:Date.now()+Math.min(3600000,10000*2**Math.min(attempts,8))};summary.errors.push({file,error:e.message});console.error(path.basename(file),e.message);}
    }
    await atomicJson(stateFile,state);
  }
  return summary;
}
const entryScript=process.env.pm_exec_path||process.argv[1];
if(entryScript&&path.resolve(entryScript)===fileURLToPath(import.meta.url)){
  const config=JSON.parse(await readFile(process.argv[2]||path.join(root,'importer.local.json'),'utf8'));
  const watch=process.argv.includes('--watch'),force=process.argv.includes('--force');
  do{
    let result;
    try{result=await runOnce(config,{force});}
    catch(e){
      // Queue/directory failures must not kill a long-running watcher.
      // Keep the existing state intact and retry through the normal poll.
      result={imported:0,skipped:0,ignored:0,pending:0,errors:[]};
      reportError(result,'importer cycle',e);
    }
    if(!watch||result.imported||result.errors.length)console.log(JSON.stringify(result));
    if(!watch){if(result.errors.length)process.exitCode=1;break;}
    await new Promise(r=>setTimeout(r,(config.pollSeconds||10)*1000));
  }while(watch);
}

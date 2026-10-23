import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,existsSync,statSync,renameSync,mkdirSync,unlinkSync,openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const role=process.argv[2];if(!['server','importer'].includes(role))throw new Error('Choose server or importer');
const configFile=path.join(root,role==='server'?'server.production.json':'importer.production.json');
const config=JSON.parse(readFileSync(configFile,'utf8'));
if(!config.ingestToken||config.ingestToken.length<32)throw new Error('Missing ingest token');
if(role==='importer'&&(!config.sourceDir||!existsSync(config.sourceDir)))throw new Error('Set sourceDir to the existing MVD folder in importer.production.json');
if(role==='importer')config.decoder=path.resolve(root,config.decoder);
const data=path.join(root,'data');mkdirSync(data,{recursive:true});
const lock=path.join(data,role+'.lock.json');
if(existsSync(lock)){
  const prior=JSON.parse(readFileSync(lock,'utf8'));let alive=true;
  try{process.kill(prior.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
  if(alive)throw new Error(`An instance may already be running (PID ${prior.pid}); close it before starting another`);
  unlinkSync(lock);
}
const descriptor=openSync(lock,'wx');writeFileSync(descriptor,JSON.stringify({pid:process.pid,role,root}));closeSync(descriptor);
let child,stopping=false,timer;
const log=path.join(data,role+'.log');
function record(chunk){
  if(existsSync(log)&&statSync(log).size>5*1024*1024){
    if(existsSync(log+'.3'))unlinkSync(log+'.3');
    for(let n=2;n>=1;n--)if(existsSync(log+'.'+n))renameSync(log+'.'+n,log+'.'+(n+1));
    renameSync(log,log+'.1');
  }
  appendFileSync(log,chunk);
}
function start(){
  if(stopping)return;
  const entry=path.join(root,'src',role==='server'?'server.js':'importer.js');
  const args=[entry,configFile,...(role==='importer'?['--watch']:[])];
  record(`\n[${new Date().toISOString()}] Starting ${role}\n`);
  child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',record);child.stderr.on('data',record);
  child.once('error',error=>record('Start error: '+error.message+'\n'));
  child.once('close',(code)=>{record(`Exited: ${code}\n`);child=null;if(stopping)process.exit(0);else timer=setTimeout(start,10000);});
}
function stop(){stopping=true;clearTimeout(timer);if(child)child.kill();else process.exit(0);}
for(const signal of ['SIGINT','SIGTERM','SIGBREAK'])process.on(signal,stop);
process.on('exit',()=>{if(child)child.kill();if(existsSync(lock)&&JSON.parse(readFileSync(lock,'utf8')).pid===process.pid)unlinkSync(lock);});
console.log(`BotStats ${role}; log: ${log}. Ctrl+C stops this instance.`);start();

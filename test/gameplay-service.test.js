import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,utimes} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createService} from '../src/server.js';
import {sendManifest,runOnce} from '../src/importer.js';
import {parseMvd,PARSER_VERSION} from '../src/parser.js';
import {testPath} from './support/paths.js';
import {matchPoints} from '../public/rating.js';

test('native reimport upgrades the old manifest, survives Mongo reload, preserves IDs/ratings and skips unchanged files',{
  skip:!process.env.BOTSTATS_GAMEPLAY_REFERENCE,timeout:30000
},async()=>{
  const reference=JSON.parse(await readFile(process.env.BOTSTATS_GAMEPLAY_REFERENCE,'utf8'));
  const suffix=randomBytes(5).toString('hex'),root=testPath('gameplay-api-'+suffix);
  const sourceDir=path.join(root,'incoming');await mkdir(sourceDir,{recursive:true});
  const file=path.join(sourceDir,path.basename(reference.mvd));await copyFile(reference.mvd,file);await utimes(file,new Date(0),new Date(0));
  const config={mongoUri:'mongodb://127.0.0.1:27017',database:'q2pro_botstats_gameplay_'+suffix,ingestToken:randomBytes(32).toString('hex'),storageDir:path.join(root,'storage'),basePath:'/botstats',sourceDir,queueDir:path.join(root,'queue'),settleSeconds:0,decoder:fileURLToPath(new URL('../bin/mvd-decoder.exe',import.meta.url))};
  const manifest=await parseMvd(file,config.decoder),old=structuredClone(manifest);old.parserVersion='0.2.0';
  for(const m of old.matches){delete m.gameplay;delete m.recordedSettings;}
  let service=await createService(config),server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  config.apiUrl=`http://127.0.0.1:${server.address().port}/botstats`;
  try{
    assert.equal((await sendManifest(config,file,old)).accepted,true);
    await mkdir(config.queueDir,{recursive:true});
    const key=createHash('sha256').update(config.apiUrl+'\n'+path.resolve(file)).digest('hex');
    await writeFile(path.join(config.queueDir,'state.json'),JSON.stringify({[key]:{file,size:manifest.demo.size,mtimeMs:0,version:'0.2.0',sha256:manifest.demo.sha256,done:true}}));
    const result=await runOnce(config);assert.equal(result.imported,1);assert.deepEqual(result.errors,[]);
    assert.equal((await runOnce(config)).skipped,1);
    const state=JSON.parse(await readFile(path.join(config.queueDir,'state.json'),'utf8'));assert.equal(state[key].version,PARSER_VERSION);assert.equal(state[key].sha256,old.demo.sha256);
    const matches=await service.store.list({});assert.equal(matches.total,1);assert.equal(matches.items[0].id,old.matches[0].id);assert.equal(matches.items[0].gameplay,undefined);assert.equal(matches.items[0].recordedSettings,undefined);
    await new Promise(r=>server.close(r));await service.store.close();
    service=await createService(config);server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const detail=await(await fetch(`http://127.0.0.1:${server.address().port}/botstats/api/matches/${manifest.matches[0].id}`)).json();
    assert.deepEqual(detail.gameplay,manifest.matches[0].gameplay);assert.deepEqual(detail.recordedSettings,JSON.parse(JSON.stringify(manifest.matches[0].recordedSettings)));
    assert.equal(detail.recordedSettings.snapshots.length,8);assert.equal(detail.gameplay.history.length,6);
    assert.deepEqual(detail.rating.points,[0,1].map(i=>matchPoints(old.matches[0],i)));
    assert.equal((await service.store.demo(old.demo.sha256)).parserVersion,PARSER_VERSION);
  }finally{await new Promise(r=>server.close(r));await service.store.close();}
});

// Opt-in private reference: native decoder -> parser; no game process or upload.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Collector,summarize,recordingDateFromName,PARSER_VERSION} from '../src/parser.js';
import {assembleSettings} from '../src/match-settings.js';
import {testPath} from './support/paths.js';
import path from 'node:path';
const reference=process.env.BOTSTATS_GAMEPLAY_REFERENCE;
if(!reference)throw Error('Set BOTSTATS_GAMEPLAY_REFERENCE to the private recording-check.json');
const expected=JSON.parse(await readFile(reference,'utf8')),file=expected.mvd;
const inventory=JSON.parse(await readFile(new URL('../src/mvd-gameplay-inventory.json',import.meta.url),'utf8'));
assert.deepEqual(inventory.parameters,Object.keys(expected.snapshots['1'].effective).sort());
assert.ok(inventory.projection.every(k=>inventory.parameters.includes(k)));assert.equal(inventory.projection.length,145);
if(process.env.BOTSTATS_GAMEPLAY_PROJECTION){
  const projection=JSON.parse(await readFile(process.env.BOTSTATS_GAMEPLAY_PROJECTION,'utf8'));
  assert.equal(inventory.factoryFingerprint,projection.fingerprint);
  assert.deepEqual(inventory.projection,projection.fields.filter(f=>f.scope==='gameplay').map(f=>f.cvar).sort());
}
const bytes=await readFile(file),sha=createHash('sha256').update(bytes).digest('hex');assert.equal(sha,expected.mvd_sha256);
const decoder=fileURLToPath(new URL('../bin/mvd-decoder.exe',import.meta.url));
const child=spawn(decoder,[file],{windowsHide:true,stdio:['ignore','pipe','pipe']});
const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
const c=new Collector();let errors='';child.stderr.on('data',b=>errors+=b);
for await(const line of createInterface({input:child.stdout}))c.accept(JSON.parse(line));
assert.equal(await done,0,errors);assert.equal(c.result.return_code,0);assert.equal(c.result.quality,0);
const data=assembleSettings(c.part(0).metadata);assert.equal(data.unparsed.length,0);assert.equal(data.snapshots.length,8);
for(const s of data.snapshots){
  const e=expected.snapshots[s.snapshot];assert.equal(s.complete,true,JSON.stringify(s.completeness));
  assert.deepEqual({...s.params},e.effective);assert.deepEqual({...s.baseParams},e.configured);
  assert.deepEqual(s.gameplay,e.gameplay);assert.deepEqual(s.settings,e.settings);assert.deepEqual(s.bots,e.bots);
}
const meta={sha256:sha,size:bytes.length,originalName:path.basename(file),recordedAt:recordingDateFromName(path.basename(file)),dateSource:'filename'};
const manifest=summarize(c,meta),dir=testPath('native');await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(dir,'snapshots.json'),JSON.stringify(data,null,2));
const report={parserVersion:PARSER_VERSION,sha,decoderSha256:createHash('sha256').update(await readFile(decoder)).digest('hex'),snapshots:data.snapshots.length,allEffectiveAndConfiguredFieldsEqual:true,bots:data.snapshots.reduce((n,s)=>n+s.bots.length,0),matches:manifest.matches.map(m=>({id:m.id,status:m.status,startObserved:m.startObserved,preset:m.gameplay?.preset,history:m.gameplay?.history.map(h=>({at:h.at,snapshot:h.snapshot,changes:h.changes.length}))})),privateFixtureOnly:true};
await writeFile(path.join(dir,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

import {testPath} from './support/paths.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,utimes} from 'node:fs/promises';
import {runOnce} from '../src/importer.js';

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

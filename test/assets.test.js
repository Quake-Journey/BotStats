import {testPath} from './support/paths.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {loadAssets} from '../src/assets.js';

test('dependency-only updates invalidate the whole browser asset graph; served snapshots stay consistent',async()=>{
  const root=testPath();await mkdir(root,{recursive:true});
  const dir=await mkdtemp(root+'/asset-cache-');
  await writeFile(dir+'/index.html','<script type="module" src="./assets/app.js"></script>');
  await writeFile(dir+'/app.js','import {value} from "./rating.js";');
  await writeFile(dir+'/rating.js','export const value=1;');
  const first=await loadAssets(dir),same=await loadAssets(dir);assert.equal(first.revision,same.revision);
  await writeFile(dir+'/rating.js','export const value=2;');
  const next=await loadAssets(dir);
  assert.notEqual(next.revision,first.revision,'Dependency change invalidates the entry URL too');
  assert.match(next.html,new RegExp('/'+next.revision+'/app.js'));
  const entry=new URL('./assets/'+next.revision+'/app.js','https://example.test/botstats/');
  assert.equal(new URL('./rating.js',entry).pathname,'/botstats/assets/'+next.revision+'/rating.js');
  assert.equal(first.files.get('rating.js').toString(),'export const value=1;','An active service snapshot cannot mix edited files');
  assert.equal(next.files.get('rating.js').toString(),'export const value=2;');
});

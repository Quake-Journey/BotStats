import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// One content-addressed snapshot per service start. Relative module imports stay
// in the same revision directory, so a cached dependency cannot mix releases.
export async function loadAssets(directory){
  const files=new Map();
  async function collect(relative=''){
    for(const entry of await readdir(path.join(directory,relative),{withFileTypes:true})){
      if(entry.name.startsWith('.'))continue;
      const name=relative?relative+'/'+entry.name:entry.name;
      if(entry.isDirectory())await collect(name);
      else if(entry.isFile())files.set(name,await readFile(path.join(directory,name)));
    }
  }
  await collect();
  const hash=createHash('sha256');
  for(const name of [...files.keys()].sort())hash.update(name+'\0').update(files.get(name)).update('\0');
  const revision=hash.digest('hex').slice(0,20);
  const html=files.get('index.html').toString('utf8').replaceAll('./assets/',`./assets/${revision}/`);
  files.delete('index.html');
  return {revision,html,files};
}

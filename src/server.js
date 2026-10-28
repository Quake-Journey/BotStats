import express from 'express';
import Ajv from 'ajv';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { loadAssets } from './assets.js';
import { completeScoreHistory } from '../public/score-history.js';
import { attachOnline } from './online.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hashPattern=/^[a-f0-9]{64}$/;
const ajv=new Ajv({strict:false,allErrors:false});
const validate=ajv.compile({type:'object',additionalProperties:false,required:['schemaVersion','parserVersion','demo','matches'],properties:{
  schemaVersion:{const:1},parserVersion:{type:'string',pattern:'^[0-9]+\\.[0-9]+\\.[0-9]+$'},
  demo:{type:'object',additionalProperties:false,required:['sha256','size','originalName','recordedAt','dateSource'],properties:{sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},size:{type:'integer',minimum:6,maximum:134217728},originalName:{type:'string',maxLength:240,pattern:'^[^/\\\\]+\\.mvd2$'},recordedAt:{type:['string','null'],maxLength:40},dateSource:{enum:['filename',null]}}},
  matches:{type:'array',minItems:1,maxItems:100,items:{type:'object',required:['id','map','participants','status','winnerIndex','statsComplete','startedAt'],properties:{
    id:{type:'string',pattern:'^[a-f0-9]{64}-[0-9]+-[0-9]+$'},map:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,64}$'},
    status:{enum:['completed','interrupted','forfeit']},winnerIndex:{enum:[0,1,null]},statsComplete:{type:'boolean'},startedAt:{type:['string','null'],maxLength:40},
    participants:{type:'array',minItems:2,maxItems:2,items:{type:'object',required:['name','score','isBot','stats'],properties:{name:{type:'string',minLength:1,maxLength:128},score:{type:'integer',minimum:-100000,maximum:100000},isBot:{type:'boolean'},stats:{type:['object','null']},skill:{type:['number','null'],minimum:0,maximum:250},style:{enum:['default','arcade','defence','chaotic',null]}}}}
  }}}
}});

export async function createService(config) {
  if(!config.ingestToken||config.ingestToken.length<32||config.ingestToken.startsWith('REPLACE_'))throw new Error('Configure a private ingest token of at least 32 characters');
  const base=config.basePath||'/botstats';if(!/^\/[a-z0-9_-]+$/.test(base))throw new Error('Invalid basePath');
  const storage=path.resolve(root,config.storageDir||'data'),demoRoot=path.join(storage,'demos'),staging=path.join(storage,'staging');
  await mkdir(demoRoot,{recursive:true});await mkdir(staging,{recursive:true});
  const assets=await loadAssets(path.join(root,'public'));
  if(config.previewExamples===true)assets.html=assets.html.replace('<div id="content"',
    '<aside class="warning preview-notice">Локальная проверка / Local preview. Игроки «Пример …» — демонстрационные сценарии режимов, не реальные матчи. Производственная статистика не меняется. / Players named “Пример …” are test scenarios, not real games; production statistics are unchanged.</aside><div id="content"');
  const store=await openStore(config),app=express();app.disable('x-powered-by');app.enable('strict routing');
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});next();});
  const bindOnlineSockets=await attachOnline(app,base,config.online);
  app.get(base,(req,res)=>res.redirect(308,base+'/'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'')));
  const api=express.Router();app.use(base,api);
  const authorize=(req,res,next)=>{const supplied=Buffer.from(req.headers['x-ingest-token']||''),expected=Buffer.from(config.ingestToken);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(401).json({error:'Unauthorized'});next();};
  let uploads=0;
  api.put('/api/ingest/demos/:sha',authorize,async(req,res,next)=>{
    const sha=req.params.sha;if(!hashPattern.test(sha))return res.status(400).json({error:'Invalid SHA-256'});
    if(uploads>=2)return res.status(429).json({error:'Ingest busy; retry later'});
    const dest=path.join(demoRoot,sha+'.mvd2'),temp=path.join(staging,randomUUID()+'.part');uploads++;
    try {
      let length=0;const hash=createHash('sha256');
      const limiter=new Transform({transform(chunk,encoding,done){length+=chunk.length;if(length>(config.maxDemoBytes||134217728))return done(Object.assign(new Error('Demo too large'),{status:413}));hash.update(chunk);done(null,chunk);}});
      await pipeline(req,limiter,createWriteStream(temp,{flags:'wx'}));
      if(hash.digest('hex')!==sha)throw Object.assign(new Error('SHA-256 mismatch'),{status:422});
      const existing=await stat(dest).catch(()=>null);
      if(existing){if(existing.size!==length)throw new Error('Stored demo size conflict');await unlink(temp);}else await rename(temp,dest);
      res.json({sha256:sha,size:length,stored:true});
    } catch(e){await unlink(temp).catch(()=>{});next(e);}finally{uploads--;}
  });
  api.post('/api/ingest/manifests',authorize,express.json({limit:'8mb'}),async(req,res,next)=>{
    try {
      const m=req.body;
      if(!validate(m)||m.matches.some(x=>!x.id.startsWith(m.demo.sha256+'-')||x.participants.filter(p=>p.isBot).length!==1)||new Set(m.matches.map(x=>x.id)).size!==m.matches.length)return res.status(400).json({error:'Invalid manifest',details:validate.errors?.[0]?.message});
      const file=path.join(demoRoot,m.demo.sha256+'.mvd2'),info=await stat(file).catch(()=>null);
      if(!info||info.size!==m.demo.size)return res.status(409).json({error:'Upload matching demo first'});
      const hash=createHash('sha256');for await(const b of createReadStream(file))hash.update(b);
      if(hash.digest('hex')!==m.demo.sha256)throw new Error('Stored file checksum mismatch');
      const prev=await store.demo(m.demo.sha256);
      await store.save(m);res.status(prev?200:201).json({accepted:true,duplicate:Boolean(prev),matches:m.matches.length,sha256:m.demo.sha256});
    }catch(e){next(e);}
  });
  api.get('/api/health',async(req,res,next)=>{try{await store.ping();res.json({ok:true,version:'0.1.0'});}catch(e){next(e);}});
  api.get('/api/matches',async(req,res,next)=>{try{res.json(await store.list(req.query));}catch(e){next(e);}});
  api.get('/api/matches/:id',async(req,res,next)=>{try{const m=await store.match(req.params.id);if(!m)return res.status(404).json({error:'Not found'});res.json({...m,scoreHistory:completeScoreHistory(m)});}catch(e){next(e);}});
  api.get('/api/facets',async(req,res,next)=>{try{res.json(await store.facets());}catch(e){next(e);}});
  api.get('/api/summary',async(req,res,next)=>{try{res.json(await store.summary(req.query));}catch(e){next(e);}});
  api.get('/api/victims',async(req,res,next)=>{try{res.json(await store.victims(req.query));}catch(e){next(e);}});
  api.get('/api/dynamics',async(req,res,next)=>{try{res.setHeader('Cache-Control','no-cache');res.json(await store.dynamics(req.query));}catch(e){next(e);}});
  api.get('/api/achievements',async(req,res,next)=>{try{res.setHeader('Cache-Control','no-cache');res.json(await store.achievements());}catch(e){next(e);}});
  api.get('/api/achievements/:id',async(req,res,next)=>{try{const value=await store.achievement(req.params.id,req.query);if(!value)return res.status(404).json({error:'Not found'});res.setHeader('Cache-Control','no-cache');res.json(value);}catch(e){next(e);}});
  api.get('/api/demos/:sha',async(req,res,next)=>{try{if(!hashPattern.test(req.params.sha))return res.sendStatus(404);const m=await store.demo(req.params.sha);if(!m)return res.sendStatus(404);res.download(path.join(demoRoot,req.params.sha+'.mvd2'),m.demo.originalName);}catch(e){next(e);}});
  api.use('/assets/'+assets.revision,(req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method))return next();
    const name=req.path.slice(1),content=assets.files.get(name);
    if(!content)return res.sendStatus(404);
    res.setHeader('Cache-Control','no-cache');res.type(path.extname(name));res.send(content);
  });
  // Legacy URLs remain readable for already open tabs, but new HTML never uses
  // them. Changing Cache-Control alone cannot invalidate a previously fresh cache.
  api.use('/assets',express.static(path.join(root,'public'),{maxAge:0,index:false,dotfiles:'deny',setHeaders:res=>res.setHeader('Cache-Control','no-cache')}));
  api.get(['','/','/about'],(req,res)=>{res.setHeader('Cache-Control','no-cache');res.type('html').send(assets.html);});
  app.get('/',(req,res)=>res.redirect(base+'/'));
  app.use((req,res)=>res.status(404).json({error:'Not found'}));
  app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err.status||500;if(status>=500)console.error('[request]',err.message);res.status(status).json({error:status>=500?'Internal service error':err.message});});
  return {app,store,bindOnlineSockets};
}

const entryScript=process.env.pm_exec_path||process.argv[1];
if(entryScript&&path.resolve(entryScript)===fileURLToPath(import.meta.url)) {
  const config=JSON.parse(await readFile(process.argv[2]||path.join(root,'local.json'),'utf8'));
  const {app,store,bindOnlineSockets}=await createService(config);
  const server=app.listen(config.port||3085,config.host||'127.0.0.1',()=>console.log(`BotStats http://${config.host||'127.0.0.1'}:${config.port||3085}${config.basePath||'/botstats'}/`));
  const closeOnlineSockets=bindOnlineSockets(server);
  server.requestTimeout=120000;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{closeOnlineSockets();server.close(async()=>{await store.close();process.exit(0);});server.closeIdleConnections();});
}

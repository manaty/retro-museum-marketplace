import http from 'node:http';import {readFile} from 'node:fs/promises';import {randomBytes,createHash} from 'node:crypto';
import {CloudTasksClient} from '@google-cloud/tasks';
import {Store} from './storage.js';import {declarations,POLICY_VERSION,RULES} from './policy.js';import {resolveSubmission} from './github.js';import {processSubmission} from './pipeline.js';
const inbox=new Store(process.env.INBOX_BUCKET,'.local/inbox'),outbox=new Store(process.env.CATALOG_BUCKET,'.local/catalog');
const firstParty=JSON.parse(await readFile(new URL('./first-party.json',import.meta.url),'utf8'));
const role=process.env.SERVICE_ROLE||'local';const tasks=process.env.TASK_QUEUE?new CloudTasksClient():null;
const sha=x=>createHash('sha256').update(x).digest('hex');
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
async function body(req){let bytes=0,text='';for await(const chunk of req){bytes+=chunk.length;if(bytes>18000)throw Error('Request exceeds 18 KB.');text+=chunk;}return JSON.parse(text||'{}');}
async function queue(id){if(tasks){await tasks.createTask({parent:process.env.TASK_QUEUE,task:{name:process.env.TASK_QUEUE+'/tasks/review-'+id,httpRequest:{httpMethod:'POST',url:process.env.REVIEWER_URL+'/process',headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify({id})).toString('base64'),oidcToken:{serviceAccountEmail:process.env.TASK_CALLER,audience:process.env.REVIEWER_URL}},dispatchDeadline:{seconds:300}}});}else if(role==='local'){setImmediate(async()=>{try{await processSubmission(await inbox.get(`jobs/${id}.json`),{inbox,outbox});}catch(e){console.error('Review failed:',e.message);}});}else throw Error('Review queue is not configured.');}
export const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  if(path==='/health'){send(res,200,{ok:true,version:'0.1.0',role});return;}
  if(role==='reviewer'){
   // Cloud Run IAM requires a Google OIDC identity before this private service is reached.
   if(req.method!=='POST'||path!=='/process'){send(res,404,{error:'Not found'});return;}
   const {id,retryReason}=await body(req);if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Invalid job ID.');
   const job=await inbox.get(`jobs/${id}.json`);if(!job){send(res,404,{error:'Job not found'});return;}
   const prior=await outbox.get(`reports/${id}.json`);if(prior?.completedAt){
    if(typeof retryReason!=='string'||retryReason.trim().length<10){send(res,200,{status:prior.status});return;}
    await outbox.put(`report-history/${id}/${randomBytes(8).toString('hex')}.json`,{...prior,retryReason:retryReason.slice(0,1000),retriedAt:new Date().toISOString()},{create:true});
   }
   const result=await processSubmission(job,{inbox,outbox});send(res,200,{status:result.status});return;
  }
  if(req.method==='GET'&&path==='/api/catalog'){
   const keys=await outbox.list('games/');const games=(await Promise.all(keys.map(k=>outbox.get(k)))).filter(g=>g&&!g.withdrawn);send(res,200,{schemaVersion:1,policyVersion:POLICY_VERSION,games:[...firstParty,...games.filter(g=>!firstParty.some(p=>p.id===g.id))]});return;
  }
  if(req.method==='GET'&&path==='/api/policy'){send(res,200,{version:POLICY_VERSION,rules:RULES});return;}
  if(req.method==='POST'&&path==='/api/submissions'){
   // Persistent global and per-repository budgets also cover multi-instance Cloud Run.
   const data=await body(req),decl=declarations(data.declarations),source=await resolveSubmission(data.repository);
   const date=new Date().toISOString().slice(0,10),identity=sha(source.fullName+'@'+source.commit).slice(0,32),existing=await inbox.get(`commits/${identity}.json`);
   if(existing){send(res,200,{id:existing.id,report:`/api/reports/${existing.id}`});return;}
   const budget=await inbox.list(`quota/${date}-`);if(budget.length>=10){send(res,429,{error:'The daily review limit has been reached. Please try again tomorrow.'});return;}
   const id=randomBytes(16).toString('hex');
   // Claim one of ten fixed slots atomically; caller IP is never stored.
   let claimed=false;for(let slot=0;slot<10;slot++){try{await inbox.put(`quota/${date}-${slot}.json`,{id},{create:true});claimed=true;break;}catch(e){if(![412,'EEXIST'].includes(e.code))throw e;}}
   if(!claimed){send(res,429,{error:'The daily review limit has been reached.'});return;}
   await inbox.put(`jobs/${id}.json`,{id,source,declarations:decl,submittedAt:new Date().toISOString()},{create:true});
   await inbox.put(`commits/${identity}.json`,{id},{create:true});
   await queue(id);send(res,202,{id,report:`/api/reports/${id}`});return;
  }
  if(req.method==='GET'&&/^\/api\/reports\/[a-f0-9]{32}$/.test(path)){
   const id=path.split('/').pop(),report=await outbox.get(`reports/${id}.json`);send(res,report?200:202,report||{id,status:'queued'});return;
  }
  if(req.method==='GET'&&/^\/packages\/[a-f0-9]{64}\.json$/.test(path)){
   const bytes=await outbox.bytes(path.slice(1));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=31536000, immutable','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});res.end(bytes);return;
  }
  if(req.method==='GET'&&(path==='/'||path==='/retro-museum')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://nexlink-web-3vxjlkppba-as.a.run.app https://nexlink.manaty.net https://nexlink.app",'Referrer-Policy':'no-referrer'});res.end(await readFile(new URL('./public/index.html',import.meta.url)));return;}
  if(req.method==='GET'&&/^\/screens\/(tanks|uno|kart|monopoly|werewolf|zx80)\.png$/.test(path)){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'});res.end(await readFile(new URL('./public'+path,import.meta.url)));return;}
  if(req.method==='GET'&&['/app.js','/style.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(await readFile(new URL('./public'+path,import.meta.url)));return;}
  send(res,404,{error:'Not found'});
 }catch(error){console.error('Request failed:',error.message);send(res,['ENOENT',404].includes(error.code)?404:400,{error:String(error.message).slice(0,500)});}
});
server.requestTimeout=30000;server.headersTimeout=15000;
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||4320,'0.0.0.0',()=>console.log('Retro Museum marketplace listening'));

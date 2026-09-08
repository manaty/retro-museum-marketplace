import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {downloadSubmission,forkReviewed} from './github.js';import {review} from './review.js';import {POLICY_VERSION} from './policy.js';
import {repository} from '@manaty/retro-museum-sdk/manifest';
import {renderEvidence} from './render.js';
import firstParty from './first-party.json' with {type:'json'};
const require=createRequire(import.meta.url);const {validateIsolated}=await import(pathToFileURL(resolve(require.resolve('@manaty/retro-museum-sdk'),'../validate.js')).href);
export async function processSubmission(job,{inbox,outbox,download=downloadSubmission,fork=forkReviewed,ai=review,validate=validateIsolated,render=renderEvidence}){
 const report={id:job.id,source:job.source,categories:job.categories||['other'],status:'validating',policyVersion:POLICY_VERSION,submittedAt:job.submittedAt};
 const path=`reports/${job.id}.json`;await outbox.put(path,report);
 let dir;
 try{
  if(download===downloadSubmission){const source=repository(job.source.url);if(source.fullName!==job.source.fullName||source.owner!==job.source.owner||source.repo!==job.source.repo||!/^[a-f0-9]{40}$/.test(job.source.commit))throw Error('Invalid immutable source reference.');}
  const {bytes,pack,hash}=await download(job.source);report.hash=hash;report.manifest=pack.manifest;
  dir=await mkdtemp(join(tmpdir(),'museum-review-'));await writeFile(join(dir,'game.rmg.json'),bytes);
  report.technical=await validate(join(dir,'game.rmg.json'));
  if(report.technical.status!=='passed'||report.technical.sha256!==hash){report.status='rejected';report.reason='Independent technical validation failed.';}
  else{
   report.status='forking';await outbox.put(path,report);report.fork=await fork(job.source);
   report.status='reviewing';await outbox.put(path,report);
   const evidence=await render(join(dir,'game.rmg.json'));
   report.browser={passed:evidence.passed,reason:evidence.reason||null,failures:evidence.failures||[],screens:(evidence.screens||[]).map(s=>s.role)};
   report.editorial=await ai(pack,job.declarations,{evidence});report.status=report.editorial.status;
   if(report.status==='approved'){
    // AI approval is never sufficient if coverage is incomplete.
    if(!report.editorial.coverage?.complete)throw Error('Review coverage incomplete.');
    await publishApproved(report,bytes,outbox);
   }
  }
 }catch(error){report.status='needs_review';report.reason=String(error.message).slice(0,1000);}
 finally{if(dir){const path=resolve(dir);if(path.startsWith(resolve(tmpdir())+'\\museum-review-')||path.startsWith(resolve(tmpdir())+'/museum-review-'))await rm(path,{recursive:true,force:true});}}
 report.completedAt=new Date().toISOString();await outbox.put(path,report);return report;
}
export async function publishApproved(report,bytes,outbox){
 const official=firstParty.find(game=>game.id===report.manifest.id);
 if(official&&official.source.url!==report.source.url)throw Error('Game ID is reserved by an official repository.');
 const key=`games/${report.manifest.id}.json`;const current=await outbox.get(key);
 if(current&&current.source.fullName!==report.source.fullName)throw Error('Game ID belongs to a different repository.');
 await outbox.put(`packages/${report.hash}.json`,bytes);
 await outbox.put(key,{id:report.manifest.id,categories:report.categories||['other'],manifest:report.manifest,sha256:report.hash,source:report.source,fork:report.fork,reportId:report.id,policyVersion:report.policyVersion,publishedAt:new Date().toISOString()});
}

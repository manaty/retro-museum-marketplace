// Run with an authorized operator's GCP credentials, never from a public HTTP route.
import {Store} from './storage.js';import {downloadSubmission} from './github.js';import {publishApproved} from './pipeline.js';import {randomBytes} from 'node:crypto';
const [id,hash,decision,...words]=process.argv.slice(2),reason=words.join(' ').trim();
if(!/^[a-f0-9]{32}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(hash||'')||!['approve','reject','withdraw'].includes(decision)||reason.length<30)throw Error('Usage: node review-decision.js REPORT_ID EXACT_SHA256 approve|reject|withdraw Detailed human review rationale (at least 30 characters)');
if(!process.env.REVIEWER_NAME)throw Error('Set REVIEWER_NAME to the responsible operator.');
const outbox=new Store(process.env.CATALOG_BUCKET,'.local/catalog'),report=await outbox.get(`reports/${id}.json`);
if(!report||report.hash!==hash||report.technical?.status!=='passed'||!report.fork)throw Error('Report, independent validation, fork or exact artifact hash is missing.');
if(decision==='approve'&&!report.editorial)throw Error('An AI review must exist before human approval.');
const audit={id,hash,decision,reason,reviewer:process.env.REVIEWER_NAME,at:new Date().toISOString(),priorStatus:report.status};
if(decision==='approve'){
 const downloaded=await downloadSubmission(report.source);if(downloaded.hash!==hash)throw Error('Immutable artifact hash mismatch.');
 await outbox.put(`decisions/${id}-${randomBytes(8).toString('hex')}.json`,audit,{create:true});
 await publishApproved(report,downloaded.bytes,outbox);report.status='approved';
}else if(decision==='withdraw'){
 const entry=await outbox.get(`games/${report.manifest.id}.json`);if(!entry||entry.sha256!==hash)throw Error('This artifact is not the active catalog version.');
 await outbox.put(`decisions/${id}-${randomBytes(8).toString('hex')}.json`,audit,{create:true});
 await outbox.put(`games/${report.manifest.id}.json`,{...entry,withdrawn:true,withdrawalReason:reason});report.status='withdrawn';
}else{await outbox.put(`decisions/${id}-${randomBytes(8).toString('hex')}.json`,audit,{create:true});report.status='rejected';}
report.humanReview=audit;await outbox.put(`reports/${id}.json`,report);console.log(JSON.stringify({id,status:report.status,hash}));

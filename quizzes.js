import {createHash,randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {validateQuiz,MAX_QUIZ_BYTES} from '@manaty/game-quizz/schema';import {BUILTIN_QUIZZES} from '@manaty/game-quizz/builtins';import {packageQuiz} from '@manaty/game-quizz/package-quiz';import {validatePackage} from '@manaty/retro-museum-sdk';
import {reviewQuiz} from './quiz-review.js';
export const QUIZ_POLICY='2026-09-08.1';const sha=x=>createHash('sha256').update(x).digest('hex');
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
function uniqueQuestions(quiz){const seen=new Set();for(const q of quiz.questions){const key=sha(JSON.stringify([q.prompt,q.image]));if(seen.has(key))throw Error('Duplicate question: '+q.id);seen.add(key);}}
export function publication(input){if(!input||input.license!=='CC-BY-4.0'||input.rightsConfirmed!==true||!Number.isInteger(input.minimumAge)||input.minimumAge<3||input.minimumAge>18)throw Error('Declare CC-BY-4.0 rights and minimumAge (3–18).');for(const k of ['imageProvenance','contentNotes'])if(typeof input[k]!=='string'||input[k].length<10||input[k].length>3000)throw Error('Complete '+k+' (10–3000 characters).');if(!Array.isArray(input.sources)||input.sources.length>100||input.sources.some(s=>typeof s!=='string'||s.length>1000||!/^https:\/\//.test(s)))throw Error('Sources must be up to 100 HTTPS reference URLs.');return Object.fromEntries(['license','rightsConfirmed','minimumAge','imageProvenance','contentNotes','sources'].map(k=>[k,input[k]]));}
export async function processQuiz(job,{outbox,ai=reviewQuiz}){
 const report={id:job.id,kind:'quiz',status:'reviewing',title:job.quiz.title,hash:job.hash,policyVersion:QUIZ_POLICY,submittedAt:job.submittedAt};const path='reports/'+job.id+'.json';await outbox.put(path,report);
 try{
  const quiz=validateQuiz(job.quiz);uniqueQuestions(quiz);if(sha(JSON.stringify(quiz))!==job.hash)throw Error('Quiz integrity mismatch.');
  report.editorial=await ai(quiz,publication(job.publication));report.status=report.editorial.status;
  if(report.status==='approved'){
   if(!report.editorial.complete||report.editorial.questionsReviewed!==quiz.questions.length)throw Error('Incomplete question review.');
   const base=JSON.parse(await readFile(new URL(import.meta.resolve('@manaty/game-quizz/package')),'utf8')),pack=packageQuiz(base,quiz);pack.licenseText+='\nQuestionnaire: '+quiz.author+' — CC BY 4.0. Sources: '+job.publication.sources.join(', ');
   const source=JSON.stringify(pack),technical=validatePackage(source);report.technical=technical;if(technical.status!=='passed')throw Error('Quiz package incompatible.');
   const hash=sha(source);await outbox.put('packages/'+hash+'.json',Buffer.from(source));await outbox.put('quiz-content/'+job.hash+'.json',quiz);
   await outbox.put('quizzes/'+job.hash+'.json',{id:pack.manifest.id,title:quiz.title,author:quiz.author,language:quiz.language,count:quiz.questions.length,sha256:job.hash,packageHash:hash,manifest:pack.manifest,reportId:job.id,license:'CC-BY-4.0',publishedAt:new Date().toISOString()});
  }
 }catch(e){report.status='needs_review';report.reason=String(e.message).slice(0,500);}
 report.completedAt=new Date().toISOString();await outbox.put(path,report);return report;
}
export function quizRoutes({inbox,outbox,queue}){
 return async(req,res,path)=>{
  if(req.method==='OPTIONS'&&path.startsWith('/api/quizzes')){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600'});res.end();return true;}
  if(req.method==='GET'&&path==='/api/quizzes/schema'){json(res,200,{schemaVersion:1,policyVersion:QUIZ_POLICY,endpoint:'https://retro-museum.net/api/quizzes/submissions',method:'POST',contentType:'application/json',authentication:'none',maxQuestions:100,maxImageBytes:100000,maxImageDimensions:[2048,2048],maxRequestBytes:MAX_QUIZ_BYTES,imageTypes:['image/png','image/jpeg'],correctIndex:'zero-based 0–3',quizFields:['schemaVersion','id','title','author','language','questions'],questionFields:['id','prompt','answers (exactly four distinct choices)','correct','explanation (optional)','image (optional data URL)'],publicationFields:['license: CC-BY-4.0','rightsConfirmed: true','minimumAge: integer 3–18','imageProvenance: 10–3000 characters','contentNotes: 10–3000 characters','sources: HTTPS URL array'],prompt:'/quiz-prompt.txt',tracking:'/api/reports/{id}',publication:'Only complete technical and AI content review can publish a quiz. Uncertain submissions stay unpublished.',dailyLimit:20});return true;}
  if(req.method==='GET'&&path==='/api/quizzes'){
   const reviewed=(await Promise.all((await outbox.list('quizzes/')).map(k=>outbox.get(k)))).filter(x=>x&&!x.withdrawn);
   json(res,200,{schemaVersion:1,quizzes:[...Object.values(BUILTIN_QUIZZES).map(q=>({id:q.id,title:q.title,author:q.author,count:q.questions.length,language:q.language,builtin:true,download:'/api/quizzes/builtin/'+q.id})),...reviewed.map(q=>({...q,download:'/api/quizzes/content/'+q.sha256,playUrl:'https://play.retro-museum.net/g/'+q.id}))]});return true;
  }
  if(req.method==='GET'&&/^\/api\/quizzes\/builtin\/(flags|fruits|capitals|kings)$/.test(path)){json(res,200,BUILTIN_QUIZZES[path.split('/').pop()]);return true;}
  if(req.method==='GET'&&/^\/api\/quizzes\/content\/[a-f0-9]{64}$/.test(path)){const id=path.split('/').pop(),entry=await outbox.get('quizzes/'+id+'.json');if(!entry||entry.withdrawn){json(res,404,{error:'Questionnaire unavailable.'});return true;}json(res,200,await outbox.get('quiz-content/'+id+'.json'));return true;}
  if(req.method==='POST'&&path==='/api/quizzes/submissions'){
   try{
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('Use Content-Type: application/json');
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_QUIZ_BYTES){json(res,413,{error:'Quiz exceeds 14 MB.'});return true;}chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),quiz=validateQuiz(input.quiz),decl=publication(input.publication),hash=sha(JSON.stringify(quiz)),identity=sha(JSON.stringify({quiz,publication:decl})).slice(0,32),key='quiz-dedup/'+identity+'.json';uniqueQuestions(quiz);const existing=await inbox.get(key);
    if(existing){await queue(existing.id);json(res,200,{id:existing.id,report:'https://retro-museum.net/api/reports/'+existing.id,status:'received'});return true;}
    const id=randomBytes(16).toString('hex'),date=new Date().toISOString().slice(0,10);let claimed=false;
    for(let slot=0;slot<20;slot++){try{await inbox.put('quiz-quota/'+date+'-'+slot+'.json',{id},{create:true});claimed=true;break;}catch(e){if(![412,'EEXIST'].includes(e.code))throw e;}}
    if(!claimed){json(res,429,{error:'Daily quiz review capacity reached. Try again tomorrow.'});return true;}
    await inbox.put('jobs/'+id+'.json',{id,kind:'quiz',quiz,hash,publication:decl,submittedAt:new Date().toISOString()},{create:true});
    try{await inbox.put(key,{id},{create:true});}catch(e){if(![412,'EEXIST'].includes(e.code))throw e;const winner=await inbox.get(key);await queue(winner.id);json(res,200,{id:winner.id,report:'https://retro-museum.net/api/reports/'+winner.id});return true;}
    await queue(id);json(res,202,{id,report:'https://retro-museum.net/api/reports/'+id,status:'queued'});
   }catch(e){json(res,400,{error:String(e.message).slice(0,500)});}
   return true;
  }
  return false;
 };
}

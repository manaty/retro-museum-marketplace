import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {createHash} from 'node:crypto';
import {quizRoutes,processQuiz} from '../quizzes.js';import {reviewQuiz} from '../quiz-review.js';import {BUILTIN_QUIZZES} from '@manaty/game-quizz/builtins';import {validateQuiz} from '@manaty/game-quizz/schema';import {RULES} from '../policy.js';
class Memory{map=new Map();async get(k){return this.map.get(k)||null;}async put(k,v,{create=false}={}){if(create&&this.map.has(k)){const e=Error('exists');e.code=412;throw e;}this.map.set(k,v);}async list(prefix){return [...this.map.keys()].filter(k=>k.startsWith(prefix));}}
const publication={license:'CC-BY-4.0',rightsConfirmed:true,minimumAge:8,imageProvenance:'Original generated flag diagrams by Manaty.',contentNotes:'Educational world flag questions for children.',sources:[]};
test('public POST validates, returns stable receipt and never directly publishes',async t=>{
 const inbox=new Memory(),outbox=new Memory(),queue=[];const route=quizRoutes({inbox,outbox,queue:async id=>queue.push(id)}),server=http.createServer(async(req,res)=>{if(!await route(req,res,new URL(req.url,'http://host').pathname)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const origin='http://127.0.0.1:'+server.address().port;
 const post=payload=>fetch(origin+'/api/quizzes/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const first=await post({quiz:BUILTIN_QUIZZES.flags,publication}),receipt=await first.json();assert.equal(first.status,202);assert.match(receipt.id,/^[a-f0-9]{32}$/);const duplicate=await(await post({quiz:BUILTIN_QUIZZES.flags,publication})).json();assert.equal(duplicate.id,receipt.id);assert.equal(outbox.map.size,0);assert.equal((await inbox.list('jobs/')).length,1);
 assert.equal((await post({quiz:BUILTIN_QUIZZES.flags,publication:{...publication,rightsConfirmed:false}})).status,400);
 const bad=structuredClone(BUILTIN_QUIZZES.flags);bad.questions[0].image='data:image/svg+xml;base64,PHN2Zz4=';assert.equal((await post({quiz:bad,publication})).status,400);
 assert.equal((await(await fetch(origin+'/api/quizzes')).json()).quizzes.length,4);
});
test('all questions and every image are reviewed; incomplete/missing AI never approves',async()=>{
 const quiz=validateQuiz(BUILTIN_QUIZZES.flags);assert.equal((await reviewQuiz(quiz,publication,{key:''})).status,'needs_review');let images=0;
 const fetcher=async(_url,req)=>{const body=JSON.parse(req.body);images+=body.input[0].content.filter(c=>c.type==='input_image').length;assert.equal(body.store,false);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'checked',questions:quiz.questions.map(q=>({id:q.id,result:'pass',reason:'Correct and clear.'})),findings:RULES.map(r=>({rule:r.id,result:'pass',reason:'Pass.'}))})}]}]})};};
 const result=await reviewQuiz(quiz,publication,{key:'test-key',fetcher});assert.equal(result.status,'approved');assert.equal(result.questionsReviewed,10);assert.equal(images,10);
 await assert.rejects(()=>reviewQuiz(quiz,publication,{key:'test-key',fetcher:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"questions":[],"findings":[]}'}]}]})})}),/coverage/);
});
test('only full approval publishes immutable data and a playable package',async()=>{
 const quiz=validateQuiz(BUILTIN_QUIZZES.fruits),hash=createHash('sha256').update(JSON.stringify(quiz)).digest('hex'),job={id:'b'.repeat(32),quiz,hash,publication};const outbox=new Memory();
 let report=await processQuiz(job,{outbox,ai:async()=>({status:'approved',complete:false,questionsReviewed:0})});assert.equal(report.status,'needs_review');assert.equal((await outbox.list('quizzes/')).length,0);
 report=await processQuiz(job,{outbox,ai:async()=>({status:'approved',complete:true,questionsReviewed:10})});assert.equal(report.status,'approved');assert.equal(report.technical.status,'passed');assert.equal((await outbox.list('packages/')).length,1);assert.equal((await outbox.list('quizzes/')).length,1);
});

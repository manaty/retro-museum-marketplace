import {createHash,randomInt} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {BUILTIN_QUIZZES} from '@manaty/game-quizz/builtins';
import {validateQuiz,difficultyOptions,difficultyPlan,difficultyCounts} from '@manaty/game-quizz/schema';
import {packageQuiz} from '@manaty/game-quizz/package-quiz';
import {validatePackage} from '@manaty/retro-museum-sdk';

const sha=x=>createHash('sha256').update(x).digest('hex');
export const CATEGORIES=[
 ['education','Learning & quizzes','Savoirs et quiz'],['action','Action & arcade','Action et arcade'],
 ['racing','Racing','Courses'],['board','Board & card games','Jeux de plateau et de cartes'],
 ['social','Social deduction','Déduction sociale'],['retro','Computing history','Histoire informatique'],['other','Other experiences','Autres expériences']
].map(([id,en,fr])=>({id,title:{en,fr}}));
export function categoryIds(value=['other']){
 if(!Array.isArray(value)||!value.length||value.length>3||new Set(value).size!==value.length||value.some(id=>!CATEGORIES.some(c=>c.id===id)))throw Error('Choose 1–3 catalog categories.');
 return value;
}
const defaults={tanks:['action'],kart:['racing'],uno:['board'],monopoly:['board'],'werewolf-village':['social'],werewolf:['social'],zx80:['retro'],quizz:['education']};
export function gameEntry(game){return {...game,kind:'game',categories:game.categories||defaults[game.id]||['other'],content:game.id==='quizz'?{required:true,type:'quiz-v1',min:1,max:10,maxQuestions:1000,maxQuestionsPerGame:100}:{required:false,type:null,min:0,max:0}};}
export async function contentPacks(outbox){
 const builtins=Object.values(BUILTIN_QUIZZES).map(q=>({id:'builtin-'+q.id,kind:'pack',gameId:'quizz',format:'quiz-v1',compatibleGameVersion:'1.x',title:q.title,author:q.author,count:q.questions.length,levels:difficultyCounts(q.questions),categories:['education'],sha256:sha(JSON.stringify(validateQuiz(q))),builtin:true,download:'/api/quizzes/builtin/'+q.id}));
 const submitted=(await Promise.all((await outbox.list('quizzes/')).map(k=>outbox.get(k)))).filter(q=>q&&!q.withdrawn).map(q=>({id:q.id,kind:'pack',gameId:'quizz',format:'quiz-v1',compatibleGameVersion:'1.x',title:q.title,author:q.author,count:q.count,levels:q.levels||[q.count,0,0,0,0],categories:['education'],sha256:q.sha256,reportId:q.reportId,download:'/api/quizzes/content/'+q.sha256}));
 return [...builtins,...submitted];
}
export async function selectedContent(input,outbox){
 if(input?.gameId!=='quizz')throw Error('This game does not accept quiz content packs.');
 if(!Array.isArray(input.packIds)||!input.packIds.length||input.packIds.length>10||new Set(input.packIds).size!==input.packIds.length)throw Error('Choose 1–10 different content packs.');
 const all=await contentPacks(outbox),packs=input.packIds.map(id=>all.find(p=>p.id===id));
 if(packs.some(p=>!p))throw Error('A content pack is unavailable or incompatible.');
 const total=packs.reduce((n,p)=>n+p.count,0);if(total>1000)throw Error('A selected bank contains at most 1000 questions.');const settings={...difficultyOptions(input),questionCount:input.questionCount??Math.min(100,total)};if(!Number.isInteger(settings.questionCount)||settings.questionCount<1||settings.questionCount>Math.min(100,total))throw Error('Choose 1–100 questions to play.');
 // Canonical order makes repeated requests share one immutable selection.
 packs.sort((a,b)=>a.id.localeCompare(b.id));
 const base=JSON.parse(await readFile(new URL(import.meta.resolve('@manaty/game-quizz/package')),'utf8'));
 if(!/^1\./.test(base.manifest.version)||packs.some(p=>p.format!=='quiz-v1'))throw Error('Content pack version is incompatible with this game.');
 const identity=sha(JSON.stringify({engine:sha(JSON.stringify(base)),packs:packs.map(p=>[p.id,p.sha256]),settings}));
 return {id:identity.slice(0,32),packs,base,settings};
}
export async function processSelection(job,{outbox}){
 const report={id:job.id,kind:'selection',status:'preparing',submittedAt:job.submittedAt};
 await outbox.put('reports/'+job.id+'.json',report);
 try{
  const {id,packs,base,settings}=await selectedContent(job.selection,outbox);
  if(id!==job.id)throw Error('The selected content version changed. Please select it again.');
  const records=await Promise.all(packs.map(async p=>{
   const q=validateQuiz(p.builtin?BUILTIN_QUIZZES[p.id.slice(8)]:await outbox.get('quiz-content/'+p.sha256+'.json'));
   if(sha(JSON.stringify(q))!==p.sha256)throw Error('Content integrity mismatch.');return q;
  }));
  const bank=validateQuiz({schemaVersion:1,id:'selection-'+id,title:{en:'Quiz · Your selection',fr:'Quiz · Votre sélection',tl:'Quiz · Iyong pinili'},author:'Retro Museum contributors',language:'en',questions:records.flatMap((q,i)=>q.questions.map((question,j)=>({...question,id:'p'+i+'q'+j})))});
  const indices=difficultyPlan(bank.questions,settings).groups.flatMap(g=>{const list=[...g.indices];for(let i=list.length-1;i>0;i--){const j=randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}return list.slice(0,g.count);}).sort((a,b)=>a-b);const quiz={...bank,questions:indices.map(i=>bank.questions[i])};
  const pack=packageQuiz(base,quiz,settings);pack.manifest.id='selection-'+id;
  pack.licenseText+='\nContent packs: '+JSON.stringify(records.map(q=>({title:q.title,author:q.author,license:'CC-BY-4.0'})));
  const source=JSON.stringify(pack),hash=sha(source),technical=validatePackage(source);
  if(technical.status!=='passed')throw Error('This content selection exceeds the game package limits. Choose fewer packs.');
  const entry={id:pack.manifest.id,kind:'selection',gameId:'quizz',packs:packs.map(p=>({id:p.id,sha256:p.sha256,title:p.title})),manifest:pack.manifest,sha256:hash,source:{url:'https://github.com/manaty/game-quizz'},fork:{url:'https://github.com/manaty/game-quizz'},reportId:job.id,publishedAt:new Date().toISOString()};
  await outbox.put('packages/'+hash+'.json',Buffer.from(source));
  await outbox.put('selection-content/'+job.id+'.json',bank);
  await outbox.put('selections/'+job.id+'.json',entry);
  Object.assign(report,{status:'ready',selection:entry.id,download:'/packages/'+hash+'.json',sha256:hash,packs:entry.packs,questions:quiz.questions.length,bankQuestions:bank.questions.length,settings});
 }catch(e){report.status='failed';report.reason=String(e.message).slice(0,500);}
 report.completedAt=new Date().toISOString();await outbox.put('reports/'+job.id+'.json',report);return report;
}
export async function availableSelections(outbox){
 const packs=await contentPacks(outbox),entries=await Promise.all((await outbox.list('selections/')).map(k=>outbox.get(k)));
 return entries.filter(e=>e&&!e.withdrawn&&e.packs.every(p=>packs.some(q=>q.id===p.id&&q.sha256===p.sha256)));
}
export function collectionRoutes({inbox,outbox,queue,firstParty,playOrigin}){
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 return async(req,res,path)=>{
  if(req.method==='GET'&&path==='/api/marketplace'){
   const reviewed=(await Promise.all((await outbox.list('games/')).map(k=>outbox.get(k)))).filter(g=>g&&!g.withdrawn);
   send(res,200,{schemaVersion:2,categories:CATEGORIES,games:[...firstParty,...reviewed.filter(g=>!firstParty.some(p=>p.id===g.id)).map(g=>({...g,playUrl:playOrigin+'/g/'+g.id}))].map(gameEntry),packs:await contentPacks(outbox)});return true;
  }
  if(req.method==='POST'&&path==='/api/selections'){
   try{
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('Use application/json.');
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)throw Error('Selection request too large.');}
    const selection=JSON.parse(body),{id,packs,settings}=await selectedContent(selection,outbox),existing=await inbox.get('jobs/'+id+'.json');
    if(!existing){
     const date=new Date().toISOString().slice(0,10);let claimed=false;
     for(let slot=0;slot<50;slot++){try{await inbox.put('selection-quota/'+date+'-'+slot+'.json',{id},{create:true});claimed=true;break;}catch(e){if(![412,'EEXIST'].includes(e.code))throw e;}}
     if(!claimed){send(res,429,{error:'Daily selection capacity reached. Try again tomorrow.'});return true;}
     try{await inbox.put('jobs/'+id+'.json',{id,kind:'selection',selection:{gameId:'quizz',packIds:packs.map(p=>p.id),...settings},submittedAt:new Date().toISOString()},{create:true});}catch(e){if(![412,'EEXIST'].includes(e.code))throw e;}
    }
    await queue(id);send(res,202,{id,status:'preparing',report:'/api/selections/'+id});
   }catch(e){send(res,400,{error:String(e.message).slice(0,500)});}return true;
  }
  if(req.method==='GET'&&/^\/api\/selections\/[a-f0-9]{32}\/content$/.test(path)){
   const id=path.split('/')[3];
   if(!(await availableSelections(outbox)).some(s=>s.reportId===id)){send(res,404,{error:'Selection unavailable.'});return true;}
   res.setHeader('Content-Disposition','attachment; filename="museum-quiz-selection.quiz.json"');
   send(res,200,await outbox.get('selection-content/'+id+'.json'));return true;
  }
  if(req.method==='GET'&&/^\/api\/selections\/[a-f0-9]{32}$/.test(path)){
   const id=path.split('/').pop(),report=await outbox.get('reports/'+id+'.json');
   if(report&&report.kind!=='selection'){send(res,404,{error:'Selection not found.'});return true;}
   if(report?.status==='ready'&&!(await availableSelections(outbox)).some(s=>s.reportId===id)){send(res,410,{error:'A selected content pack is no longer available.'});return true;}
   send(res,report?200:202,report?{...report,...(report.status==='ready'?{playUrl:playOrigin+'/g/'+report.selection,contentDownload:'/api/selections/'+id+'/content'}:{})}:{id,status:'preparing'});return true;
  }
   return false;
 };
}

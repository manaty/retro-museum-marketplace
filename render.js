import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
export function renderEvidence(file){return new Promise(resolveResult=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('./render-worker.js',import.meta.url)),resolve(file)],{env:{PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH||'0'},stdio:['ignore','pipe','ignore'],windowsHide:true,detached:process.platform!=='win32'});
 let output='',killed=false;const stop=()=>{killed=true;try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill();}catch{}};
 const timer=setTimeout(stop,25000);child.stdout.on('data',chunk=>{output+=chunk;if(output.length>8000000)stop();});
 child.on('error',()=>{clearTimeout(timer);resolveResult({passed:false,screens:[],reason:'Browser evidence unavailable.'});});
 child.on('close',()=>{clearTimeout(timer);if(killed)return resolveResult({passed:false,screens:[],reason:'Browser evidence exceeded its time/size limit.'});try{resolveResult(JSON.parse(output));}catch{resolveResult({passed:false,screens:[],reason:'Browser evidence unavailable.'});}});
});}

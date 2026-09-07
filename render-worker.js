// Trusted browser harness. Submitted JavaScript runs only inside WASM or an opaque iframe.
import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';
import {GameRuntime} from '@manaty/retro-museum-sdk/runtime';import {parsePackage} from '@manaty/retro-museum-sdk/manifest';
const pack=parsePackage(await readFile(process.argv[2]));
const players=Array.from({length:pack.manifest.players.min},(_,i)=>({id:'player-'+i,number:i+1,name:'Player '+(i+1),connected:true,color:['#c6ef8a','#ef92be','#87cbec','#efbb72'][i%4]}));
const game=new GameRuntime(pack,players);let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const screens=[],failures=[];
 for(const role of ['display','controller']){
  // The opaque iframe already forbids service workers. Playwright's block shim itself
  // raises SecurityError in such a frame, so use a fresh context without that shim.
  const context=await browser.newContext({viewport:role==='display'?{width:1280,height:720}:{width:390,height:844}});
  const page=await context.newPage();page.setDefaultTimeout(4000);
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!=='https://museum.invalid')return route.abort();
   if(u.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><iframe id="game" sandbox="allow-scripts" style="width:100vw;height:100vh;border:0"></iframe></body></html>'});
   const asset=pack.assets[u.pathname.replace(/^\/assets\//,'')];if(!u.pathname.startsWith('/assets/')||!asset)return route.abort();
   return route.fulfill({status:200,contentType:asset.type,body:Buffer.from(asset.data,'base64')});
  });
  const errors=[];page.on('pageerror',error=>errors.push(String(error.message).slice(0,150)));
  await page.goto('https://museum.invalid/');
  const state={station:'1',room:'1',language:'en',phase:'playing',remainingMs:600000,durationMs:600000,party:{id:'review-match',game:'market.'+pack.manifest.id,phase:'playing',players,you:role==='controller'?players[0].id:null,minPlayers:pack.manifest.players.min,maxPlayers:pack.manifest.players.max,remainingMs:600000,community:game.snapshot(role==='controller'?players[0].id:null)}};
  await page.evaluate(({html,state,role})=>{
   window.reviewReady=false;const frame=document.querySelector('#game');
   const send=()=>frame.contentWindow.postMessage({retroMuseum:1,type:'state',role,state,online:true},'*');
   window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data?.retroMuseum===1&&event.data.type==='ready'){window.reviewReady=true;send();}});
   const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://museum.invalid data:; media-src https://museum.invalid; font-src https://museum.invalid; connect-src 'none'; form-action 'none'; base-uri 'none'";
   frame.srcdoc=html.replace(/<head([^>]*)>/i,`<head$1><meta http-equiv="Content-Security-Policy" content="${csp}">`);
   frame.onload=send;
  },{html:pack.view.includes('<head')?pack.view:pack.view.replace(/<html([^>]*)>/i,'<html$1><head></head>'),state,role});
  await page.waitForFunction(()=>window.reviewReady,null,{timeout:5000});
  await page.waitForTimeout(800);
  const frame=page.frames().find(f=>f.parentFrame());
  const text=frame?await frame.locator('body').innerText({timeout:3000}):'';
  if(text.trim().length<10||errors.length)failures.push({role,errors:errors.length?errors:['Initial screen has no readable text.']});
  screens.push({role,image:(await page.screenshot({type:'png'})).toString('base64'),text:text.slice(0,12000)});
  await context.close();
 }
 process.stdout.write(JSON.stringify({passed:failures.length===0,failures,screens}));
}catch(error){process.stdout.write(JSON.stringify({passed:false,reason:String(error.message).slice(0,500),screens:[]}));process.exitCode=1;}
finally{game.dispose();await browser?.close();}

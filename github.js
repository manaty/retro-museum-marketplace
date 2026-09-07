import {repository,MAX_PACKAGE_BYTES,digest,parsePackage} from '@manaty/retro-museum-sdk/manifest';
const API='https://api.github.com';
export async function limitedFetch(url,{max=MAX_PACKAGE_BYTES,headers={}}={}){
 const response=await fetch(url,{headers:{'User-Agent':'Retro-Museum-Review',...headers},redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`GitHub download failed (${response.status}).`);
 if(Number(response.headers.get('content-length'))>max)throw Error('Download exceeds size limit.');
 let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Download exceeds size limit.');chunks.push(chunk);}return Buffer.concat(chunks);
}
const headers=()=>process.env.GITHUB_READ_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_READ_TOKEN}`} : {};
export async function resolveSubmission(url){
 const repo=repository(url);const metadata=JSON.parse(await limitedFetch(`${API}/repos/${repo.fullName}`,{max:64000,headers:headers()}));
 if(metadata.private||metadata.disabled||metadata.archived)throw Error('Use an active public repository.');
 const commit=JSON.parse(await limitedFetch(`${API}/repos/${repo.fullName}/commits/${encodeURIComponent(metadata.default_branch)}`,{max:2000000,headers:headers()})).sha;
 if(!/^[0-9a-f]{40}$/.test(commit))throw Error('Unable to resolve repository commit.');
 return {...repo,commit};
}
export async function downloadSubmission(source){
 const prefix=`https://raw.githubusercontent.com/${source.fullName}/${source.commit}`;
 const bytes=await limitedFetch(`${prefix}/dist/game.rmg.json`);
 const declared=JSON.parse(await limitedFetch(`${prefix}/retro-museum.json`,{max:16000}));
 const pack=parsePackage(bytes);if(JSON.stringify(pack.manifest)!==JSON.stringify(declared))throw Error('Manifest differs from committed package. Rebuild before submitting.');
 return {bytes,pack,hash:digest(bytes)};
}
export async function forkReviewed(source){
 const token=process.env.GITHUB_PUBLISH_TOKEN;if(!token)throw Error('Manaty publisher credential is not configured.');
 const req=async(path,method='GET',body)=>{const r=await fetch(API+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Retro-Museum-Publisher'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`GitHub publisher request failed (${r.status}).`);return r.status===204?null:r.json();};
 // Already-owned official games need no duplicate fork.
 if(source.owner==='manaty')return {url:source.url,commit:source.commit,official:true};
 const name=`rm-${source.owner}-${source.repo}`.slice(0,100),fullName=`manaty/${name}`;
 let existing;try{existing=await req(`/repos/${fullName}`);}catch(error){if(!error.message.includes('(404)'))throw error;}
 if(existing&&(!existing.fork||existing.parent?.full_name?.toLowerCase()!==source.fullName))throw Error('Review fork name is already in use.');
 if(!existing)await req(`/repos/${source.fullName}/forks`,'POST',{organization:'manaty',name,default_branch_only:false});
 // Fork creation is asynchronous. Give GitHub time to make the repository available.
 if(!existing){for(let attempt=0;attempt<6;attempt++){try{existing=await req(`/repos/${fullName}`);break;}catch(error){if(!error.message.includes('(404)')||attempt===5)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}}
 if(!existing?.fork||existing.parent?.full_name?.toLowerCase()!==source.fullName)throw Error('Unexpected review fork identity.');
 await req(`/repos/${fullName}/actions/permissions`,'PUT',{enabled:false});
 const ref='review/'+source.commit;
 try{await req(`/repos/${fullName}/git/refs`,'POST',{ref:'refs/heads/'+ref,sha:source.commit});}catch(error){if(!error.message.includes('(422)'))throw error;const found=await req(`/repos/${fullName}/git/ref/heads/${ref}`);if(found.object?.sha!==source.commit)throw Error('Review reference does not match submitted commit.');}
 return {url:`https://github.com/${fullName}`,commit:source.commit,reference:ref};
}

(() => {
 const query=s=>document.querySelector(s),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const title=x=>typeof x==='string'?x:x?.en||x?.fr||'';
 let data,category='all',selectedGame=null,selected=new Set(),generation=0;
 const href=(label,url,download=false)=>{const a=make('a',label,'button');a.href=url;if(download)a.download='retro-museum-selection.rmg.json';else{a.target='_blank';a.rel='noopener';}return a;};
 function filters(){const area=query('#collection-filters');area.replaceChildren();for(const c of [{id:'all',title:'All games'},...data.categories]){const button=make('button',title(c.title),'category-button');button.type='button';button.dataset.category=c.id;button.setAttribute('aria-pressed',String(category===c.id));button.onclick=()=>{category=c.id;filters();games();};area.append(button);}}
 function games(){const area=query('#games');area.replaceChildren();const list=data.games.filter(g=>category==='all'||g.categories.includes(category));if(!list.length)area.append(make('p','No games in this category yet.'));for(const game of list){
  const card=make('article',undefined,'card');card.dataset.game=game.id;
  if(game.screenshot){const img=make('img',undefined,'cover');img.src=game.screenshot;img.alt=title(game.manifest.title);img.loading='lazy';card.append(img);}else card.append(make('div','✦','cover'));
  card.append(make('p',game.categories.map(id=>title(data.categories.find(c=>c.id===id)?.title)).join(' · '),'publisher'),make('h3',title(game.manifest.title)),make('p',title(game.manifest.description)));
  const packs=data.packs.filter(p=>p.gameId===game.id);card.append(make('p',game.content.required?packs.length+' content packs · choose at least one':'Includes its original content'));
  if(game.content.required||packs.length){const button=make('button','Choose content packs ↗','play');button.onclick=()=>choose(game);card.append(button);}
  else if(game.playUrl)card.append(href('Play now ↗',game.playUrl));
  const links=make('div',undefined,'links');if(game.fork?.url){const a=href('Source code ↗',game.fork.url);a.className='';links.append(a);}
  if(!game.content.required){let download;if(game.catalogType==='publisher_preview'&&/^https:\/\/github.com\/manaty\/[a-z0-9-]+$/.test(game.source?.url||'')&&/^[a-f0-9]{40}$/.test(game.source?.commit||''))download=game.source.url.replace('https://github.com/','https://raw.githubusercontent.com/')+'/'+game.source.commit+'/dist/game.rmg.json';else if(/^[a-f0-9]{64}$/.test(game.sha256||''))download='/packages/'+game.sha256+'.json';if(download){const a=href('Download game',download,true);a.className='';links.append(a);}}
  card.append(links);area.append(card);
 }}
 function changed(){generation++;query('#selection-links').replaceChildren();query('#selection-status').textContent='';const packs=data.packs.filter(p=>selected.has(p.id)),count=packs.reduce((n,p)=>n+p.count,0);query('#selection-count').textContent=packs.length+' packs · '+count+' questions / '+selectedGame.content.maxQuestions;query('#prepare-selection').disabled=!packs.length||packs.length>selectedGame.content.max||count>selectedGame.content.maxQuestions;}
 function choose(game){selectedGame=game;selected=new Set();query('#content-packs').hidden=false;query('#packs-title').textContent=title(game.manifest.title)+' · content packs';const list=query('#packs-list');list.replaceChildren();for(const p of data.packs.filter(p=>p.gameId===game.id)){const label=make('label',undefined,'pack-choice'),input=make('input');input.type='checkbox';input.value=p.id;input.onchange=()=>{input.checked?selected.add(p.id):selected.delete(p.id);changed();};const words=make('span');words.append(make('strong',title(p.title)),make('small',p.count+' questions · '+(p.builtin?'Manaty starter':'Community · reviewed')));label.append(input,words);list.append(label);}changed();query('#content-packs').scrollIntoView({behavior:'smooth'});}
 query('#close-packs').onclick=()=>{generation++;query('#content-packs').hidden=true;query('#catalog').scrollIntoView({behavior:'smooth'});};
 query('#prepare-selection').onclick=async()=>{
  const own=++generation,button=query('#prepare-selection'),status=query('#selection-status');button.disabled=true;status.textContent='Preparing your game and selected content…';
  try{
   const response=await fetch('/api/selections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:selectedGame.id,packIds:[...selected]})}),receipt=await response.json();if(!response.ok)throw Error(receipt.error||'Selection could not be prepared.');
   for(let attempt=0;attempt<40;attempt++){
    if(own!==generation)return;
    const r=await fetch(receipt.report),report=await r.json();if(!r.ok)throw Error(report.error||'Selection unavailable.');if(own!==generation)return;
    if(report.status==='failed')throw Error(report.reason);
    if(report.status==='ready'){status.textContent='Ready · '+report.questions+' questions. Only the selected packs are available during this game. Already have Quiz installed? Import the content file from the museum administration.';const content=href('Content for my museum',report.contentDownload,true);content.download='museum-quiz-selection.quiz.json';query('#selection-links').replaceChildren(href('Play this selection ↗',report.playUrl),href('Download game + selected packs',report.download,true),content);return;}
    await new Promise(resolve=>setTimeout(resolve,3000));
   }
   status.replaceChildren(make('span','Still preparing. You can retry this same selection or '),href('Check its status',receipt.report));
  }catch(e){if(own===generation)status.textContent=e.message;}finally{if(own===generation)button.disabled=false;}
 };
 fetch('/api/marketplace').then(async r=>{if(!r.ok)throw Error('Collection unavailable.');data=await r.json();filters();games();}).catch(e=>query('#games').textContent=e.message);
})();

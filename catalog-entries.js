// A reviewed official build replaces its preview only at the exact tested hash.
// Otherwise the shipped preview and active rooms retain their pinned package.
export function catalogEntries(firstParty,reviewed){
 return [...firstParty.filter(preview=>!reviewed.some(game=>game.id===preview.id&&game.sha256===preview.sha256&&game.source?.url===preview.source?.url&&game.withdrawn)).map(preview=>{
  const approved=reviewed.find(game=>game.id===preview.id&&game.sha256===preview.sha256&&game.source?.url===preview.source?.url&&!game.withdrawn);
  return approved?{...preview,...approved,catalogType:'reviewed'}:preview;
 }),...reviewed.filter(game=>!game.withdrawn&&!firstParty.some(preview=>preview.id===game.id))];
}

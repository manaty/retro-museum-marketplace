import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('every first-party catalog screenshot is served as a PNG',async()=>{
 process.env.NODE_ENV='test';
 const {server}=await import('../server.js');
 const games=JSON.parse(await readFile(new URL('../first-party.json',import.meta.url),'utf8'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(const game of games){
   const response=await fetch(origin+game.screenshot);
   assert.equal(response.status,200,game.id);
   assert.equal(response.headers.get('content-type'),'image/png',game.id);
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',game.id);
  }
  assert.equal((await fetch(origin+'/screens/not-in-catalog.png')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

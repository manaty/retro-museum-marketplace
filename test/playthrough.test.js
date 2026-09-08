import test from 'node:test';import assert from 'node:assert/strict';
import {verifiedPlaythrough,PLAYTHROUGH_CHECKS} from '../playthrough.js';
import {catalogEntries} from '../catalog-entries.js';
const expected={hash:'a'.repeat(64),source:{commit:'b'.repeat(40)}};
const evidence={schemaVersion:1,sha256:expected.hash,sourceCommit:expected.source.commit,reviewer:{name:'Independent runner',kind:'agent'},checkedAt:new Date().toISOString(),checks:Object.fromEntries(PLAYTHROUGH_CHECKS.map(k=>[k,true])),evidenceUrl:'https://github.com/manaty/example/blob/main/QA.md',scope:'Browser interaction and host lifecycle tests, not exhaustive device coverage.'};
test('authenticated gameplay evidence is tied to both exact artifact and source commit',()=>{
 assert.ok(verifiedPlaythrough(evidence,expected));
 for(const invalid of [null,{...evidence,sha256:'c'.repeat(64)},{...evidence,sourceCommit:'c'.repeat(40)},{...evidence,checks:{...evidence.checks,replay:false}},{...evidence,reviewer:{kind:'author',name:'author'}},{...evidence,checkedAt:'invalid'}])assert.equal(verifiedPlaythrough(invalid,expected),null);
});
test('only an approved matching repository and package can replace an official preview',()=>{
 const preview={id:'chess',sha256:expected.hash,source:{url:'https://github.com/manaty/game-chess'},catalogType:'publisher_preview',screenshot:'/screens/chess.png'};
 const approved={...preview,reportId:'review-id'};
 assert.equal(catalogEntries([preview],[approved])[0].catalogType,'reviewed');
 assert.equal(catalogEntries([preview],[{...approved,sha256:'different'}])[0].catalogType,'publisher_preview');
 assert.equal(catalogEntries([preview],[{...approved,source:{url:'https://github.com/outsider/chess'}}])[0].catalogType,'publisher_preview');
 assert.equal(catalogEntries([preview],[{...approved,withdrawn:true}]).length,0);
});

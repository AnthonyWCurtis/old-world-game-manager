import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPublishedUnitProfiles} from '../docs/live-source.js';
const rider='https://tow.whfb.app/unit/example-rider';
const mount='https://tow.whfb.app/unit/example-chariot';
const other='https://tow.whfb.app/unit/unrelated';
const entry=url=>({url,source:'tow.whfb.app',verificationStatus:'source-extracted',
 models:[{name:'Verified Model'}],publishedArmour:{sourceUrl:url,value:4,label:'4+',verificationStatus:'source-page-extracted'}});
test('published profiles include exact source-linked selected mounts, not unrelated catalogue pages',()=>{
 const army={units:[{reference:{url:rider},selections:[
  {name:'Mounted Chariot',reference:{url:mount}},
  {name:'Unlinked selection',reference:{url:'https://evil.example/unit/chariot'}}]}]};
 const result=selectPublishedUnitProfiles(army,{schemaVersion:2,sourceOrigin:'https://tow.whfb.app',
  profiles:{[rider]:entry(rider),[mount]:entry(mount),[other]:entry(other)}});
 assert.deepEqual(Object.keys(result).sort(),[rider,mount].sort());
 assert.equal(result[mount].publishedArmour.value,4);
});
test('nested and model-group selected units are included, but incomplete snapshots are refused',()=>{
 const army={units:[{reference:{url:rider},selections:[
  {name:'Options',children:[{name:'Selected Mount',reference:{url:mount}}]}],
  modelGroups:[{selections:[{name:'Nested Mount',reference:{url:mount}}]}]}]};
 const payload={schemaVersion:2,sourceOrigin:'https://tow.whfb.app',profiles:{[mount]:entry(mount)}};
 assert.deepEqual(Object.keys(selectPublishedUnitProfiles(army,payload)),[mount]);
 assert.deepEqual(selectPublishedUnitProfiles(army,{...payload,sourceOrigin:'https://other.invalid'}),{});
});

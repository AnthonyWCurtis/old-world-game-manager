import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourcePrintedArmour} from '../docs/source-printed-armour.js';
const source='https://tow.whfb.app/unit/lothern-skycutter';
const record={source:{sourceUrl:source}};
const fallback={publishedArmour:{sourceUrl:source,value:4,label:'4+',verificationStatus:'source-page-extracted'}};
test('only exact source-provenance match exposes printed chassis value',()=>{
 assert.deepEqual(sourcePrintedArmour(record,fallback),{
  label:'4+',value:4,sourceUrl:source,
  scope:'Published unit/chassis value; model allocation and application not established'
 });
});
test('unverified or mismatched armour never reaches the Defence Summary',()=>{
 assert.equal(sourcePrintedArmour({source:{sourceUrl:'https://tow.whfb.app/unit/other'}},fallback),null);
 assert.equal(sourcePrintedArmour(record,{publishedArmour:{...fallback.publishedArmour,verificationStatus:'unresolved'}}),null);
 assert.equal(sourcePrintedArmour(record,{publishedArmour:{...fallback.publishedArmour,label:'3+'}}),null);
 assert.equal(sourcePrintedArmour(record,{publishedArmour:{...fallback.publishedArmour,value:8,label:'8+'}}),null);
 assert.equal(sourcePrintedArmour({source:{sourceUrl:'https://other.invalid/unit/foo'}},
  {publishedArmour:{sourceUrl:'https://other.invalid/unit/foo',value:4,label:'4+',verificationStatus:'source-page-extracted'}}),null);
 assert.equal(sourcePrintedArmour(record,{}),null);
});
test('printed armour is displayed separately and never passed into equipment armour computation',()=>{
 const roster=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../docs/defence-engine.js',import.meta.url),'utf8');
 assert.match(roster,/Published unit\/chassis armour:/);
 assert.match(roster,/this does not replace the equipment-only Armour value/);
 assert.match(roster,/sourcePrintedArmour\(records\[entry\.id\],fallbackProfiles/);
 assert.match(roster,/sourcePrintedArmour\(record,fallback\)/);
 assert.doesNotMatch(engine,/sourcePrintedArmour|publishedArmour/);
});

test('offline app shell includes every added Defence Summary module',()=>{
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(sw,/['"]\.\/source-printed-armour\.js['"]/);
 assert.match(sw,/CACHE_NAME='game-manager-v1-shell-20261111-source-armour-v1'/);
});

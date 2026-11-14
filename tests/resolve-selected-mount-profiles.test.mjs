import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSelectedMountProfiles} from '../docs/resolve-selected-mount-profiles.js';
const url='https://tow.whfb.app/unit/test-chariot';
const rider='https://tow.whfb.app/unit/test-character';
const unit={reference:{url:rider},selections:[{name:'Test Chariot',reference:{url}}]};
const record={id:'unit:test-chariot',name:'Test Chariot',source:{sourceUrl:url,
 verificationStatus:'source-extracted'},classification:{unitCategory:['Chariot'],
 troopType:['Heavy Chariot']}};
const fallback={[url]:{publishedArmour:{sourceUrl:url,value:4,label:'4+',
 verificationStatus:'source-page-extracted'}}};
test('exact imported option link resolves pinned chariot category and printed armour, not final save',()=>{
 const result=resolveSelectedMountProfiles(unit,{[url]:record},fallback,5);
 assert.equal(result.length,1);
 assert.equal(result[0].mountType,'chariot');
 assert.equal(result[0].printedArmour.value,4);
 assert.equal(result[0].comparison.status,'unresolved');
 assert.match(result[0].status,/association and eligibility unverified/);
});
test('no fuzzy mount linkage, unrelated records, or invalid source provenance',()=>{
 assert.deepEqual(resolveSelectedMountProfiles({...unit,selections:[{name:'Test Chariot'}]},
  {[url]:record},fallback,5),[]);
 assert.deepEqual(resolveSelectedMountProfiles(unit,{[url]:{...record,
  source:{sourceUrl:'https://tow.whfb.app/unit/other',verificationStatus:'source-extracted'}}},fallback,5),[]);
 assert.deepEqual(resolveSelectedMountProfiles(unit,{[url]:{...record,
  source:{sourceUrl:url,verificationStatus:'unverified'}}},fallback,5),[]);
 assert.deepEqual(resolveSelectedMountProfiles(unit,{[url]:{...record,
  classification:{unitCategory:['Infantry']}}},fallback,5).map(x=>x.mountType),[]);
});
test('known monster or cavalry selection remains typed and not implicitly verified',()=>{
 for(const [category,type] of [['Monster','riddenMonster'],['Cavalry','cavalry']]){
  const found=resolveSelectedMountProfiles(unit,{[url]:{...record,
   classification:{unitCategory:[category]}}},fallback,5);
  assert.equal(found[0].mountType,type);
  assert.equal(found[0].comparison.status,'unresolved');
 }
});
test('app wires source-unit records to roster and preserves offline snapshot behavior',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const data=readFileSync(new URL('../docs/unit-data.js',import.meta.url),'utf8');
 const roster=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(app,/getSelectedUnitReferenceDetails\(army,index\)/);
 assert.match(app,/selectedUnitSourceRecords/);
 assert.match(data,/getSelectedUnitReferenceDetails/);
 assert.match(roster,/resolveSelectedMountProfiles\(imported,selectedUnitRecords/);
 assert.match(sw,/resolve-selected-mount-profiles\.js/);
});

test('published character mount selection matcher is loaded with a fresh app shell',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(app,/unit-selection-matcher\.js\?v=20261114-character-mount-profiles/);
 assert.match(html,/app\.js\?v=20261114-character-mount-profiles/);
 assert.match(sw,/game-manager-v1-shell-20261114-character-mount-profiles/);
});

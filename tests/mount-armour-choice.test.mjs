import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareRiderMountArmour,MOUNT_ARMOUR_RULES} from '../docs/mount-armour-choice.js';
import {selectedArmourSourceCandidates} from '../docs/selected-armour-candidates.js';
const url='https://tow.whfb.app/unit/example-chariot';
const fallback={publishedArmour:{sourceUrl:url,value:4,label:'4+',verificationStatus:'source-page-extracted'}};
test('chariot comparison follows better armour rule without conflating shield',()=>{
 const v=compareRiderMountArmour({mountType:'chariot',modelScopeVerified:true,
  riderValue:5,mountValue:4,mountSourceUrl:url});
 assert.equal(v.status,'conditional');
 assert.equal(v.numericallyBetter,4);
 assert.match(v.note,/must not auto-select/i);
 assert.deepEqual(v.choices.map(x=>x.owner),['rider','mount']);
 assert.match(v.note,/rider shield does not alter the mount value/i);
 assert.match(v.note,/magic armour benefits/i);
 assert.equal(v.ruleUrl,MOUNT_ARMOUR_RULES.chariot);
});
test('ridden monster gives explicit choices but cavalry does not use mount armour',()=>{
 const monster=compareRiderMountArmour({mountType:'riddenMonster',modelScopeVerified:true,
  riderValue:3,mountValue:4,mountSourceUrl:url});
 assert.deepEqual(monster.choices.map(x=>x.value),[3,4]);
 const cavalry=compareRiderMountArmour({mountType:'cavalry',modelScopeVerified:true,
  riderValue:5,mountValue:4,mountSourceUrl:url});
 assert.deepEqual(cavalry.choices.map(x=>x.owner),['rider']);
 assert.match(cavalry.note,/Barding/);
});
test('unknown association, type, or mount provenance never produces automatic armour',()=>{
 assert.equal(compareRiderMountArmour({mountType:'chariot',riderValue:5,mountValue:4,mountSourceUrl:url}).status,'unresolved');
 assert.equal(compareRiderMountArmour({mountType:'dragon',modelScopeVerified:true}).status,'unresolved');
 assert.equal(compareRiderMountArmour({mountType:'chariot',modelScopeVerified:true,riderValue:5,
  mountValue:4,mountSourceUrl:'https://untrusted.example/unit/chariot'}).status,'unresolved');
});
test('candidates require an exact source URL attached to a selected option',()=>{
 const selected={selections:[{name:'Example Chariot',reference:{url}},
  {name:'Ward (5+)',reference:{url:'https://tow.whfb.app/special-rules/ward-save'}},
  {name:'No reference'}]};
 const found=selectedArmourSourceCandidates(selected,{[url]:fallback});
 assert.equal(found.length,1);
 assert.equal(found[0].label,'4+');
 assert.match(found[0].associationStatus,/unverified/);
 assert.deepEqual(selectedArmourSourceCandidates({selections:[{name:'Example Chariot'}]},{[url]:fallback}),[]);
 assert.deepEqual(selectedArmourSourceCandidates(selected,{[url]:{publishedArmour:{...fallback.publishedArmour,
  verificationStatus:'unresolved'}}}),[]);
});
test('all modules are available in offline cache and UI keeps model scope uncertain',()=>{
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 for(const file of ['mount-armour-choice.js','selected-armour-candidates.js'])
  assert.ok(sw.includes("'./"+file+"'"));
 assert.match(ui,/Selected-option armour references/);
 assert.match(ui,/mount role unresolved/);
 assert.match(ui,/Chariot\/ridden-monster armour may offer a rider-or-mount choice/);
});

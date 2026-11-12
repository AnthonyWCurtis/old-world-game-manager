import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedMountProfileGroups} from '../docs/selected-mount-profile-rows.js';
const mount='https://tow.whfb.app/unit/source-chariot';
const candidate={sourceUrl:mount,name:'Chosen Chariot',mountType:'chariot'};
const record={source:{sourceUrl:mount,verificationStatus:'source-extracted'},
 modelProfiles:[
  {name:'Chariot',characteristics:{M:0,WS:3,BS:3,S:5,T:5,W:4,I:2,A:2,Ld:7}},
  {name:'Crew',characteristics:{M:5,WS:4,S:3,A:1}},
  {name:'Beasts',characteristics:{M:8,WS:3,S:4,A:1}}
 ]};
test('shows each published mount/chariot model profile independently of rider',()=>{
 const groups=selectedMountProfileGroups([candidate],{[mount]:record},{});
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].profiles.map(p=>p.name),['Chariot','Crew','Beasts']);
 assert.equal(groups[0].profiles[0].characteristics.M,0);
 assert.equal(groups[0].profiles[1].characteristics.T,undefined);
 assert.match(groups[0].verificationStatus,/not rules-verified/);
});
test('does not accept an unrelated source, changed URL or unverified mount record',()=>{
 assert.deepEqual(selectedMountProfileGroups([candidate],
  {[mount]:{...record,source:{sourceUrl:'https://tow.whfb.app/unit/other',verificationStatus:'source-extracted'}}},{}),[]);
 assert.deepEqual(selectedMountProfileGroups([candidate],
  {[mount]:{...record,source:{sourceUrl:mount,verificationStatus:'unverified'}}},{}),[]);
 assert.deepEqual(selectedMountProfileGroups([{...candidate,sourceUrl:'https://evil.example/unit/x'}],{[mount]:record},{}),[]);
 assert.deepEqual(selectedMountProfileGroups([{...candidate,mountType:'unknown'}],{[mount]:record},{}),[]);
});
test('missing mount statistics stay blank rather than being guessed from the rider',()=>{
 const groups=selectedMountProfileGroups([candidate],{[mount]:{...record,modelProfiles:[]}},{});
 assert.equal(groups[0].profiles.length,0);
});
test('verified name-only fallback preserves uncertainty of unpublished stat fields',()=>{
 const groups=selectedMountProfileGroups([candidate],
  {[mount]:{...record,modelProfiles:[]}},
  {[mount]:{url:mount,verificationStatus:'source-extracted',models:[{name:'Chariot',characteristics:{WS:3}}]}});
 assert.deepEqual(groups[0].profiles,[{name:'Chariot',characteristics:{WS:3}}]);
});
test('roster renders chosen mount below the rider, including attached characters',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(ui,/Selected mount: /);
 assert.match(ui,/army-profile-mount-row/);
 assert.match(ui,/Selected mount source profiles/);
 assert.match(ui,/selectedMountProfileGroups\(linkedMounts,selectedUnitRecords,fallbackProfiles\)/);
 assert.match(ui,/selectedMountProfileGroups\(\s*resolveSelectedMountProfiles\(original,selectedUnitRecords,fallbackProfiles\)/);
 assert.match(sw,/\.\/selected-mount-profile-rows\.js/);
});

test('mount profiles also hide source-listed unselected optional crew variants',()=>{
 const optional={...record,modelProfiles:[{name:'Crew',characteristics:{WS:3}},
  {name:'Master Crew',characteristics:{WS:4}}],
  upgradeGroups:[{options:[{description:'Upgrade one model to a Master Crew (champion)'}]}]};
 const without=selectedMountProfileGroups([candidate],{[mount]:optional},{},{selections:[]});
 assert.deepEqual(without[0].profiles.map(x=>x.name),['Crew']);
 const withChampion=selectedMountProfileGroups([candidate],{[mount]:optional},{},
  {selections:[{name:'Master Crew (champion)'}]});
 assert.deepEqual(withChampion[0].profiles.map(x=>x.name),['Crew','Master Crew']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {displayModelProfiles,selectedPublishedOptionalRules,importedSelectionMatchesName} from '../docs/imported-unit-display.js';
const read=shard=>JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records;
const ship=read('0c')['unit:ships-company'],sea=read('0f')['unit:lothern-sea-guard'];
const army=parseArmy(readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8'));
const shipUnit=army.units.find(u=>u.name==="Ship's Company");
const seaUnit=army.units.find(u=>u.name==='Lothern Sea Guard');
test('16 Ship\'s Company with no command do not show Midshipman or Bosun alternatives',()=>{
 assert.ok(shipUnit);
 assert.deepEqual(displayModelProfiles(shipUnit,ship).map(x=>x.name),["Ship's Company"]);
 assert.deepEqual(selectedPublishedOptionalRules(shipUnit,ship),[]);
 assert.deepEqual(ship.modelProfiles.map(x=>x.name),["Ship's Company",'Midshipman','Bosun'],
  'Raw source data must remain unmodified');
});
test('source-backed selected champion is shown; other champion choice remains hidden',()=>{
 const unit={...shipUnit,selections:[...shipUnit.selections,{name:'Midshipman (champion)',children:[]}]};
 assert.deepEqual(displayModelProfiles(unit,ship).map(x=>x.name),["Ship's Company",'Midshipman']);
 const other={...shipUnit,selections:[{name:'Bosun',children:[]}]};
 assert.deepEqual(displayModelProfiles(other,ship).map(x=>x.name),["Ship's Company",'Bosun']);
 assert.equal(importedSelectionMatchesName(unit,'Bosun'),false);
});
test('nested selection, model group, counted wording and optional rule are recognized',()=>{
 const unit={selections:[{name:'Command',children:[{name:'1x Midshipman (champion)'}]},
  {name:'Veterans'}],modelGroups:[{selections:[{name:'Bosun'}]}]};
 assert.deepEqual(displayModelProfiles(unit,ship).map(x=>x.name),["Ship's Company",'Midshipman','Bosun']);
 assert.deepEqual(selectedPublishedOptionalRules(unit,sea).map(x=>x.name),['Veteran']);
});
test('the imported Sea Master is shown when explicitly chosen',()=>{
 assert.ok(seaUnit);
 assert.deepEqual(displayModelProfiles(seaUnit,sea).map(x=>x.name),['Sea Guard','Sea Master']);
 const noChampion={...seaUnit,selections:seaUnit.selections.filter(s=>!
  /Sea Master/i.test(s.name||s.raw||''))};
 assert.deepEqual(displayModelProfiles(noChampion,sea).map(x=>x.name),['Sea Guard']);
});
test('no optional upgrade metadata means no unjustified profile hiding',()=>{
 const record={modelProfiles:[{name:'War Machine'},{name:'Crew'},{name:'Beasts'}],
  upgradeGroups:[]};
 assert.deepEqual(displayModelProfiles({selections:[]},record).map(x=>x.name),
  ['War Machine','Crew','Beasts']);
});
test('roster uses selected model rows; source alternatives not activated',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 assert.match(ui,/displayModelProfiles\(unit,record,fallback\)/);
 assert.match(ui,/selectedPublishedOptionalRules\(unit,record\)/);
 assert.doesNotMatch(ui,/\['Optional rules — not active automatically',record\.optionalRules\]/);
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(sw,/\.\/imported-unit-display\.js/);
});

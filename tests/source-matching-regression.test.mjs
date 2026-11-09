import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {findIndexedReference,applyIndexedReferences,applyProfileReferences,extractSemanticLabels} from '../docs/live-source.js';

const read=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');
const magicIndex=[
 {name:'Burning Blade*',kind:'item',url:'https://tow.whfb.app/magic-item/burning-blade'},
 {name:'Opal Amulet*',kind:'item',url:'https://tow.whfb.app/magic-item/opal-amulet'},
 {name:'Ring of Fury*',kind:'item',url:'https://tow.whfb.app/magic-item/ring-of-fury'}
];
test('Editorial starred item labels match unstarred exporter names without invented URLs',()=>{
 for(const name of ['Burning Blade','Opal Amulet','Ring of Fury']){
  const ref=findIndexedReference(name,false,magicIndex);
  assert.ok(ref,name);
  assert.equal(ref.url,'https://tow.whfb.app/magic-item/'+name.toLowerCase().replace(/ /g,'-'));
 }
 assert.equal(findIndexedReference('Ring of Doom',false,magicIndex),null);
});
test('Unique real source items improve the parsed roster without changing points',()=>{
 const army=parseArmy(read('nr-tow-footer'));
 const before=army.army.derivedPoints.value;
 const unitNames=army.units.map(u=>u.name);
 applyIndexedReferences(army,magicIndex);
 assert.equal(army.army.derivedPoints.value,before);
 assert.deepEqual(army.units.map(u=>u.name),unitNames);
 assert.equal(army.units[0].selections.find(s=>s.name==='Burning Blade')?.matchStatus,'matched');
 assert.equal(army.units[1].selections.find(s=>s.name==='Opal Amulet')?.matchStatus,'matched');
 for(const helm of army.units.filter(u=>u.name==='Silver Helms'))
  assert.equal(helm.selections.find(s=>s.name==='Ring of Fury')?.matchStatus,'matched');
});
test('Profile references link published model titles and level only for their parent unit',()=>{
 const army=parseArmy(read('nr-tow-footer'));
 const archmage=army.units.find(u=>u.name==='Archmage');
 const prince=army.units.find(u=>u.name==='Prince');
 const silver=army.units.find(u=>u.name==='Silver Helms');
 const sisters=army.units.find(u=>u.name==='Sisters of Avelorn');
 for(const u of [archmage,prince,silver,sisters])assert.ok(u.reference?.url,u.name);
 const profiles={
  [archmage.reference.url]:{url:archmage.reference.url,schemaVersion:2,models:[{name:'Archmage'}],wizardLevels:[3,4]},
  [prince.reference.url]:{url:prince.reference.url,schemaVersion:2,models:[{name:'Prince'}],wizardLevels:[]},
  [silver.reference.url]:{url:silver.reference.url,schemaVersion:2,models:[{name:'Silver Helm'},{name:'High Helm'}],wizardLevels:[]},
  [sisters.reference.url]:{url:sisters.reference.url,schemaVersion:2,models:[{name:'Sister of Avelorn'},{name:'High Sister'}],wizardLevels:[]}
 };
 const original=army.units.map(u=>[u.name,u.reportedPoints.value]);
 const first=applyProfileReferences(army,profiles);
 assert.ok(first.added>=6);
 assert.equal(archmage.selections.find(s=>s.name==='Wizard Level 3').matchStatus,'matched');
 for(const helm of army.units.filter(u=>u.name==='Silver Helms'))
  assert.equal(helm.selections.find(s=>s.name==='High Helm').matchStatus,'matched');
 for(const unit of army.units.filter(u=>u.name==='Sisters of Avelorn'))
  assert.equal(unit.selections.find(s=>s.name==='High Sister').matchStatus,'matched');
 assert.deepEqual(army.units.map(u=>[u.name,u.reportedPoints.value]),original);
 const repeat=applyProfileReferences(army,profiles);
 assert.equal(repeat.added,0);
 assert.equal(army.stats.selectionCount,28);
});
test('Multiple separately linked TOW troop classifications retain their separator',()=>{
 const el={textContent:'Troop Type: Regular InfantryCharacter',
  querySelectorAll:()=>[{textContent:'Regular Infantry'},{textContent:'Character'}]};
 assert.equal(extractSemanticLabels(el,'Troop Type:'),'Regular Infantry / Character');
 const plain={textContent:'Unit Category: Cavalry',querySelectorAll:()=>[]};
 assert.equal(extractSemanticLabels(plain,'Unit Category:'),'Cavalry');
 assert.equal(extractSemanticLabels(null,'Troop Type:'),null);
});

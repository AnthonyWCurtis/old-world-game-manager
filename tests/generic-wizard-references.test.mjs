import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {allArmySelections} from '../docs/selection-information.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {applySourceScopedSelectionReferences} from '../docs/unit-selection-matcher.js';
import {matchWizardRuleReference,applyGenericWizardReferences} from '../docs/wizard-references.js';

const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');

test('generic links are defined for Wizard and each published level 1–4, not eligibility',()=>{
 const plain=matchWizardRuleReference({name:'Wizard',kind:'wizard-level'});
 assert.equal(plain.url,'https://tow.whfb.app/magic/wizards');
 assert.equal(plain.source,'generic-wizard-rule');
 assert.equal(plain.eligibilityVerified,false);
 for(let level=1;level<=4;level++){
  const ref=matchWizardRuleReference({name:'Level '+level+' Wizard',kind:'wizard-level'});
  assert.equal(ref.url,'https://tow.whfb.app/magic/levels-of-wizardry');
  assert.equal(ref.eligibilityVerified,false);
  assert.equal(ref.source,'generic-wizard-rule');
  assert.equal(ref.level,level);
 }
 assert.equal(matchWizardRuleReference({name:'  LEVEL   3  WiZaRd  ',kind:'wizard-level'}).level,3);
});

test('unrelated words, wrong categories and nonexistent wizard levels stay unresolved',()=>{
 for(const name of ['Level 0 Wizard','Level 5 Wizard','Level 10 Wizard','Wizard Level 3',
  'Wizard Apprentice',"Wizard's Staff",'Wizard Staff','Wizard (Level 3)']){
  assert.equal(matchWizardRuleReference({name,kind:'wizard-level'}),null,name);
 }
 assert.equal(matchWizardRuleReference({name:'Wizard',kind:'equipment'}),null);
 assert.equal(matchWizardRuleReference({name:'Level 4 Wizard',kind:'magic-lore'}),null);
 assert.equal(matchWizardRuleReference({kind:'wizard-level'}),null);
 assert.equal(matchWizardRuleReference(null),null);
});

test('the real 17-entry 2,599-point Storm Weaver import resolves nested Wizard without changing original choices',()=>{
 const army=parseArmy(fixture);
 const old=structuredClone(army);
 const storm=army.units.find(u=>u.name==='Storm Weaver');
 assert.ok(storm);
 const wizard=storm.selections.find(s=>s.name==='Wizard');
 const level=wizard?.children.find(s=>s.name==='Level 3 Wizard');
 assert.equal(wizard.matchStatus,'unmatched');
 assert.ok(level?.reference,'Source-reviewed Level 3 existing match must survive');
 const childRef=structuredClone(level.reference);
 const before=army.stats.unmatchedSelections;
 const result=applyGenericWizardReferences(army);
 assert.ok(result.added>=1);
 assert.equal(wizard.matchStatus,'matched');
 assert.equal(wizard.reference.url,'https://tow.whfb.app/magic/wizards');
 assert.equal(wizard.reference.eligibilityVerified,false);
 assert.deepEqual(level.reference,childRef);
 assert.equal(army.stats.unmatchedSelections,before-result.added);
 assert.equal(army.units.length,17);
 assert.equal(army.army.derivedPoints.value,2599);
 assert.equal(army.army.reportedPoints.value,2599);
 for(let i=0;i<army.units.length;i++){
  const original=old.units[i],current=army.units[i];
  assert.equal(current.rawHeading,original.rawHeading);
  assert.deepEqual(current.quantity,original.quantity);
  assert.deepEqual(current.reportedPoints,original.reportedPoints);
  assert.deepEqual(current.selections.map(s=>s.raw),original.selections.map(s=>s.raw));
 }
 assert.equal(applyGenericWizardReferences(army).added,0,'Safe to apply repeatedly');
});

test('generic pass covers model-group selections and never overwrites a reviewed reference',()=>{
 const item=(name,kind='wizard-level',reference=null)=>({
  name,kind,raw:name,reference,matchStatus:reference?'matched':'unmatched',children:[]
 });
 const reviewed={id:'reviewed:wizard',url:'https://tow.whfb.app/unit/mage',type:'wizard-level'};
 const a={name:'A',id:'u1',matchStatus:'matched',
  selections:[item('Wizard','wizard-level',reviewed),
   item('On foot','mount-state'),item('Wizard Level 3')],
  modelGroups:[{quantity:1,selections:[item('Level 4 Wizard')]}]};
 const army={units:[a],stats:{unitCount:1,selectionCount:4,matchedUnits:1,
  unmatchedUnits:0,matchedSelections:1,unmatchedSelections:3}};
 const beforeRef=a.selections[0].reference;
 assert.equal(applyGenericWizardReferences(army).added,1);
 assert.equal(a.selections[0].reference,beforeRef);
 assert.equal(a.modelGroups[0].selections[0].reference.level,4);
 assert.equal(a.selections[1].reference,null);
 assert.equal(a.selections[2].reference,null);
 assert.equal(army.stats.unmatchedSelections,1);
 assert.equal(allArmySelections(army).length,4);
});

test('unit-page wizard evidence refines the generic link, but only for that specific parent',()=>{
 const army=parseArmy(fixture);
 const mage=army.units.find(u=>u.name==='Mage');
 const storm=army.units.find(u=>u.name==='Storm Weaver');
 const generic=applyGenericWizardReferences(army);
 assert.ok(generic.added>=1);
 const mageWizard=mage.selections.find(s=>s.name==='Wizard');
 const stormWizard=storm.selections.find(s=>s.name==='Wizard');
 assert.equal(mageWizard.reference.source,'generic-wizard-rule');
 assert.equal(stormWizard.reference.source,'generic-wizard-rule');
 const readRecord=slug=>{
  const id='unit:'+slug;
  const shard=shardForId(id);
  return JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records[id];
 };
 const records={[mage.id]:readRecord('mage'),[storm.id]:readRecord('storm-weaver')};
 const result=applySourceScopedSelectionReferences(army,records);
 assert.equal(result.added,0,'Replacing a generic reference is refinement, not a newly matched selection');
 assert.equal(mageWizard.reference.source,'unit-scoped-data');
 assert.equal(mageWizard.reference.evidence,'source-page-magic-clause');
 assert.equal(stormWizard.reference.source,'generic-wizard-rule',
  'Storm Weaver has no stored parent-specific wizard evidence, so generic link remains');
 assert.equal(army.army.derivedPoints.value,2599);
 assert.ok(!allArmySelections(army).some(s=>s.name==='Wizard'&&s.matchStatus!=='matched'));
});

test('live app applies the generic pass to imported and saved armies before source refresh',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const shell=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(app,/import \{applyGenericWizardReferences\} from '\.\/wizard-references\.js/);
 assert.match(app,/current=parseArmy\(input,sourceOverride\(\)\);applyInformationalPlaceholders\(current\);applyGenericWizardReferences\(current\)/);
 assert.match(app,/current=restoreStoredImport\(loaded\);applyInformationalPlaceholders\(current\);applyGenericWizardReferences\(current\)/);
 assert.match(app,/s\.reference\?\.source==='generic-wizard-rule'/);
 assert.match(shell,/\.\/wizard-references\.js/);
});

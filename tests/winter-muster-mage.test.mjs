import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {allArmySelections} from '../docs/selection-information.js';
import {applySourceScopedSelectionReferences,
 findSourceScopedSelectionReference,SOURCE_VERIFIED_WIZARDS} from '../docs/unit-selection-matcher.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';

const id='unit:mage';
const mage=JSON.parse(readFileSync(new URL(
 '../docs/unit-data/shards/'+shardForId(id)+'.json',import.meta.url),'utf8')).records[id];
assert.ok(mage,'Mage source record missing');

/**
 * The user shared a 750-point Old World Builder Winter Muster debug with five
 * units, but not its full list. This fixture reconstructs the exact reported
 * nested Mage selection inside five units named and costed from the existing
 * Winter Muster test example. It is a parser test, not a claim of army legality.
 */
const winterMuster=[
 '===',
 'Winter Muster [750 pts]',
 'Warhammer: The Old World, High Elf Realms, Combined Arms',
 '===',
 '',
 '++ Characters [200 pts] ++',
 '',
 'Handmaiden of the Everqueen [90 pts]',
 '- Hand weapon',
 '- General',
 '- Bow of Avelorn',
 '',
 'Mage [110 pts]',
 '- Hand weapon',
 '- Wizard [Level 2 Wizard]',
 '- On foot',
 '- High Magic',
 '',
 '++ Core Units [435 pts] ++',
 '',
 '16 Sisters of Avelorn [247 pts]',
 '- Hand weapon',
 '- Bow of Avelorn',
 '- High Sister',
 '',
 '16 Lothern Sea Guard [188 pts]',
 '- Hand weapons',
 '- Thrusting spears',
 '- Warbows',
 '- Light armour',
 '- Shields',
 '- Sea Master',
 '- Standard bearer',
 '',
 '++ Special Units [115 pts] ++',
 '',
 'Lothern Skycutters [115 pts]',
 '- Hand weapons',
 '- Eagle-Eye Bolt Thrower',
 '',
 'Created with "Old World Builder"',
 ''
].join('\n');

function prepare(){
 const army=parseArmy(winterMuster);
 const unit=army.units.find(u=>u.name==='Mage');
 assert.ok(unit,'Mage not parsed');
 const wizard=unit.selections.find(s=>s.name==='Wizard');
 assert.ok(wizard,'Nested Wizard parent not parsed');
 const level=wizard.children.find(s=>s.name==='Level 2 Wizard');
 assert.ok(level,'Nested Level 2 Wizard not parsed');
 const records={[unit.id]:mage};
 return {army,unit,wizard,level,records};
}

test('Source Mage is Level 1 by default, and its published optional Level 2 option costs +30 points',()=>{
 assert.equal(mage.name,'Mage');
 assert.equal(mage.source.sourceUrl,'https://tow.whfb.app/unit/mage');
 assert.equal(mage.source.verificationStatus,'source-extracted');
 assert.equal(mage.modelProfiles[0].name,'Mage');
 assert.deepEqual(SOURCE_VERIFIED_WIZARDS[id],{
  sourceUrl:'https://tow.whfb.app/unit/mage',
  verifiedOn:'2026-11-10',
  baseWizardLevel:1,
  upgradeWizardLevels:[2],
  evidenceSection:'Magic',
  evidenceText:'Mage is a Level 1 Wizard'
 });
 const matches=mage.upgradeGroups.flatMap(g=>g.options).filter(o=>
  o.description==='Be a Level 2 Wizard +30 points');
 assert.equal(matches.length,1);
});

test('Winter Muster OWB nested Mage Wizard and Level 2 both source-match, preserving 750pts and selections',()=>{
 const {army,unit,wizard,level,records}=prepare();
 assert.equal(army.format.exporter,'old-world-builder');
 assert.equal(army.format.layout,'regular-text');
 assert.equal(army.units.length,5);
 assert.equal(army.army.reportedPoints.value,750);
 assert.equal(army.army.derivedPoints.value,750);
 assert.equal(unit.reportedPoints.value,110);
 assert.equal(wizard.matchStatus,'unmatched');
 assert.equal(level.matchStatus,'unmatched');
 const oldMissing=collectUnmatched(army).length;
 const pristine=JSON.stringify({
  units:army.units.map(u=>({name:u.name,quantity:u.quantity,
   reportedPoints:u.reportedPoints,selections:u.selections})),
  points:army.army.derivedPoints.value
 });
 assert.equal(applySourceScopedSelectionReferences(army,records).added,2);
 assert.equal(wizard.matchStatus,'matched');
 assert.equal(wizard.reference?.url,'https://tow.whfb.app/unit/mage');
 assert.equal(wizard.reference?.source,'unit-scoped-data');
 assert.equal(wizard.reference?.evidence,'source-page-magic-clause');
 assert.match(wizard.reference.note,/Level 1 Wizard by default/);
 assert.equal(level.matchStatus,'matched');
 assert.equal(level.reference?.url,'https://tow.whfb.app/unit/mage');
 assert.equal(level.reference?.source,'unit-scoped-data');
 assert.equal(level.reference?.evidence,'published-wizard-upgrade');
 assert.match(level.reference.note,/not evaluated/);
 assert.equal(collectUnmatched(army).length,oldMissing-2);
 assert.ok(!collectUnmatched(army).some(s=>s.name==='Wizard'||s.name==='Level 2 Wizard'));
 assert.equal(army.stats.selectionCount,allArmySelections(army).length);
 assert.equal(army.army.derivedPoints.value,750);
 assert.equal(unit.reportedPoints.value,110);
 const original=JSON.parse(pristine);
 assert.deepEqual(army.units.map(u=>({name:u.name,quantity:u.quantity,reportedPoints:u.reportedPoints})),
  original.units.map(u=>({name:u.name,quantity:u.quantity,reportedPoints:u.reportedPoints})));
 assert.deepEqual(army.units.map(u=>u.selections.map(s=>s.raw)),
  original.units.map(u=>u.selections.map(s=>s.raw)));
 assert.equal(applySourceScopedSelectionReferences(army,records).added,0);
});

test('Mage wizard matching is exclusive to its published model profile and Level 2 option',()=>{
 const {unit,wizard,level}=prepare();
 const find=name=>findSourceScopedSelectionReference(unit,mage,{name,kind:'wizard-level'});
 assert.equal(find('Wizard')?.evidence,'source-page-magic-clause');
 assert.equal(find('Level 1 Wizard')?.evidence,'source-page-default-wizard-level');
 assert.equal(find('Level 2 Wizard')?.evidence,'published-wizard-upgrade');
 assert.equal(find('Level 3 Wizard'),null);
 assert.equal(find('Level 4 Wizard'),null);
 assert.equal(find('Wizard Level 3'),null);
 const stripped=structuredClone(mage);
 stripped.upgradeGroups=stripped.upgradeGroups.map(g=>({...g,
  options:g.options.filter(o=>o.description!=='Be a Level 2 Wizard +30 points')}));
 assert.equal(findSourceScopedSelectionReference(unit,stripped,level),null,
  'Level 2 requires an explicit published option');
 assert.equal(findSourceScopedSelectionReference(unit,stripped,wizard)?.type,'wizard');
 const spoofed=structuredClone(mage);
 spoofed.source.sourceUrl='https://example.test/unit/mage';
 assert.equal(findSourceScopedSelectionReference(unit,spoofed,level),null);
 const withoutMageModel=structuredClone(mage);
 withoutMageModel.modelProfiles=[{name:'Other model'}];
 assert.equal(findSourceScopedSelectionReference(unit,withoutMageModel,wizard),null);
 const wronglyLinked={...unit,reference:{url:'https://tow.whfb.app/unit/archmage'}};
 assert.equal(findSourceScopedSelectionReference(wronglyLinked,mage,level),null);
});

test('Archmage and Shadowdancer previously verified wizard levels continue to work',()=>{
 for(const [slug,wizardLevel,evidence] of [
  ['archmage','Level 4 Wizard','published-wizard-upgrade'],
  ['shadowdancer','Level 1 Wizard','published-wizard-upgrade']
 ]){
  const refId='unit:'+slug,shard=shardForId(refId);
  const record=JSON.parse(readFileSync(new URL(
   '../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records[refId];
  const unit={name:record.name,reference:{url:record.source.sourceUrl}};
  assert.equal(findSourceScopedSelectionReference(unit,record,
   {name:wizardLevel,kind:'wizard-level'})?.evidence,evidence);
 }
});

test('Game Manager v0.4.4 wires the Mage fix after loading its reference shard',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 assert.match(app,/applySourceScopedSelectionReferences\(army,unitDataRecords\)/);
 assert.match(app,/appVersion:'0\.5\.1'/);
 assert.match(html,/Browser Edition v0\.5\.1/);
 assert.match(html,/app\.js\?v=0\.5\.1/);
 assert.match(app,/unit-selection-matcher\.js\?v=0\.5\.1/);
});

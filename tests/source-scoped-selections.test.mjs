import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {applySourceScopedSelectionReferences,findSourceScopedSelectionReference,
 SOURCE_VERIFIED_WIZARDS} from '../docs/unit-selection-matcher.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';

const root=new URL('../docs/unit-data/shards/',import.meta.url);
function sourceRecord(slug){
 const id='unit:'+slug;
 const shard=shardForId(id);
 const payload=JSON.parse(readFileSync(new URL(shard+'.json',root),'utf8'));
 const record=payload.records[id];
 assert.ok(record,'Missing source profile '+id);
 return record;
}
const names=[
 'noble','archmage','elven-spearmen','silver-helms',
 'ellyrian-reavers','swordmasters-of-hoeth','sisters-of-avelorn'
];
const profiles=Object.fromEntries(names.map(name=>[name,sourceRecord(name)]));
let id=0;
function selection(name,kind='option',children=[]){
 return {id:'s'+(++id),name,raw:name,line:1,kind,
  reference:null,matchStatus:'unmatched',children,reportedPoints:null};
}
function unit(slug,selections){
 const record=profiles[slug]||sourceRecord(slug);
 return {id:'u'+(++id),name:record.name,reference:{
  url:record.source.sourceUrl,id:record.id,type:'unit',source:'published-unit-data'
 },matchStatus:'matched',selections,modelGroups:[],reportedPoints:{value:250}};
}
function prepare(entries){
 const units=entries.map(([slug,choices])=>unit(slug,choices));
 const records=Object.fromEntries(units.map((u,i)=>[u.id,
  profiles[entries[i][0]]||sourceRecord(entries[i][0])]));
 const count=units.flatMap(u=>u.selections.flatMap(s=>[s,...s.children])).length;
 const army={units,sections:[],stats:{
  unitCount:units.length,selectionCount:count,
  matchedUnits:units.length,unmatchedUnits:0,
  matchedSelections:0,unmatchedSelections:count
 }};
 return {army,records};
}
test('All 16 supplied unmatched selections now have uniquely scoped parent-page evidence',()=>{
 id=0;
 // The debug specifies two Archmages, one default Level 3 and one upgraded Level 4.
 const entries=[
  ['noble',[selection('On foot','mount-state')]],
  ['archmage',[
   selection('Wizard','wizard-level',[selection('Level 3 Wizard','wizard-level')]),
   selection('On foot','mount-state')
  ]],
  ['archmage',[
   selection('Wizard','wizard-level',[selection('Level 4 Wizard','wizard-level')]),
   selection('On foot','mount-state')
  ]],
  ['elven-spearmen',[selection('Standard bearer','command'),selection('Musician','command')]],
  ['silver-helms',[selection('Standard bearer','command'),selection('Musician','command')]],
  ['ellyrian-reavers',[selection('Musician','command')]],
  ['swordmasters-of-hoeth',[
   selection('Swords of Hoeth','option'),selection('Standard bearer','command'),
   selection('Musician','command')
  ]],
  ['sisters-of-avelorn',[selection('Bows of Avelorn','option')]]
 ];
 const {army,records}=prepare(entries);
 const old=JSON.stringify(army.units.map(u=>({selections:u.selections,
  reportedPoints:u.reportedPoints})));
 assert.equal(collectUnmatched(army).length,16);
 const result=applySourceScopedSelectionReferences(army,records);
 assert.equal(result.added,16);
 assert.equal(army.stats.matchedSelections,16);
 assert.equal(army.stats.unmatchedSelections,0);
 assert.equal(collectUnmatched(army).length,0);
 const matched=army.units.flatMap(u=>u.selections.flatMap(s=>[s,...s.children]));
 assert.ok(matched.every(s=>s.reference?.source==='unit-scoped-data'));
 assert.ok(matched.every(s=>s.reference.url.startsWith('https://tow.whfb.app/')));
 assert.equal(army.units[0].selections[0].reference.evidence,'unmounted-character-default');
 assert.equal(army.units[1].selections[0].children[0].reference.evidence,'source-page-default-wizard-level');
 assert.equal(army.units[2].selections[0].children[0].reference.evidence,'published-wizard-upgrade');
 assert.equal(army.units[6].selections[0].reference.url,'https://tow.whfb.app/weapons-of-war/sword-of-hoeth');
 assert.equal(army.units[7].selections[0].reference.url,'https://tow.whfb.app/weapons-of-war/bow-of-avelorn');
 assert.deepEqual(army.units.map(u=>u.reportedPoints.value),Array(8).fill(250));
 assert.equal(army.stats.matchedUnits,8);
 const repeat=applySourceScopedSelectionReferences(army,records);
 assert.equal(repeat.added,0);
 assert.equal(army.stats.matchedSelections,16);
 // Selection raw text, kind, children and exported numeric points remain intact.
 assert.deepEqual(army.units.map(u=>u.selections.flatMap(s=>[s,...s.children]).map(s=>s.raw)),
  JSON.parse(old).map(u=>u.selections.flatMap(s=>[s,...s.children]).map(s=>s.raw)));
});
test('Wizard default/upgrade have individually verified source evidence and parent restrictions',()=>{
 assert.deepEqual(SOURCE_VERIFIED_WIZARDS['unit:archmage'].upgradeWizardLevels,[4]);
 const archmage=profiles.archmage;
 const noble=profiles.noble;
 const s3=selection('Level 3 Wizard','wizard-level');
 const s4=selection('Level 4 Wizard','wizard-level');
 const s2=selection('Level 2 Wizard','wizard-level');
 const a=unit('archmage',[s3,s4,s2]);
 assert.match(findSourceScopedSelectionReference(a,archmage,s3).evidence,/default-wizard-level/);
 assert.equal(findSourceScopedSelectionReference(a,archmage,s4).evidence,'published-wizard-upgrade');
 assert.equal(findSourceScopedSelectionReference(a,archmage,s2),null);
 assert.equal(findSourceScopedSelectionReference(a,noble,s3),null);
 const n=unit('noble',[s4]);
 assert.equal(findSourceScopedSelectionReference(n,noble,s4),null);
});
test('On foot must be a sourced unmounted character state, not a fictional purchasable mount',()=>{
 const onFoot=selection('On foot','mount-state');
 const noble=unit('noble',[onFoot]);
 const found=findSourceScopedSelectionReference(noble,profiles.noble,onFoot);
 assert.equal(found.url,'https://tow.whfb.app/unit/noble');
 assert.equal(found.type,'mount-state');
 assert.equal(found.evidence,'unmounted-character-default');
 assert.match(found.note,/not an upgrade/);
 const horse=selection('Elven Steed','mount-or-component');
 const contradiction=unit('noble',[onFoot,horse]);
 assert.equal(findSourceScopedSelectionReference(contradiction,profiles.noble,onFoot),null);
 const swords=unit('swordmasters-of-hoeth',[onFoot]);
 assert.equal(findSourceScopedSelectionReference(swords,profiles['swordmasters-of-hoeth'],onFoot),null);
});
test('Standard bearer and musician require explicit command options on each parent page',()=>{
 const command=selection('Standard bearer','command');
 const withOption=unit('silver-helms',[command]);
 assert.equal(findSourceScopedSelectionReference(withOption,profiles['silver-helms'],command)?.evidence,
  'published-command-upgrade');
 const without=unit('sisters-of-avelorn',[command]);
 assert.equal(findSourceScopedSelectionReference(without,profiles['sisters-of-avelorn'],command),null);
});
test('Starting equipment is matched from original source URLs, not fuzzy names',()=>{
 const weapon=selection('Swords of Hoeth','option');
 const unitSwords=unit('swordmasters-of-hoeth',[weapon]);
 const match=findSourceScopedSelectionReference(unitSwords,profiles['swordmasters-of-hoeth'],weapon);
 assert.equal(match.url,'https://tow.whfb.app/weapons-of-war/sword-of-hoeth');
 assert.equal(match.evidence,'starting-equipment');
 assert.equal(findSourceScopedSelectionReference(
  unit('silver-helms',[weapon]),profiles['silver-helms'],weapon),null);
 const wrong=selection('Swords of Hoeth Magical Edition','option');
 assert.equal(findSourceScopedSelectionReference(unitSwords,profiles['swordmasters-of-hoeth'],wrong),null);
});
test('Previously reviewed selections always win; unavailable or mismatched profiles stay unmatched',()=>{
 const musician=selection('Musician','command');
 musician.reference={id:'reviewed:musician',url:'https://tow.whfb.app/command-groups/musicians'};
 musician.matchStatus='matched';
 const banner=selection('Standard bearer','command');
 const {army,records}=prepare([['elven-spearmen',[musician,banner]]]);
 const previousRef=musician.reference;
 const result=applySourceScopedSelectionReferences(army,records);
 assert.equal(result.added,1);
 assert.equal(musician.reference,previousRef);
 assert.equal(army.stats.matchedSelections,2);
 const invalid=structuredClone(profiles['elven-spearmen']);
 invalid.source.sourceUrl='https://untrusted.test/unit/elven-spearmen';
 const candidate=selection('Musician','command');
 assert.equal(findSourceScopedSelectionReference(
  unit('elven-spearmen',[candidate]),invalid,candidate),null);
 const state=prepare([['elven-spearmen',[selection('Musician','command')]]]);
 state.records[state.army.units[0].id]=invalid;
 assert.equal(applySourceScopedSelectionReferences(state.army,state.records).added,0);
 assert.equal(state.army.stats.unmatchedSelections,1);
});
test('Published unit matcher is wired after shard loading and reports correct version',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 assert.match(app,/applySourceScopedSelectionReferences\(army,unitDataRecords\)/);
 assert.ok(app.indexOf('unitDataRecords=result.records;')<
  app.indexOf('applySourceScopedSelectionReferences(army,unitDataRecords)'));
 assert.match(app,/appVersion:'0\.4\.1'/);
 assert.match(html,/Browser Edition v0\.4\.1/);
});

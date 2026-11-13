import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {applySourceScopedSelectionReferences,
 findSourceScopedSelectionReference} from '../docs/unit-selection-matcher.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {allArmySelections} from '../docs/selection-information.js';

function data(slug){
 const id='unit:'+slug;
 const shard=shardForId(id);
 const all=JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8'));
 return all.records[id];
}
const bySlug=Object.fromEntries(['waystalker','shadowdancer','glade-guard','wardancers']
 .map(slug=>[slug,data(slug)]));
const realWoodElfText=readFileSync(new URL('../docs/examples/wood-elves.txt',import.meta.url),'utf8');
function fixture(){
 // Reproduce each of the five user-reported unmatched selections in its real
 // parent entry, while preserving the actual supplied sample's army metadata.
 return realWoodElfText
  .replace('- A Resplendence of Luminescents',
   '- The Briar-bow\n- A Resplendence of Luminescents')
  .replace('- Swiftshiver Shards','- Swiftshiver Shards\n- The Kinbands of Modryn\n- Lord\'s Bowmen')
  .replace(/8 Wardancers \[128 pts\]\r?\n- Hand weapon/,
   match=>match+(match.includes('\r\n')?'\r\n':'\n')+'- 9x Additional hand weapon');
}
function prepared(){
 const army=parseArmy(fixture());
 const recordByInstance={};
 for(const unit of army.units){
  const slug=unit.reference?.url?.split('/').at(-1);
  if(bySlug[slug])recordByInstance[unit.id]=bySlug[slug];
 }
 return {army,recordByInstance};
}
function find(army,name,parent){
 return army.units.find(u=>u.name===parent).selections.find(s=>s.name===name);
}
test('Wood Elf 748-point report: 3 source references resolve, Briar-bow and Modryn stay unverified',()=>{
 const {army,recordByInstance}=prepared();
 assert.equal(army.army.reportedPoints.value,748);
 assert.equal(army.format.exporter,'old-world-builder');
 for(const name of ['The Briar-bow','Level 1 Wizard','The Kinbands of Modryn',
  "Lord's Bowmen",'9x Additional hand weapon']){
  assert.equal(allArmySelections(army).filter(s=>s.name===name).length,1,name);
 }
 const beforeUnmatched=collectUnmatched(army).map(s=>s.name);
 assert.ok(beforeUnmatched.includes('The Briar-bow'));
 assert.ok(beforeUnmatched.includes('The Kinbands of Modryn'));
 assert.ok(beforeUnmatched.includes("Lord's Bowmen"));
 assert.ok(beforeUnmatched.includes('9x Additional hand weapon'));
 assert.ok(beforeUnmatched.includes('Level 1 Wizard'));
 const original=JSON.stringify(army.units.map(u=>({
  points:u.reportedPoints,quantity:u.quantity,selections:u.selections.map(s=>({name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints}))
 })));
 const {added}=applySourceScopedSelectionReferences(army,recordByInstance);
 assert.equal(added,3);
 const shadow=find(army,'Level 1 Wizard','Shadowdancer');
 const champion=find(army,"Lord's Bowmen",'Glade Guard');
 const wardancer=find(army,'9x Additional hand weapon','Wardancers');
 assert.equal(shadow.matchStatus,'matched');
 assert.equal(shadow.reference.url,'https://tow.whfb.app/unit/shadowdancer');
 assert.equal(shadow.reference.evidence,'published-wizard-upgrade');
 assert.equal(champion.matchStatus,'matched');
 assert.equal(champion.reference.url,'https://tow.whfb.app/unit/glade-guard');
 assert.equal(champion.reference.evidence,'published-champion-upgrade');
 assert.equal(wardancer.matchStatus,'matched');
 assert.equal(wardancer.reference.url,'https://tow.whfb.app/weapons-of-war/two-hand-weapons-additional-hand-weapon');
 assert.equal(wardancer.reference.sourceQuantity,9);
 assert.equal(wardancer.reference.evidence,'per-model-equipment-option');
 assert.match(wardancer.reference.note,/not been verified/);
 assert.deepEqual(
  collectUnmatched(army).filter(s=>['The Briar-bow','The Kinbands of Modryn',
   "Lord's Bowmen",'9x Additional hand weapon','Level 1 Wizard'].includes(s.name))
   .map(s=>s.name),['The Briar-bow','The Kinbands of Modryn']);
 const briar=find(army,'The Briar-bow','Waystalker');
 const kinband=find(army,'The Kinbands of Modryn','Glade Guard');
 assert.equal(briar.matchStatus,'unmatched');
 assert.equal(kinband.matchStatus,'unmatched');
 assert.equal(briar.reference,null);
 assert.equal(kinband.reference,null);
 assert.equal(army.army.derivedPoints.value,748);
 assert.equal(JSON.stringify(army.units.map(u=>({
  points:u.reportedPoints,quantity:u.quantity,selections:u.selections.map(s=>({name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints}))
 }))),original);
 assert.equal(applySourceScopedSelectionReferences(army,recordByInstance).added,0);
});
test('Shadowdancer wizard reference needs exact published optional level and parent unit',()=>{
 const rec=bySlug.shadowdancer;
 const entry={reference:{url:rec.source.sourceUrl}};
 const candidate=name=>({name,kind:'wizard-level'});
 const lv1=findSourceScopedSelectionReference(entry,rec,candidate('Level 1 Wizard'));
 assert.equal(lv1.url,rec.source.sourceUrl);
 assert.equal(lv1.type,'wizard-level');
 assert.match(lv1.note,/optional upgrade/);
 assert.equal(findSourceScopedSelectionReference(entry,rec,candidate('Level 2 Wizard')),null);
 assert.equal(findSourceScopedSelectionReference(entry,rec,candidate('Level 3 Wizard')),null);
 assert.equal(findSourceScopedSelectionReference({reference:{url:bySlug.waystalker.source.sourceUrl}},bySlug.waystalker,candidate('Level 1 Wizard')),null);
 const withoutOption=structuredClone(rec);
 withoutOption.upgradeGroups=withoutOption.upgradeGroups.filter(g=>!g.options.some(o=>o.description.includes('Level 1 Wizard')));
 assert.equal(findSourceScopedSelectionReference(entry,withoutOption,candidate('Level 1 Wizard')),null);
});
test('Lord’s Bowmen is exact source-specific plural for the published Lord’s Bowman champion',()=>{
 const rec=bySlug['glade-guard'];
 const parent={reference:{url:rec.source.sourceUrl}};
 const forName=name=>findSourceScopedSelectionReference(parent,rec,{name,kind:'option'});
 assert.equal(forName("Lord's Bowmen")?.evidence,'published-champion-upgrade');
 assert.equal(forName("Lord's Bowman")?.evidence,'published-champion-upgrade');
 assert.equal(forName("Lord's Bowmen Elite"),null);
 assert.equal(forName('Other Bowmen'),null);
 assert.equal(findSourceScopedSelectionReference(
  {reference:{url:bySlug.waystalker.source.sourceUrl}},bySlug.waystalker,
  {name:"Lord's Bowmen",kind:'option'}),null);
 const missing=structuredClone(rec);
 missing.modelProfiles=missing.modelProfiles.filter(m=>m.name!=="Lord's Bowman");
 assert.equal(findSourceScopedSelectionReference(parent,missing,{name:"Lord's Bowmen",kind:'option'}),null);
});
test('Quantified per-model weapon matches the option but not an assumed legal quantity',()=>{
 const rec=bySlug.wardancers,parent={reference:{url:rec.source.sourceUrl}};
 const match=n=>findSourceScopedSelectionReference(parent,rec,{name:n,kind:'option'});
 assert.equal(match('9x Additional hand weapon')?.sourceQuantity,9);
 assert.equal(match('9× Additional hand weapon')?.sourceQuantity,9);
 assert.equal(match('999x Additional hand weapon')?.sourceQuantity,999);
 assert.equal(match('0x Additional hand weapon'),null);
 assert.equal(match('9x Invented hand weapon'),null);
 assert.equal(match('9x Hand weapon'),null);
 assert.equal(findSourceScopedSelectionReference(
  {reference:{url:bySlug['glade-guard'].source.sourceUrl}},bySlug['glade-guard'],
  {name:'9x Additional hand weapon',kind:'option'}),null);
 const missing=structuredClone(rec);
 missing.upgradeGroups=missing.upgradeGroups.filter(g=>!g.eligibilityClause?.startsWith('Any model in the unit'));
 assert.equal(findSourceScopedSelectionReference(parent,missing,{name:'9x Additional hand weapon',kind:'option'}),null);
});
test('No source-backed link is fabricated for two unpublished named choices',()=>{
 const {army,recordByInstance}=prepared();
 for(const [slug,name] of [['waystalker','The Briar-bow'],['glade-guard','The Kinbands of Modryn']]){
  const rec=bySlug[slug],unit=army.units.find(u=>u.reference?.url===rec.source.sourceUrl);
  const selection=unit.selections.find(s=>s.name===name);
  assert.equal(findSourceScopedSelectionReference(unit,rec,selection),null);
  assert.equal(selection.reference,null);
  assert.ok(!rec.upgradeGroups.some(g=>g.options.some(o=>
   o.description.toLowerCase().includes(name.toLowerCase()))));
 }
 applySourceScopedSelectionReferences(army,recordByInstance);
 assert.equal(find(army,'The Briar-bow','Waystalker').matchStatus,'unmatched');
 assert.equal(find(army,'The Kinbands of Modryn','Glade Guard').matchStatus,'unmatched');
});

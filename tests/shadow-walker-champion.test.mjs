import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {findSourceScopedSelectionReference,applySourceScopedSelectionReferences} from '../docs/unit-selection-matcher.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {applyUnitDataReferences} from '../docs/unit-data.js';

function sourceUnit(slug){
 const id='unit:'+slug,shard=shardForId(id);
 const document=JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8'));
 return document.records[id];
}
const index=JSON.parse(readFileSync(new URL('../docs/unit-data/index.json',import.meta.url),'utf8'));
const shadow=sourceUnit('shadow-warriors');
const guard=sourceUnit('lothern-sea-guard');

// User provided only a debug extract, not their complete list. This intentionally
// synthetic six-unit scaffold reproduces their 586pt total and Shadow Warriors
// entry four without making claims about actual roster units or legality.
const fixture=[
 '===',
 'The Warriors Of Ulthuan [586 pts]',
 'Warhammer: The Old World, High Elf Realms, Combined Arms',
 '===','',
 '++ Characters [190 pts] ++','',
 'Noble [100 pts]','',
 'Mage [90 pts]','',
 '++ Core Units [100 pts] ++','',
 '10 Lothern Sea Guard [100 pts]','',
 '++ Special Units [196 pts] ++','',
 '6 Shadow Warriors [86 pts]',
 '- Shadow Walker',
 '',
 '5 Swordmasters of Hoeth [110 pts]',
 '',
 '++ Rare Units [100 pts] ++','',
 'Eagle-Claw Bolt Thrower [100 pts]',
 '',
 'Created with "Old World Builder"',''
].join('\n');

function setup(){
 const army=parseArmy(fixture);
 // The parser alone cannot know every unit; the app first resolves its parent
 // from the versioned 581-unit index before matching individual selections.
 applyUnitDataReferences(army,index);
 const unit=army.units.find(u=>u.name==='Shadow Warriors');
 assert.ok(unit,'Shadow Warriors missing');
 const option=unit.selections.find(s=>s.name==='Shadow Walker');
 assert.ok(option,'Shadow Walker selection missing');
 return {army,unit,option,records:{[unit.id]:shadow}};
}
test('Shadow-walker source champion and six-point upgrade both appear on the published parent record',()=>{
 assert.equal(shadow.source.sourceUrl,'https://tow.whfb.app/unit/shadow-warriors');
 assert.equal(shadow.source.verificationStatus,'source-extracted');
 assert.equal(shadow.modelProfiles.length,2);
 assert.equal(shadow.modelProfiles[1].name,'Shadow-walker');
 assert.equal(shadow.modelProfiles[0].characteristics.BS,5);
 assert.equal(shadow.modelProfiles[1].characteristics.BS,6);
 const options=shadow.upgradeGroups.flatMap(g=>g.options);
 const champion=options.filter(o=>o.description==='Any unit may upgrade one model to a Shadow-walker (champion) (+6 points per unit)');
 assert.equal(champion.length,1);
 assert.equal(champion[0].points.amount,6);
 assert.equal(champion[0].points.basis,'per_unit');
});
test('The Warriors Of Ulthuan debug: Shadow Walker becomes a source match without recosting the 586pt import',()=>{
 const {army,unit,option,records}=setup();
 assert.equal(army.format.exporter,'old-world-builder');
 assert.equal(army.format.layout,'regular-text');
 assert.equal(army.army.name.value,'The Warriors Of Ulthuan');
 assert.equal(army.units.length,6);
 assert.equal(army.army.derivedPoints.value,586);
 assert.equal(option.matchStatus,'unmatched');
 assert.ok(collectUnmatched(army).some(x=>x.name==='Shadow Walker'));
 const frozen=JSON.stringify(army.units.map(u=>({
  name:u.name,quantity:u.quantity,reportedPoints:u.reportedPoints,
  selections:u.selections.map(s=>({name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints}))
 })));
 const {added}=applySourceScopedSelectionReferences(army,records);
 assert.equal(added,1);
 assert.equal(option.matchStatus,'matched');
 assert.equal(option.reference.url,'https://tow.whfb.app/unit/shadow-warriors');
 assert.equal(option.reference.type,'command');
 assert.equal(option.reference.evidence,'published-champion-upgrade');
 assert.equal(option.reference.verificationStatus,'source-extracted');
 assert.match(option.reference.note,/Shadow-walker/);
 assert.ok(!collectUnmatched(army).some(x=>x.name==='Shadow Walker'));
 assert.equal(army.army.derivedPoints.value,586);
 assert.equal(JSON.stringify(army.units.map(u=>({
  name:u.name,quantity:u.quantity,reportedPoints:u.reportedPoints,
  selections:u.selections.map(s=>({name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints}))
 }))),frozen);
 assert.equal(applySourceScopedSelectionReferences(army,records).added,0);
});
test('Hyphen-free Shadow Walker alias matches only a champion with both profile and parent option',()=>{
 const {unit,option}=setup();
 for(const spelling of ['Shadow Walker','Shadow-walker','SHADOW WALKER','Shadow–walker']){
  assert.equal(findSourceScopedSelectionReference(unit,shadow,{...option,name:spelling})?.evidence,
   'published-champion-upgrade',spelling);
 }
 for(const spelling of ['Shadow Walkers','Shadow Hunter','Shadow Walker Elite','Shadow Warrior','Shadow-walker magic item']){
  assert.equal(findSourceScopedSelectionReference(unit,shadow,{...option,name:spelling}),null,spelling);
 }
 const otherUnit={...unit,reference:{url:guard.source.sourceUrl}};
 assert.equal(findSourceScopedSelectionReference(otherUnit,guard,option),null);
 assert.equal(findSourceScopedSelectionReference(otherUnit,shadow,option),null);
 const missingProfile=structuredClone(shadow);
 missingProfile.modelProfiles=missingProfile.modelProfiles.filter(p=>p.name!=='Shadow-walker');
 assert.equal(findSourceScopedSelectionReference(unit,missingProfile,option),null);
 const missingOption=structuredClone(shadow);
 missingOption.upgradeGroups=missingOption.upgradeGroups.map(g=>({
  ...g,options:g.options.filter(o=>!o.description.includes('Shadow-walker (champion)'))
 }));
 assert.equal(findSourceScopedSelectionReference(unit,missingOption,option),null);
 const spoofed=structuredClone(shadow);
 spoofed.source.sourceUrl='https://untrusted.example/unit/shadow-warriors';
 assert.equal(findSourceScopedSelectionReference(unit,spoofed,option),null);
});
test('Previously verified Glade Guard champion alias continues to match',()=>{
 const glade=sourceUnit('glade-guard');
 const unit={reference:{url:glade.source.sourceUrl}};
 assert.equal(findSourceScopedSelectionReference(unit,glade,{name:"Lord's Bowmen",kind:'option'})?.evidence,
  'published-champion-upgrade');
 assert.equal(findSourceScopedSelectionReference(unit,glade,{name:"Lord's Bowman",kind:'option'})?.evidence,
  'published-champion-upgrade');
});
test('v0.4.5 browser includes source-scoped champion fix with fresh asset keys',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 assert.match(app,/unit-selection-matcher\.js\?v=0\.4\.6/);
 assert.match(app,/applySourceScopedSelectionReferences\(army,unitDataRecords\)/);
 assert.match(app,/appVersion:'0\.5\.0'/);
 assert.match(html,/Browser Edition v0\.5\.0/);
 assert.match(html,/app\.js\?v=0\.5\.0/);
});

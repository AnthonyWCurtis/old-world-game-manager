import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {applyUnitDataReferences} from '../docs/unit-data.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {
 applySourceScopedSelectionReferences,findSourceScopedSelectionReference
} from '../docs/unit-selection-matcher.js';
const root=new URL('../docs/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('unit-data/index.json',root),'utf8'));
const sourceUnit=slug=>{
 const id='unit:'+slug;
 const shard=shardForId(id);
 return JSON.parse(readFileSync(new URL('unit-data/shards/'+shard+'.json',root),'utf8')).records[id];
};
const ranger=sourceUnit('rangers');
const irondrakes=sourceUnit('irondrakes');
const cannon=sourceUnit('cannon');
const fixture=readFileSync(new URL('../tests/fixtures/new-recruit-dwarf-unmatched-2500.txt',import.meta.url),'utf8');
function prepare(){
 const army=parseArmy(fixture);
 applyUnitDataReferences(army,index);
 const a=army.units.find(u=>u.name==='Rangers');
 const b=army.units.find(u=>u.name==='Irondrakes');
 assert.ok(a&&b,'Rangers and Irondrakes must be parsed and indexed');
 const deadeye=a.selections.find(s=>s.name==='Ol Deadeye');
 const runes=b.selections.find(s=>s.name==='Standard Runes');
 assert.ok(deadeye&&runes,'Both reported selections must be parsed');
 return {army,rangers:a,irondrakes:b,deadeye,runes,
  records:{[a.id]:ranger,[b.id]:irondrakes}};
}
test('Rangers source contains Ol’ Deadeye champion profile and explicit +6 upgrade',()=>{
 assert.equal(ranger.source.sourceUrl,'https://tow.whfb.app/unit/rangers');
 assert.equal(ranger.modelProfiles[1].name,"Ol' Deadeye");
 assert.equal(ranger.modelProfiles[1].characteristics.A,2);
 const options=ranger.upgradeGroups.flatMap(g=>g.options).filter(o=>
  o.description==="Upgrade one model to an Ol' Deadeye (champion) (+6 points per unit)");
 assert.equal(options.length,1);
 assert.equal(options[0].points.amount,6);
 assert.equal(options[0].points.basis,'per_unit');
});
test('Irondrakes source contains a capped, restricted, directly linked Standard runes option',()=>{
 assert.equal(irondrakes.source.sourceUrl,'https://tow.whfb.app/unit/irondrakes');
 const opts=irondrakes.upgradeGroups.flatMap(g=>g.options.map(o=>({g,o}))).filter(x=>
  x.o.description==='Purchase Standard runes up to a total of 50 points');
 assert.equal(opts.length,1);
 assert.equal(opts[0].g.eligibilityClause,'0-1 unit per 1,000 points may:');
 assert.equal(opts[0].o.magicItemPointsCap,50);
 assert.deepEqual(opts[0].o.linkedReferences,[{
  name:'Standard runes',sourceUrl:'https://tow.whfb.app/magic-items/standard-runes'
 }]);
});
test('New Recruit TOW 2500pt synthetic report: 13 units, two source-backed matches, original points preserved',()=>{
 const {army,rangers,irondrakes,deadeye,runes,records}=prepare();
 assert.equal(army.format.exporter,'new-recruit');
 assert.equal(army.format.layout,'tow');
 assert.equal(army.format.confidence,'medium');
 assert.equal(army.units.length,13);
 assert.equal(army.army.derivedPoints.value,2500);
 assert.equal(rangers.line,7);
 assert.equal(irondrakes.line,14);
 assert.equal(deadeye.matchStatus,'unmatched');
 assert.equal(runes.matchStatus,'unmatched');
 assert.equal(army.stats.unmatchedUnits,0);
 assert.equal(army.stats.unmatchedSelections,2);
 assert.deepEqual(collectUnmatched(army).map(x=>x.name),['Ol Deadeye','Standard Runes']);
 const snapshot=JSON.stringify({
  unitData:army.units.map(u=>({
   name:u.name,rawHeading:u.rawHeading,quantity:u.quantity,
   reportedPoints:u.reportedPoints,selections:u.selections.map(s=>({
    name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints
   }))
  })),
  total:army.army.derivedPoints.value
 });
 assert.equal(applySourceScopedSelectionReferences(army,records).added,2);
 assert.equal(army.stats.unmatchedSelections,0);
 assert.equal(army.stats.matchedSelections,2);
 assert.equal(collectUnmatched(army).length,0);
 assert.equal(deadeye.reference.url,'https://tow.whfb.app/unit/rangers');
 assert.equal(deadeye.reference.type,'command');
 assert.equal(deadeye.reference.evidence,'published-champion-upgrade');
 assert.equal(deadeye.reference.verificationStatus,'source-extracted');
 assert.equal(runes.reference.url,'https://tow.whfb.app/magic-items/standard-runes');
 assert.equal(runes.reference.type,'magic-item-category');
 assert.equal(runes.reference.parentSourceUrl,'https://tow.whfb.app/unit/irondrakes');
 assert.equal(runes.reference.evidence,'published-standard-runes-allowance');
 assert.equal(runes.reference.sourceMaxPoints,50);
 assert.equal(runes.reference.sourceEligibilityClause,'0-1 unit per 1,000 points may:');
 assert.match(runes.reference.note,/not been verified/i);
 assert.equal(army.army.derivedPoints.value,2500);
 assert.equal(JSON.stringify({
  unitData:army.units.map(u=>({
   name:u.name,rawHeading:u.rawHeading,quantity:u.quantity,
   reportedPoints:u.reportedPoints,selections:u.selections.map(s=>({
    name:s.name,raw:s.raw,line:s.line,reportedPoints:s.reportedPoints
   }))
  })),
  total:army.army.derivedPoints.value
 }),snapshot);
 assert.equal(applySourceScopedSelectionReferences(army,records).added,0);
});
test('Ol Deadeye spelling variations are parent-scoped and must be supported by a champion profile and upgrade',()=>{
 const {rangers}=prepare();
 for(const spelling of ["Ol Deadeye","Ol' Deadeye","Ol’ Deadeye","OL DEADEYE"]){
  assert.equal(findSourceScopedSelectionReference(rangers,ranger,{name:spelling,kind:'option'})?.evidence,
   'published-champion-upgrade',spelling);
 }
 for(const spelling of ['Ol Deadeyes',"Old Deadeye",'Ol Deadeye Elite','Deadeye']){
  assert.equal(findSourceScopedSelectionReference(rangers,ranger,{name:spelling,kind:'option'}),null,spelling);
 }
 const wrong={...rangers,reference:{url:irondrakes.source.sourceUrl}};
 assert.equal(findSourceScopedSelectionReference(wrong,irondrakes,{name:'Ol Deadeye',kind:'option'}),null);
 assert.equal(findSourceScopedSelectionReference(wrong,ranger,{name:'Ol Deadeye',kind:'option'}),null);
 const missingProfile=structuredClone(ranger);
 missingProfile.modelProfiles=missingProfile.modelProfiles.filter(x=>x.name!=="Ol' Deadeye");
 assert.equal(findSourceScopedSelectionReference(rangers,missingProfile,{name:'Ol Deadeye',kind:'option'}),null);
 const missingUpgrade=structuredClone(ranger);
 missingUpgrade.upgradeGroups=missingUpgrade.upgradeGroups.map(g=>({...g,
  options:g.options.filter(o=>!o.description.includes("Ol' Deadeye (champion)"))}));
 assert.equal(findSourceScopedSelectionReference(rangers,missingUpgrade,{name:'Ol Deadeye',kind:'option'}),null);
});
test('Standard Runes only resolves from exact, unique, published allowance and links actual category URL',()=>{
 const {irondrakes:parent,runes}=prepare();
 const match=(record=irondrakes,unit=parent,selection=runes)=>
  findSourceScopedSelectionReference(unit,record,selection);
 assert.equal(match()?.url,'https://tow.whfb.app/magic-items/standard-runes');
 assert.equal(match()?.sourceMaxPoints,50);
 const forged=structuredClone(irondrakes);
 const group=forged.upgradeGroups.find(g=>g.options.some(o=>o.description.startsWith('Purchase Standard runes')));
 const option=group.options.find(o=>o.description.startsWith('Purchase Standard runes'));
 option.linkedReferences=[{name:'Standard runes',sourceUrl:'https://example.com/standard-runes'}];
 assert.equal(match(forged),null);
 const differentCap=structuredClone(irondrakes);
 differentCap.upgradeGroups.flatMap(g=>g.options).find(o=>o.description.startsWith('Purchase Standard runes')).magicItemPointsCap=25;
 assert.equal(match(differentCap),null);
 const missing=structuredClone(irondrakes);
 missing.upgradeGroups=missing.upgradeGroups.map(g=>({...g,
  options:g.options.filter(o=>!o.description.startsWith('Purchase Standard runes'))}));
 assert.equal(match(missing),null);
 const twice=structuredClone(irondrakes);
 const runesGroup=twice.upgradeGroups.find(g=>g.options.some(o=>o.description.startsWith('Purchase Standard runes')));
 runesGroup.options.push(structuredClone(runesGroup.options.find(o=>o.description.startsWith('Purchase Standard runes'))));
 assert.equal(match(twice),null);
 assert.equal(match(irondrakes,parent,{...runes,name:'Weapon Runes'}),null);
 const other={...parent,reference:{url:cannon.source.sourceUrl}};
 assert.equal(match(cannon,other),null);
 assert.equal(match(irondrakes,other),null);
 const rangerUnit={reference:{url:ranger.source.sourceUrl}};
 const rangerMatch=match(ranger,rangerUnit);
 assert.equal(rangerMatch?.sourceMaxPoints,25);
 assert.equal(rangerMatch?.url,'https://tow.whfb.app/magic-items/standard-runes');
});
test('Game Manager continues to load source-backed Dwarf references in the v0.5.0 browser',()=>{
 const html=readFileSync(new URL('index.html',root),'utf8');
 const app=readFileSync(new URL('app.js',root),'utf8');
 assert.match(html,/Browser Edition v0\.5\.0/);
 assert.match(html,/app\.js\?v=0\.5\.0/);
 assert.match(app,/unit-selection-matcher\.js\?v=0\.4\.6/);
 assert.match(app,/appVersion:'0\.5\.0'/);
 assert.match(app,/applySourceScopedSelectionReferences\(army,unitDataRecords\)/);
});

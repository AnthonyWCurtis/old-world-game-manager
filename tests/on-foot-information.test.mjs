import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched,formatUnmatchedDebug} from '../docs/unmatched-debug.js';
import {selectionMatchState,hasUnmatchedSelection,unitMatchState} from '../docs/match-status.js';
import {isInformationalSelection,allArmySelections,
 applyInformationalPlaceholders} from '../docs/selection-information.js';
import {applyIndexedReferences,applyProfileReferences} from '../docs/live-source.js';
import {applySourceScopedSelectionReferences} from '../docs/unit-selection-matcher.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';

const raw=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const sourceUnit=slug=>{
 const id='unit:'+slug,shard=shardForId(id);
 return JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records[id];
};
const onFoots=army=>allArmySelections(army).filter(isInformationalSelection);

test('OWB regular-text import preserves five On foot entries as information, not rule references',()=>{
 const army=parseArmy(raw);
 assert.equal(army.format.exporter,'old-world-builder');
 const selections=onFoots(army);
 assert.equal(selections.length,5);
 assert.equal(army.stats.informationalSelections,5);
 assert.ok(selections.every(s=>s.kind==='mount-state'));
 assert.ok(selections.every(s=>s.matchStatus==='informational'&&s.reference===null));
 assert.ok(selections.every(s=>s.raw==='On foot'));
 assert.ok(selections.every(s=>Number.isInteger(s.line)&&s.line>0));
 assert.ok(selections.every(s=>selectionMatchState(s)==='informational'));
 assert.ok(selections.every(s=>!hasUnmatchedSelection(s)));
 assert.equal(army.stats.selectionCount,
  army.stats.matchedSelections+army.stats.unmatchedSelections+army.stats.informationalSelections);
 assert.equal(collectUnmatched(army).filter(s=>s.name==='On foot').length,0);
 assert.ok(!formatUnmatchedDebug(army,{appVersion:'0.4.2'}).includes('SELECTION: On foot'));
});
test('On foot descriptor needs no parent record and does not generate a link from unit-scoped matching',()=>{
 const army=parseArmy(raw);
 const before=army.units.map(u=>u.reportedPoints.value);
 const options=onFoots(army);
 const target=army.units.find(u=>u.name==='Storm Weaver');
 assert.ok(target);
 const sourceMap={};
 for(const u of army.units){
  if(u.name==='Mage'&&u.reference?.url===sourceUnit('mage')?.source?.sourceUrl)
   sourceMap[u.id]=sourceUnit('mage');
 }
 applySourceScopedSelectionReferences(army,sourceMap);
 assert.deepEqual(army.units.map(u=>u.reportedPoints.value),before);
 assert.ok(options.every(s=>s.reference===null&&s.matchStatus==='informational'));
 assert.equal(army.stats.informationalSelections,5);
});
test('Old saved snapshots migrate, clear fabricated links and maintain unrelated selections/points',()=>{
 const army=parseArmy(raw);
 const source=onFoots(army);
 const oldLinks=source.map((s,i)=>{
  const old={id:'unit-scoped:fake'+i,url:'https://tow.whfb.app/unit/noble',
    source:'unit-scoped-data',verificationStatus:'source-extracted'};
  s.reference=old;s.matchStatus=i%2?'matched':'unmatched';
  return old;
 });
 const before=JSON.stringify(army.units.map(u=>({
  name:u.name,points:u.reportedPoints,selections:u.selections.map(x=>x.raw)
 })));
 // A legacy report must already exclude these descriptions, even before conversion.
 assert.equal(collectUnmatched(army).filter(x=>x.name==='On foot').length,0);
 const normalized=applyInformationalPlaceholders(army);
 assert.equal(normalized.updated,5);
 assert.equal(applyInformationalPlaceholders(army).updated,0);
 assert.ok(source.every(s=>s.matchStatus==='informational'&&s.reference===null));
 assert.ok(source.every(s=>selectionMatchState(s)==='informational'));
 assert.equal(army.stats.informationalSelections,5);
 assert.equal(JSON.stringify(army.units.map(u=>({
  name:u.name,points:u.reportedPoints,selections:u.selections.map(x=>x.raw)
 }))),before);
 assert.equal(oldLinks.length,5);
});
test('Other legitimate unmatched options remain unmatched and keep unit partial badges',()=>{
 const army=parseArmy(raw);
 const u=army.units.find(u=>u.name==='Storm Weaver');
 assert.ok(u);
 const before=onFoots(army);
 u.selections.push({id:'missing-test',kind:'option',name:'Unknown magic item',
  raw:'Unknown magic item',line:123,matchStatus:'unmatched',reference:null,children:[]});
 applyInformationalPlaceholders(army);
 assert.equal(unitMatchState(u),'partial');
 assert.equal(collectUnmatched(army).filter(s=>s.name==='Unknown magic item').length,1);
 assert.equal(collectUnmatched(army).filter(s=>s.name==='On foot').length,0);
 assert.ok(before.every(s=>selectionMatchState(s)==='informational'));
});
test('Live matching cannot replace a generic On foot placeholder with a bogus reference',()=>{
 const army=parseArmy(raw);
 const fakeIndex=[{name:'On foot',url:'https://tow.whfb.app/unit/noble',kind:'rule'}];
 applyIndexedReferences(army,fakeIndex);
 const fakeSourceRecord={url:'https://tow.whfb.app/unit/storm-weaver',models:[
  {name:'On foot'}],wizardLevels:[]};
 applyProfileReferences(army,{[fakeSourceRecord.url]:fakeSourceRecord});
 assert.ok(onFoots(army).every(s=>s.matchStatus==='informational'&&s.reference===null));
 assert.equal(army.stats.informationalSelections,5);
 assert.equal(collectUnmatched(army).filter(x=>x.name==='On foot').length,0);
});
test('Only the exact On foot label is a description; other mount states still require evidence',()=>{
 const [onFoot]=onFoots(parseArmy(raw));
 assert.equal(isInformationalSelection({...onFoot,name:'On Foot'}),true);
 assert.equal(isInformationalSelection({...onFoot,name:'  ON   FOOT '}),true);
 assert.equal(isInformationalSelection({...onFoot,kind:'equipment'}),true);
 assert.equal(isInformationalSelection({...onFoot,name:'Elven Steed'}),false);
 assert.equal(isInformationalSelection({...onFoot,name:'On foot, with dragon'}),false);
 assert.equal(isInformationalSelection(null),false);
 const remaining={...onFoot,name:'Elven Steed',matchStatus:'unmatched'};
 assert.equal(selectionMatchState(remaining),'unmatched');
});
test('UI shows neutral badge, informational count, and current report version',()=>{
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
 assert.match(app,/informational:\['tag info','i Information'\]/);
 assert.match(app,/applyInformationalPlaceholders\(current\)/);
 assert.match(app,/Informational entries/);
 assert.match(app,/Descriptive mount state only/);
 assert.match(app,/appVersion:'1\.0\.0-alpha\.2'/);
 assert.match(html,/v1 Game Screen preview/);
 assert.match(css,/\.tag\.info\{[^}]*background:/);
});

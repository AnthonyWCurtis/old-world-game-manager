import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
import {
  applySourceScopedSelectionReferences,
  findSourceScopedSelectionReference
} from '../docs/unit-selection-matcher.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';

function sourceRecord(slug){
  const id='unit:'+slug;
  const shard=shardForId(id);
  const data=JSON.parse(readFileSync(
    new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8'));
  const record=data.records[id];
  assert.ok(record,'Missing published unit data for '+id);
  return record;
}
const oddnob=sourceRecord('night-goblin-oddnob');
const mob=sourceRecord('night-goblin-mob');
let nextId=0;
function selection(name,kind,line){
  return {id:'s'+(++nextId),name,kind,raw:name,line,reference:null,
    matchStatus:'unmatched',children:[],reportedPoints:null};
}
function unit(record,choice,points=100){
  return {id:'u'+(++nextId),name:record.name,reference:{
      id:record.id,url:record.source.sourceUrl,type:'unit',
      source:'published-unit-data'
    },matchStatus:'matched',selections:[choice],modelGroups:[],
    reportedPoints:{value:points}};
}

test('Night Goblin Oddnob Level 4 Wizard matches only its published +30 upgrade',()=>{
  const target=selection('Level 4 Wizard','wizard-level',5);
  const u=unit(oddnob,target);
  const ref=findSourceScopedSelectionReference(u,oddnob,target);
  assert.ok(ref,'An explicit "Be a Level 4 Wizard" source option must match');
  assert.equal(ref.url,'https://tow.whfb.app/unit/night-goblin-oddnob');
  assert.equal(ref.type,'wizard-level');
  assert.equal(ref.evidence,'published-wizard-upgrade');
  assert.match(ref.note,/Be a Level 4 Wizard \(\+30 points\)/);

  const unknown=selection('Level 2 Wizard','wizard-level',5);
  assert.equal(findSourceScopedSelectionReference(u,oddnob,unknown),null);
  assert.equal(findSourceScopedSelectionReference(unit(mob,target),mob,target),null);
  const missing=structuredClone(oddnob);
  missing.upgradeGroups[0].options=missing.upgradeGroups[0].options.filter(
    o=>!o.description.startsWith('Be a Level 4 Wizard'));
  assert.equal(findSourceScopedSelectionReference(u,missing,target),null);
});

test('Night Goblin Mob Full Command requires the complete source-verified command group',()=>{
  const target=selection('Full Command','command',11);
  const u=unit(mob,target);
  const ref=findSourceScopedSelectionReference(u,mob,target);
  assert.ok(ref,'Full Command is shorthand for the published three upgrades');
  assert.equal(ref.url,'https://tow.whfb.app/unit/night-goblin-mob');
  assert.equal(ref.source,'unit-scoped-data');
  assert.equal(ref.type,'command');
  assert.equal(ref.evidence,'published-full-command');
  assert.deepEqual(ref.sourceCommandComponents.map(c=>c.name),
    ['Boss','standard bearer','musician']);
  assert.deepEqual(ref.sourceCommandComponents.map(c=>c.points),
    [7,5,5]);

  const noChampion=structuredClone(mob);
  noChampion.modelProfiles=noChampion.modelProfiles.filter(m=>m.name!=='Boss');
  assert.equal(findSourceScopedSelectionReference(u,noChampion,target),null);
  const noMusician=structuredClone(mob);
  noMusician.upgradeGroups[1].options=noMusician.upgradeGroups[1].options.filter(
    o=>!o.description.includes('to a musician'));
  assert.equal(findSourceScopedSelectionReference(u,noMusician,target),null);
  const duplicateBearer=structuredClone(mob);
  duplicateBearer.upgradeGroups[1].options.push(structuredClone(
    duplicateBearer.upgradeGroups[1].options[1]));
  assert.equal(findSourceScopedSelectionReference(u,duplicateBearer,target),null);
  assert.equal(findSourceScopedSelectionReference(unit(oddnob,target),oddnob,target),null);
});

test('Cali cup debug occurrences: one wizard and four distinct mobs resolve without changing imports',()=>{
  const units=[
    unit(oddnob,selection('Level 4 Wizard','wizard-level',5),155),
    ...[11,12,13,14].map(line=>unit(mob,selection('Full Command','command',line),85))
  ];
  const army={units,stats:{unitCount:5,selectionCount:5,matchedUnits:5,
    unmatchedUnits:0,matchedSelections:0,unmatchedSelections:5},
    army:{derivedPoints:{value:495},reportedPoints:{value:495}}};
  const records=Object.fromEntries(units.map((u,i)=>[u.id,i===0?oddnob:mob]));
  const original=JSON.stringify(army.units.map(u=>({
    name:u.name,id:u.id,selection:u.selections.map(s=>({
      name:s.name,raw:s.raw,kind:s.kind,line:s.line,reportedPoints:s.reportedPoints
    })),reportedPoints:u.reportedPoints
  })));
  assert.equal(collectUnmatched(army).length,5);
  assert.equal(applySourceScopedSelectionReferences(army,records).added,5);
  assert.equal(army.stats.unmatchedSelections,0);
  assert.equal(army.stats.matchedSelections,5);
  assert.equal(collectUnmatched(army).length,0);
  assert.deepEqual(army.units.map(u=>u.selections[0].reference.evidence),
    ['published-wizard-upgrade',...Array(4).fill('published-full-command')]);
  assert.equal(army.stats.selectionCount,5,'Combined command must stay one selection');
  assert.equal(army.army.derivedPoints.value,495);
  assert.equal(JSON.stringify(army.units.map(u=>({
    name:u.name,id:u.id,selection:u.selections.map(s=>({
      name:s.name,raw:s.raw,kind:s.kind,line:s.line,reportedPoints:s.reportedPoints
    })),reportedPoints:u.reportedPoints
  }))),original);
  assert.equal(applySourceScopedSelectionReferences(army,records).added,0);
  assert.equal(army.stats.matchedSelections,5);
});

test('Spoofed source URL does not match published unit or command options',()=>{
  const u=unit(mob,selection('Full Command','command',11));
  u.reference.url='https://example.com/unit/night-goblin-mob';
  assert.equal(findSourceScopedSelectionReference(u,mob,u.selections[0]),null);
});

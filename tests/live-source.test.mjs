import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {findIndexedReference,applyIndexedReferences,INDEX_SOURCES} from '../docs/live-source.js';

const read=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');
const indexed=[
 {name:'Night Goblin Mob',url:'https://tow.whfb.app/unit/night-goblin-mob',kind:'unit'},
 {name:'Night Goblin Oddnob',url:'https://tow.whfb.app/unit/night-goblin-oddnob',kind:'unit'},
 {name:'Goblin Bolt Throwa',url:'https://tow.whfb.app/unit/goblin-bolt-throwa',kind:'unit'},
 {name:'Fanatic',url:'https://tow.whfb.app/unit/fanatic',kind:'unit'},
 {name:'Talisman of Protection',url:'https://tow.whfb.app/magic-item/talisman-of-protection',kind:'item'},
 {name:'Shields',url:'https://tow.whfb.app/weapons-of-war/shields',kind:'rule'}
];
test('Uses source-discovered links rather than a faction-specific lookup',()=>{
 assert.equal(findIndexedReference('Night Goblin Mobs',true,indexed)?.url,'https://tow.whfb.app/unit/night-goblin-mob');
 assert.equal(findIndexedReference('Night Goblin Oddnob',true,indexed)?.source,'live-index');
 assert.equal(findIndexedReference('Goblin Bolt Throwas',true,indexed)?.url,'https://tow.whfb.app/unit/goblin-bolt-throwa');
 assert.equal(findIndexedReference('3× Fanatic',false,indexed)?.url,'https://tow.whfb.app/unit/fanatic');
 assert.equal(findIndexedReference('Talisman of Protection',false,indexed)?.url,'https://tow.whfb.app/magic-item/talisman-of-protection');
 assert.equal(findIndexedReference('Night Goblin Mobs',false,indexed)?.url,'https://tow.whfb.app/unit/night-goblin-mob');
 assert.equal(findIndexedReference('Invented item',false,indexed),null);
 assert.equal(findIndexedReference('On foot',false,indexed),null);
});
test('Never selects ambiguous links by guessing',()=>{
 const clash=[
  {name:'Shield',url:'https://tow.whfb.app/weapons-of-war/shield',kind:'rule'},
  {name:'Shield',url:'https://tow.whfb.app/magic-item/shield',kind:'item'}
 ];
 assert.equal(findIndexedReference('Shield',false,clash),null);
 assert.equal(findIndexedReference('Shield',true,clash),null);
});
test('Live index is additive, preserves points, selections and source text',()=>{
 const army=parseArmy(read('bb-compact'));
 const original=army.originalText;
 const names=army.units.map(u=>u.name);
 const points=army.units.map(u=>u.reportedPoints.value);
 const before=army.stats;
 const first=applyIndexedReferences(army,indexed);
 assert.equal(first.added,0); // none of the names above are unmatched in this army
 assert.equal(army.army.derivedPoints.value,2599);
 assert.equal(army.originalText,original);
 assert.deepEqual(army.units.map(u=>u.name),names);
 assert.deepEqual(army.units.map(u=>u.reportedPoints.value),points);
 assert.equal(army.stats.selectionCount,before.selectionCount);
 const second=applyIndexedReferences(army,indexed);
 assert.equal(second.added,0);
});
test('Only permitted public indexes are requested, not API paths',()=>{
 assert.deepEqual(INDEX_SOURCES.map(s=>s.path),[
  '/sitemap/armies','/sitemap/magic-items','/sitemap/rules'
 ]);
});

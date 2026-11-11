import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {armySessionKey,restoreBattleSession,assignCharacter,charactersForUnit} from '../docs/battle-session.js';

const army=()=>parseArmy(readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8'));
const parts=a=>{
 const characters=a.units.filter(u=>a.sections.find(s=>s.id===u.sectionId)?.name==='Characters');
 const regiments=a.units.filter(u=>a.sections.find(s=>s.id===u.sectionId)?.name?.startsWith('Core'));
 return {characters,regiments};
};

test('session key depends on exact imported army text but not reference matching',()=>{
 const a=army(),b=army();
 assert.equal(armySessionKey(a),armySessionKey(b));
 b.units[0].matchStatus='unmatched';
 assert.equal(armySessionKey(a),armySessionKey(b));
 b.originalText+='\n';
 assert.notEqual(armySessionKey(a),armySessionKey(b));
});

test('multiple distinct characters can join one unit without changing imported army',()=>{
 const a=army(),{characters,regiments}=parts(a),original=JSON.stringify(a);
 let state=restoreBattleSession(a);
 state=assignCharacter(a,state,characters[0].id,regiments[0].id);
 state=assignCharacter(a,state,characters[1].id,regiments[0].id);
 assert.deepEqual(charactersForUnit(state,regiments[0].id),[characters[0].id,characters[1].id]);
 assert.equal(state.assignments[characters[0].id],regiments[0].id);
 assert.equal(state.assignments[characters[1].id],regiments[0].id);
 assert.equal(JSON.stringify(a),original);
 assert.equal(a.army.derivedPoints.value,2599);
 assert.equal(a.units.length,17);
});

test('reassignment removes prior membership, removal leaves character independent',()=>{
 const a=army(),{characters,regiments}=parts(a);
 const c=characters[0].id;
 let s=assignCharacter(a,restoreBattleSession(a),c,regiments[0].id);
 s=assignCharacter(a,s,c,regiments[1].id);
 assert.deepEqual(charactersForUnit(s,regiments[0].id),[]);
 assert.deepEqual(charactersForUnit(s,regiments[1].id),[c]);
 s=assignCharacter(a,s,c,null);
 assert.deepEqual(charactersForUnit(s,regiments[1].id),[]);
 assert.equal(s.assignments[c],undefined);
});

test('identical names are not confused and malformed targets are rejected',()=>{
 const a=army(),{characters,regiments}=parts(a);
 const commanders=characters.filter(u=>u.name==='Sea Guard Garrison Commander');
 assert.equal(commanders.length,3);
 let s=restoreBattleSession(a);
 s=assignCharacter(a,s,commanders[0].id,regiments[0].id);
 s=assignCharacter(a,s,commanders[1].id,regiments[1].id);
 assert.notEqual(s.assignments[commanders[0].id],s.assignments[commanders[1].id]);
 assert.throws(()=>assignCharacter(a,s,'invalid',regiments[0].id),/character/i);
 assert.throws(()=>assignCharacter(a,s,regiments[0].id,regiments[1].id),/character/i);
 assert.throws(()=>assignCharacter(a,s,commanders[0].id,characters[0].id),/regiment|unit/i);
 assert.throws(()=>assignCharacter(a,s,commanders[0].id,'missing'),/regiment|unit/i);
});

test('restored state filters old or invalid assignment IDs, and rejects another army',()=>{
 const a=army(),{characters,regiments}=parts(a);
 const key=armySessionKey(a);
 const row={schemaVersion:1,armyKey:key,assignments:{
  [characters[0].id]:regiments[0].id,
  missing:regiments[0].id,
  [regiments[1].id]:regiments[0].id,
  [characters[1].id]:characters[0].id
 }};
 const input=JSON.stringify(row);
 const s=restoreBattleSession(a,row);
 assert.deepEqual(s.assignments,{[characters[0].id]:regiments[0].id});
 assert.equal(JSON.stringify(row),input);
 assert.deepEqual(restoreBattleSession(a,{...row,armyKey:'another'}).assignments,{});
 assert.deepEqual(restoreBattleSession(a,{}).assignments,{});
});

test('empty character list cannot grant any character joins',()=>{
 const a=parseArmy(readFileSync(new URL('../docs/examples/single-sea-guard.txt',import.meta.url),'utf8'));
 assert.deepEqual(restoreBattleSession(a).assignments,{});
 assert.throws(()=>assignCharacter(a,restoreBattleSession(a),'u1','u1'),/character/i);
});

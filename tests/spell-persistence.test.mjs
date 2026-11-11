import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter,markCharmedShieldUsed} from '../docs/battle-session.js';
import {activateSpell,spellEffectsFor} from '../docs/spell-engine.js';
const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const make=()=>parseArmy(fixture);
const get=(a,name)=>a.units.find(u=>u.name===name);

test('restored old session without spell records keeps assignments and spent Charmed Shield',()=>{
 const a=make(),char=a.units.find(u=>u.name==='Sea Guard Garrison Commander'&&u.reportedPoints.value===283);
 let session=restoreBattleSession(a);
 session=assignCharacter(a,session,char.id,get(a,'Lothern Sea Guard').id);
 session=markCharmedShieldUsed(a,session,char.id,true);
 const old=structuredClone(session);
 delete old.activeSpells;
 const restored=restoreBattleSession(a,old);
 assert.deepEqual(restored.assignments,session.assignments);
 assert.deepEqual(restored.usedCharmedShields,session.usedCharmedShields);
 assert.deepEqual(restored.activeSpells,[]);
});

test('spell state is preserved and remains separate from immutable imported list',()=>{
 const a=make(),raw=JSON.stringify(a);
 let s=restoreBattleSession(a);
 s=activateSpell(a,s,{spellId:'earthen-ramparts',casterId:get(a,'Storm Weaver').id,
  targetId:get(a,'Lothern Sea Guard').id,confirmed:true});
 const saved=structuredClone(s);
 const reopened=restoreBattleSession(a,saved);
 assert.deepEqual(reopened.activeSpells,s.activeSpells);
 assert.equal(spellEffectsFor(a,reopened,get(a,'Lothern Sea Guard').id).ward[0].value,5);
 assert.equal(JSON.stringify(a),raw);
});

test('sanitising a stored session removes forged spells and preserves healthy data',()=>{
 const a=make(),s=restoreBattleSession(a);
 const forged={...s,activeSpells:[
  {spellId:'earthen-ramparts',casterId:get(a,'Storm Weaver').id,
   targetId:get(a,'Lothern Sea Guard').id,joinedUnitId:null,confirmed:true},
  {spellId:'glittering-robe',casterId:'not-a-wizard',targetId:null,confirmed:true},
  {spellId:'invalid',casterId:get(a,'Storm Weaver').id,confirmed:true}
 ]};
 assert.equal(restoreBattleSession(a,forged).activeSpells.length,1);
});

test('session store serialises active spells independently of roster and retains other fields',()=>{
 const content=readFileSync(new URL('../docs/battle-session-store.js',import.meta.url),'utf8');
 assert.match(content,/activeSpells/);
 assert.match(content,/usedCharmedShields/);
 assert.match(content,/assignments/);
 assert.match(content,/store\.put\(copy\)/);
});

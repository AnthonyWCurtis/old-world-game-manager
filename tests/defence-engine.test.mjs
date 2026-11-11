import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter,markCharmedShieldUsed} from '../docs/battle-session.js';
import {evaluateDefences} from '../docs/defence-engine.js';

const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const fresh=()=>parseArmy(fixture);
const unit=(army,name)=>army.units.find(u=>u.name===name);
const commander=(army,points)=>army.units.find(u=>u.name==='Sea Guard Garrison Commander'&&u.reportedPoints.value===points);

test('equipment-only armour: Sea Guard 5+ from selected light armour and shield; champion cloak not shared',()=>{
 const army=fresh(),s=restoreBattleSession(army);
 const target=unit(army,'Lothern Sea Guard');
 const original=JSON.stringify(army);
 const result=evaluateDefences(army,s,target.id);
 assert.equal(result.armour.value,5);
 assert.match(result.armour.label,/5\+/);
 assert.equal(result.armour.status,'equipment-only');
 assert.deepEqual(result.ward,[],'Champion cloak cannot grant full regiment an unconditional Ward');
 assert.deepEqual(result.regeneration,[]);
 assert.equal(result.champions.length,1);
 assert.equal(result.champions[0].name,'Sea Master');
 assert.deepEqual(result.champions[0].ward.map(w=>w.value),[4]);
 assert.equal(result.champions[0].ward[0].condition,'Magic Missiles only');
 assert.equal(result.champions[0].ward[0].sourceUrl,'https://tow.whfb.app/magic-item/the-loremasters-cloak');
 assert.equal(result.champions[0].ward[0].scope,'champion only');
 assert.equal(result.sharedWard.length,0);
 assert.equal(result.joinedCharacters.length,0);
 assert.equal(JSON.stringify(army),original);
 assert.equal(army.army.derivedPoints.value,2599);
 assert.equal(army.units.length,17);
});

test('characters keep own separate saves: heavy + shield 4+, Seed of Rebirth 5+ bearer Regeneration',()=>{
 const army=fresh(),s=restoreBattleSession(army);
 const ishaya=evaluateDefences(army,s,unit(army,'Ishaya Vess').id);
 assert.equal(ishaya.armour.value,4);
 assert.deepEqual(ishaya.ward,[]);
 assert.ok(ishaya.otherEffects.some(e=>e.sourceUrl==='https://tow.whfb.app/magic-item/mathlanns-ire'));
 const sky=evaluateDefences(army,s,commander(army,283).id);
 assert.equal(sky.armour.value,4);
 assert.deepEqual(sky.regeneration.map(e=>e.value),[5]);
 assert.equal(sky.regeneration[0].scope,'bearer only');
 assert.equal(sky.ward[0].value,5);
 assert.equal(sky.ward[0].condition,'once per game against one wound');
 assert.equal(sky.ward[0].scope,'bearer only');
 assert.match(sky.armour.note,/mount/i);
 const noArmour=evaluateDefences(army,s,unit(army,'Mage').id);
 assert.equal(noArmour.armour.value,null,'Do not misrepresent unarmoured 7+ as a usable save');
});

test('Charmed Shield one-use Ward can be marked spent, retaining the shield armour improvement',()=>{
 const army=fresh(),c=commander(army,202),s=restoreBattleSession(army);
 const before=evaluateDefences(army,s,c.id);
 assert.equal(before.armour.value,4);
 assert.equal(before.ward.length,1);
 assert.equal(before.ward[0].available,true);
 const spent=markCharmedShieldUsed(army,s,c.id,true);
 const after=evaluateDefences(army,spent,c.id);
 assert.equal(after.armour.value,4);
 assert.equal(after.ward[0].available,false);
 assert.equal(after.ward[0].value,5);
 assert.deepEqual(restoreBattleSession(army,spent).usedCharmedShields,{[c.id]:true});
 const reset=markCharmedShieldUsed(army,spent,c.id,false);
 assert.equal(evaluateDefences(army,reset,c.id).ward[0].available,true);
 assert.equal(army.units.find(u=>u.id===c.id).reportedPoints.value,202);
});

test('attached characters do not give a regiment their armour, Charmed Shield Ward or Seed regeneration',()=>{
 const army=fresh(),sea=unit(army,'Lothern Sea Guard'),c=commander(army,283);
 const s=assignCharacter(army,restoreBattleSession(army),c.id,sea.id);
 const r=evaluateDefences(army,s,sea.id);
 assert.equal(r.armour.value,5);
 assert.equal(r.ward.length,0);
 assert.equal(r.regeneration.length,0);
 assert.equal(r.joinedCharacters.length,1);
 assert.equal(r.joinedCharacters[0].id,c.id);
 assert.equal(r.joinedCharacters[0].defence.armour.value,4);
 assert.deepEqual(r.joinedCharacters[0].defence.regeneration.map(e=>e.value),[5]);
 assert.equal(r.sharedWard.length,0);
});

test('character cloak applies conditionally to joined regiment, but is removed on detachment',()=>{
 const army=fresh(),sea=unit(army,'Lothern Sea Guard'),c=unit(army,'Ishaya Vess');
 c.selections.push({name:"The Loremaster's Cloak",children:[],kind:'magic-item'});
 const attached=assignCharacter(army,restoreBattleSession(army),c.id,sea.id);
 const result=evaluateDefences(army,attached,sea.id);
 assert.deepEqual(result.sharedWard.map(e=>e.value),[4]);
 assert.equal(result.sharedWard[0].condition,'Magic Missiles only');
 assert.match(result.sharedWard[0].scope,/joined/);
 assert.match(result.sharedWard[0].status,/conditional/);
 assert.equal(result.joinedCharacters[0].defence.ward[0].value,4);
 const detached=assignCharacter(army,attached,c.id,null);
 assert.equal(evaluateDefences(army,detached,sea.id).sharedWard.length,0);
});

test('only explicitly selected equipment counts; shield can be conditional with two-handed weapon',()=>{
 const army=fresh(),ship=unit(army,"Ship's Company");
 assert.equal(evaluateDefences(army,restoreBattleSession(army),ship.id).armour.value,6);
 const unknown=structuredClone(ship);
 unknown.id='new';
 unknown.selections=[{name:'Warbow'},{name:'Great weapon'},{name:'Shield'}];
 army.units.push(unknown);
 const eq=evaluateDefences(army,restoreBattleSession(army),unknown.id);
 assert.equal(eq.armour.value,6,'Unarmoured 7+ improved to 6+ by shield');
 assert.equal(eq.armour.status,'conditional');
 assert.match(eq.armour.note,/two.hand/i);
 const other=structuredClone(ship);
 other.id='unverified';
 other.selections=[{name:'Enchanted armour of unknown value'}];
 army.units.push(other);
 const result=evaluateDefences(army,restoreBattleSession(army),other.id);
 assert.equal(result.armour.value,null);
 assert.match(result.armour.label,/not established/i);
});

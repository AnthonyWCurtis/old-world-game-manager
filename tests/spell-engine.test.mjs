import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter} from '../docs/battle-session.js';
import {SPELL_RULES,eligibleWizardSpells,activateSpell,endSpell,expireAtNextStartOfTurn,sanitizeActiveSpells,spellEffectsFor} from '../docs/spell-engine.js';

const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const army=()=>parseArmy(fixture);
const byName=(a,name)=>a.units.find(u=>u.name===name);
const sea=a=>byName(a,'Lothern Sea Guard');
const storm=a=>byName(a,'Storm Weaver');
const illusion=a=>a.units.filter(u=>u.name==='Mage').find(u=>u.selections.some(s=>s.name==='Illusion'));
const high=a=>a.units.filter(u=>u.name==='Mage').find(u=>u.selections.some(s=>s.name==='High Magic'));
const cast=(a,s,spellId,casterId,targetId)=>activateSpell(a,s,{spellId,casterId,targetId,confirmed:true});

test('published spell metadata and explicit lore + Wizard gating',()=>{
 assert.equal(SPELL_RULES['earthen-ramparts'].sourceUrl,'https://tow.whfb.app/spell/earthen-ramparts');
 assert.equal(SPELL_RULES['earthen-ramparts'].castingValue,'9+');
 assert.equal(SPELL_RULES['earthen-ramparts'].range,'15"');
 assert.equal(SPELL_RULES['glittering-robe'].sourceUrl,'https://tow.whfb.app/spell/glittering-robe');
 assert.equal(SPELL_RULES['glittering-robe'].castingValue,'8+');
 assert.equal(SPELL_RULES['glittering-robe'].range,'Self');
 assert.equal(SPELL_RULES['glittering-robe'].duration,'until next Start of Turn');
 const a=army(),casters=eligibleWizardSpells(a);
 assert.equal(casters.length,5);
 assert.deepEqual(new Set(casters.map(c=>c.spellId)),new Set([
  'earthen-ramparts','glittering-robe','plague-of-rust','travel-mystical-pathway','drain-magic']));
 assert.equal(casters.filter(c=>c.casterId===storm(a).id).length,3);
 assert.equal(casters.filter(c=>c.casterId===illusion(a).id).length,1);
 assert.equal(casters.filter(c=>c.casterId===high(a).id).length,1);
 assert.ok(casters.every(c=>c.knownStatus==='requires-player-confirmation'));
});

test('lore is not knowledge: activation requires confirmed successful casting',()=>{
 const a=army(),s=restoreBattleSession(a);
 const base=JSON.stringify(a);
 assert.throws(()=>activateSpell(a,s,{spellId:'earthen-ramparts',casterId:storm(a).id,targetId:sea(a).id}),/confirm/i);
 assert.throws(()=>cast(a,s,'earthen-ramparts',high(a).id,sea(a).id),/lore|wizard/i);
 assert.throws(()=>cast(a,s,'earthen-ramparts','u-missing',sea(a).id),/caster|wizard/i);
 assert.throws(()=>cast(a,s,'glittering-robe',illusion(a).id,sea(a).id),/self|target/i);
 assert.throws(()=>cast(a,s,'earthen-ramparts',storm(a).id,'not-a-unit'),/target/i);
 assert.throws(()=>cast(a,s,'unknown',storm(a).id,sea(a).id),/spell/i);
 assert.equal(JSON.stringify(a),base);
 assert.deepEqual(s.activeSpells,[]);
});

test('Earthen Ramparts grants a conditional all-wounds 5+ Ward and movement/charge restrictions',()=>{
 const a=army(),s=cast(a,restoreBattleSession(a),'earthen-ramparts',storm(a).id,sea(a).id);
 const e=spellEffectsFor(a,s,sea(a).id);
 assert.deepEqual(e.ward.map(w=>w.value),[5]);
 assert.equal(e.ward[0].condition,'all wounds');
 assert.equal(e.ward[0].sourceUrl,'https://tow.whfb.app/spell/earthen-ramparts');
 assert.equal(e.ward[0].status,'player-declared-active');
 assert.deepEqual(e.movementRestrictions.map(x=>x.code),['cannot-march','cannot-charge','defended-obstacle-if-charged']);
 assert.deepEqual(e.attackModifiers,[]);
 assert.deepEqual(spellEffectsFor(a,s,high(a).id).ward,[]);
 assert.equal(a.army.derivedPoints.value,2599);
});

test('joined characters share unit-targeted Earthen Ward only conditionally; unjoined remain unchanged',()=>{
 const a=army();
 let s=cast(a,restoreBattleSession(a),'earthen-ramparts',storm(a).id,sea(a).id);
 assert.deepEqual(spellEffectsFor(a,s,illusion(a).id).ward,[]);
 s=assignCharacter(a,s,illusion(a).id,sea(a).id);
 const w=spellEffectsFor(a,s,illusion(a).id).ward;
 assert.equal(w[0].value,5);
 assert.match(w[0].scope,/join/i);
 assert.match(w[0].status,/conditional/i);
 s=assignCharacter(a,s,illusion(a).id,null);
 assert.deepEqual(spellEffectsFor(a,s,illusion(a).id).ward,[]);
});

test('Glittering Robe is Self; -1 enemy To Hit to caster and joined unit, never a Ward',()=>{
 const a=army(),s0=assignCharacter(a,restoreBattleSession(a),illusion(a).id,sea(a).id);
 const s=cast(a,s0,'glittering-robe',illusion(a).id,null);
 assert.equal(s.activeSpells[0].joinedUnitId,sea(a).id);
 for(const id of [illusion(a).id,sea(a).id]){
  const e=spellEffectsFor(a,s,id);
  assert.deepEqual(e.ward,[]);
  assert.equal(e.attackModifiers.length,1);
  assert.equal(e.attackModifiers[0].value,-1);
  assert.equal(e.attackModifiers[0].sourceUrl,'https://tow.whfb.app/spell/glittering-robe');
 }
 assert.deepEqual(spellEffectsFor(a,s,storm(a).id).attackModifiers,[]);
});

test('Glittering Robe replaces prior Enchantments on affected models, not remote units',()=>{
 const a=army(),one=sea(a),other=a.units.find(u=>u.name==="Ship's Company");
 let s=restoreBattleSession(a);
 s=cast(a,s,'earthen-ramparts',storm(a).id,one.id);
 s=assignCharacter(a,s,illusion(a).id,one.id);
 s=cast(a,s,'glittering-robe',illusion(a).id,null);
 assert.deepEqual(s.activeSpells.map(x=>x.spellId),['glittering-robe']);
 assert.deepEqual(spellEffectsFor(a,s,one.id).ward,[]);
 // Another Earth target is unaffected by Glittering cast on Sea Guard.
 let t=restoreBattleSession(a);
 t=cast(a,t,'earthen-ramparts',storm(a).id,other.id);
 t=assignCharacter(a,t,illusion(a).id,one.id);
 t=cast(a,t,'glittering-robe',illusion(a).id,null);
 assert.equal(t.activeSpells.length,2);
 assert.equal(spellEffectsFor(a,t,other.id).ward[0].value,5);
});

test('caster moves regiment after Glittering: retain caster -1 but suspend unit protection',()=>{
 const a=army();
 let s=assignCharacter(a,restoreBattleSession(a),illusion(a).id,sea(a).id);
 s=cast(a,s,'glittering-robe',illusion(a).id,null);
 const other=a.units.find(u=>u.name==="Ship's Company");
 s=assignCharacter(a,s,illusion(a).id,other.id);
 assert.equal(spellEffectsFor(a,s,sea(a).id).attackModifiers.length,0);
 assert.equal(spellEffectsFor(a,s,other.id).attackModifiers.length,0);
 assert.equal(spellEffectsFor(a,s,illusion(a).id).attackModifiers[0].value,-1);
 assert.match(spellEffectsFor(a,s,illusion(a).id).warnings.join(' '),/re-evaluat|membership/i);
});

test('end/dispel and next Start of Turn expire effects manually, with no roster mutation',()=>{
 const a=army(),original=JSON.stringify(a);
 let s=cast(a,restoreBattleSession(a),'earthen-ramparts',storm(a).id,sea(a).id);
 s=cast(a,s,'glittering-robe',illusion(a).id,null);
 assert.equal(s.activeSpells.length,2);
 const ended=endSpell(a,s,'earthen-ramparts',storm(a).id);
 assert.equal(ended.activeSpells.length,1);
 assert.equal(s.activeSpells.length,2);
 const expired=expireAtNextStartOfTurn(a,ended);
 assert.equal(expired.activeSpells.length,0);
 assert.equal(JSON.stringify(a),original);
});

test('restore sanitisation drops malformed spell state, stale IDs and duplicates',()=>{
 const a=army();
 const good=cast(a,restoreBattleSession(a),'earthen-ramparts',storm(a).id,sea(a).id).activeSpells[0];
 const restored=sanitizeActiveSpells(a,[good,good,{...good,casterId:'invalid'},{
  ...good,spellId:'bad-spell'},null,{}, {spellId:'glittering-robe',casterId:high(a).id,confirmed:true,targetId:null}]);
 assert.deepEqual(restored,[good]);
 assert.deepEqual(sanitizeActiveSpells(a,null),[]);
});

test('an independently targeted character who joins later brings their whole-unit spell with them',()=>{
 const a=army(),mage=illusion(a),unit=sea(a);
 let s=cast(a,restoreBattleSession(a),'earthen-ramparts',storm(a).id,mage.id);
 assert.equal(spellEffectsFor(a,s,mage.id).ward[0].value,5);
 assert.equal(spellEffectsFor(a,s,unit.id).ward.length,0);
 s=assignCharacter(a,s,mage.id,unit.id);
 const effects=spellEffectsFor(a,s,unit.id);
 assert.equal(effects.ward[0].value,5);
 assert.match(effects.ward[0].scope,/join/i);
 const other=a.units.find(u=>u.name==='Ishaya Vess');
 s=assignCharacter(a,s,other.id,unit.id);
 assert.equal(spellEffectsFor(a,s,other.id).ward[0].value,5);
 s=assignCharacter(a,s,mage.id,null);
 assert.equal(spellEffectsFor(a,s,unit.id).ward.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter,setWizardKnownSpell} from '../docs/battle-session.js';
import {SPELL_RULES,selectedWizardSpells,activateSpell,endSpell,clearSpellEvent,
 expireAtNextStartOfTurn,sanitizeActiveSpells,sanitizeSpellEvents,spellEffectsFor}
 from '../docs/spell-engine.js';

const raw=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const index=JSON.parse(readFileSync(new URL('../docs/reference-records/magic-index.json',import.meta.url),'utf8'));
const make=()=>parseArmy(raw);
const by=(a,n)=>a.units.find(u=>u.name===n);
const storm=a=>by(a,'Storm Weaver');
const sea=a=>by(a,'Lothern Sea Guard');
const high=a=>a.units.filter(u=>u.name==='Mage').find(u=>u.selections.some(s=>s.name==='High Magic'));
const illusion=a=>a.units.filter(u=>u.name==='Mage').find(u=>u.selections.some(s=>s.name==='Illusion'));
function choose(a){
 let session=restoreBattleSession(a);
 for(const [u,name] of [[storm(a),'earthen-ramparts'],[storm(a),'travel-mystical-pathway'],
   [storm(a),'plague-of-rust'],[high(a),'drain-magic'],[illusion(a),'glittering-robe']]){
  session=setWizardKnownSpell(a,session,u.id,'magic-ref:/spell/'+name,true,index);
 }
 return session;
}
const cast=(a,s,spellId,casterId,other={})=>activateSpell(a,s,{spellId,casterId,confirmed:true,...other});

test('every supported spell has an accurate source-linked effect description for casting and active status',()=>{
 const rules=Object.values(SPELL_RULES);
 assert.equal(rules.length,5);
 for(const rule of rules){
  assert.ok(typeof rule.effectSummary==='string'&&rule.effectSummary.length>=60,
   rule.name+' must include a descriptive effectSummary for the Magic workspace');
  assert.equal(rule.sourceUrl,'https://tow.whfb.app/spell/'+rule.id);
 }
 const er=SPELL_RULES['earthen-ramparts'].effectSummary;
 assert.match(er,/5\+ Ward save/);
 assert.match(er,/defended low linear obstacle/);
 assert.match(er,/cannot march or charge/);
 assert.match(er,/next Start of Turn/);
 const gr=SPELL_RULES['glittering-robe'].effectSummary;
 assert.match(gr,/-1 To Hit/);
 assert.match(gr,/joined/);
 assert.match(gr,/other Enchantments previously cast/);
 assert.match(gr,/immediately expire/);
 assert.match(gr,/next Start of Turn/);
});

test('saved known-spell choices become exactly five caster-specific battle options',()=>{
 const a=make(),baseline=restoreBattleSession(a);
 assert.deepEqual(selectedWizardSpells(a,baseline,index),[]);
 const s=choose(a),found=selectedWizardSpells(a,s,index);
 assert.equal(found.length,5);
 assert.equal(found.filter(x=>x.casterId===storm(a).id).length,3);
 assert.equal(found.filter(x=>x.casterId===high(a).id).length,1);
 assert.equal(found.filter(x=>x.casterId===illusion(a).id).length,1);
 assert.equal(found.every(x=>x.supported&&x.rule?.sourceUrl===x.spellUrl),true);
 assert.deepEqual(new Set(found.map(x=>x.spellName)),
  new Set(['Earthen Ramparts','Travel Mystical Pathway','Plague of Rust','Drain Magic','Glittering Robe']));
 const bad=structuredClone(s);bad.knownSpells[high(a).id]=['magic-ref:/spell/plague-of-rust'];
 assert.equal(selectedWizardSpells(a,bad,index).some(x=>x.casterId===high(a).id),false,
  'Never expose a saved off-lore spell as castable');
});

test('selected known-spell enforcement and player confirmation never auto-cast',()=>{
 const a=make(),s=choose(a),original=JSON.stringify(a);
 assert.equal(s.activeSpells.length,0);
 assert.equal(s.spellEvents.length,0);
 assert.throws(()=>activateSpell(a,s,{spellId:'earthen-ramparts',casterId:storm(a).id,targetId:sea(a).id}),/confirm/i);
 assert.throws(()=>cast(a,s,'drain-magic',storm(a).id),/lore/i);
 assert.throws(()=>cast(a,s,'glittering-robe',illusion(a).id,{targetId:sea(a).id}),/Self/i);
 const onlyEarthen=structuredClone(s);
 onlyEarthen.knownSpells[storm(a).id]=['magic-ref:/spell/earthen-ramparts'];
 assert.throws(()=>cast(a,onlyEarthen,'plague-of-rust',storm(a).id,{enemyName:'Enemy'}),/selected known/i);
 assert.equal(JSON.stringify(a),original);
});

test('ER and GR project to the intended friendly unit; incoming hexes never mutate friendly armour',()=>{
 const a=make();let s=choose(a);
 s=cast(a,s,'earthen-ramparts',storm(a).id,{targetId:sea(a).id});
 assert.equal(spellEffectsFor(a,s,sea(a).id).ward[0].value,5);
 s=cast(a,s,'plague-of-rust',storm(a).id,{enemyName:'  Enemy Knights  '});
 assert.equal(s.activeSpells.find(e=>e.spellId==='plague-of-rust').enemyName,'Enemy Knights');
 assert.equal(spellEffectsFor(a,s,sea(a).id).ward[0].value,5);
 assert.throws(()=>cast(a,s,'plague-of-rust',storm(a).id,{enemyName:'  '}),/enemy unit/i);
 assert.throws(()=>cast(a,s,'plague-of-rust',storm(a).id,{targetId:sea(a).id,enemyName:'Enemy'}),/enemy unit/i);
 s=assignCharacter(a,s,illusion(a).id,sea(a).id);
 s=cast(a,s,'glittering-robe',illusion(a).id);
 assert.equal(s.activeSpells.some(e=>e.spellId==='earthen-ramparts'),false);
 assert.equal(s.activeSpells.some(e=>e.spellId==='plague-of-rust'),true,
  'Glittering expires only older Enchantments, not an unrelated enemy Hex');
 assert.equal(spellEffectsFor(a,s,sea(a).id).attackModifiers[0].value,-1);
 assert.deepEqual(spellEffectsFor(a,s,sea(a).id).ward,[]);
});

test('TMP is one immediate movement event, not a permanent enchantment',()=>{
 const a=make(),target=sea(a);let s=choose(a);
 s=cast(a,s,'travel-mystical-pathway',storm(a).id,{targetId:target.id});
 assert.equal(s.activeSpells.length,0);
 assert.equal(s.spellEvents.length,1);
 assert.match(spellEffectsFor(a,s,target.id).movementNotes[0].detail,/cannot move again/i);
 const other=by(a,"Ship's Company");
 assert.deepEqual(spellEffectsFor(a,s,other.id).movementNotes,[]);
 const restored=restoreBattleSession(a,s);
 assert.deepEqual(restored.spellEvents,s.spellEvents);
 const cleared=clearSpellEvent(a,s,'travel-mystical-pathway',storm(a).id,target.id);
 assert.deepEqual(cleared.spellEvents,[]);
 assert.deepEqual(s.spellEvents.length,1);
});

test('Drain Magic is RIP and persists through Start of Turn expiration, but can be ended',()=>{
 const a=make();let s=choose(a);
 s=cast(a,s,'drain-magic',high(a).id);
 assert.equal(s.activeSpells[0].spellId,'drain-magic');
 assert.equal(SPELL_RULES['drain-magic'].lifecycle,'remains-in-play');
 assert.match(spellEffectsFor(a,s,high(a).id).activeEffects[0].condition,/24/);
 s=cast(a,s,'plague-of-rust',storm(a).id,{enemyName:'Enemy Knights'});
 s=cast(a,s,'travel-mystical-pathway',storm(a).id,{targetId:sea(a).id});
 const restored=restoreBattleSession(a,s);
 assert.deepEqual(restored.activeSpells,s.activeSpells);
 assert.deepEqual(restored.spellEvents,s.spellEvents);
 const next=expireAtNextStartOfTurn(a,s);
 assert.deepEqual(next.activeSpells.map(e=>e.spellId),['drain-magic']);
 assert.deepEqual(next.spellEvents,[]);
 assert.deepEqual(endSpell(a,next,'drain-magic',high(a).id).activeSpells,[]);
 assert.deepEqual(sanitizeActiveSpells(a,[{
  spellId:'plague-of-rust',casterId:storm(a).id,enemyName:'',confirmed:true
 }]),[]);
 assert.deepEqual(sanitizeSpellEvents(a,[{
  spellId:'travel-mystical-pathway',casterId:'invalid',targetId:sea(a).id,confirmed:true
 }]),[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter,markCharmedShieldUsed} from '../docs/battle-session.js';
import {ITEM_EFFECT_RULES,ownedItemEffects,projectArmyEffects,sanitizeItemStates,setItemEffectState}
 from '../docs/effects-engine.js';

const fixture=id=>parseArmy(readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8'));
const name=(army,name)=>army.units.find(u=>u.name===name);
const within=(unit,target)=>{
 const visit=xs=>(xs||[]).some(x=>x.name===target||visit(x.children));
 return visit(unit?.selections);
};
const byRule=(proj,id,rule)=>proj.byUnit[id].filter(x=>x.id===rule);

test('All registered effects have tow.whfb.app provenance, mode and meaningful source rules',()=>{
 for(const rule of Object.values(ITEM_EFFECT_RULES)){
  assert.equal(rule.sourceUrl,'https://tow.whfb.app/magic-item/'+rule.id);
  assert.ok(rule.description.length>65,'Need actual rule summary for '+rule.name);
  assert.ok(rule.mode&&rule.scope&&rule.verifiedOn);
 }
 assert.match(ITEM_EFFECT_RULES['razor-standard'].description,/not gain Magical Attacks/);
 assert.match(ITEM_EFFECT_RULES['the-loremasters-cloak'].description,/Magic Missiles only/);
 assert.match(ITEM_EFFECT_RULES['elixir-of-power'].description,/Regeneration cannot save/);
 assert.equal(ITEM_EFFECT_RULES['ruby-ring-of-ruin'].boundSpell.url,
  'https://tow.whfb.app/spell/fireball');
 assert.equal(ITEM_EFFECT_RULES['ruby-ring-of-ruin'].boundSpell.powerLevel,1);
});

test('Only selected imported items get registered, including nested banner and champion equipment',()=>{
 const army=fixture('owb-regular'),text=JSON.stringify(army);
 const effects=ownedItemEffects(army,restoreBattleSession(army));
 const ids=new Set(effects.map(e=>e.id));
 for(const id of [
  'razor-standard','banner-of-confidence','the-loremasters-cloak',
  'charmed-shield','seed-of-rebirth','ruby-ring-of-ruin',
  'scroll-of-invocation','lore-familiar','elixir-of-power',
  'mathlanns-ire','hunters-scorn','bow-of-the-seafarer','reaver-bow'
 ])assert.ok(ids.has(id),'Missing selected item '+id);
 const sea=name(army,'Lothern Sea Guard');
 assert.ok(byRule(projectArmyEffects(army,null),sea.id,'razor-standard').length);
 const cloak=byRule(projectArmyEffects(army,null),sea.id,'the-loremasters-cloak');
 assert.equal(cloak.length,1);
 assert.match(cloak[0].scope,/Champion bearer only/);
 assert.equal(cloak[0].status,'conditional');
 const company=name(army,"Ship's Company");
 assert.deepEqual(projectArmyEffects(army,null).byUnit[company.id],[],
  'Do not invent buffs on a unit just because another unit has them');
 assert.equal(JSON.stringify(army),text,
  'Projecting effects never changes original imported selections or points');
 const other=fixture('single-sea-guard');
 assert.equal(ownedItemEffects(other,null).length,0,
  'No global hardcoded player-army effects on generic imports');
});

test('Standards share with joined characters and joined BSB, without sharing bearer-only items',()=>{
 const army=fixture('owb-regular');
 const sea=name(army,'Lothern Sea Guard');
 const bsb=army.units.find(u=>within(u,'Banner of Confidence'));
 assert.ok(bsb);
 let session=restoreBattleSession(army);
 let proj=projectArmyEffects(army,session);
 assert.equal(byRule(proj,sea.id,'banner-of-confidence').length,0,
  'Independent Battle Standard is not automatically assigned to Sea Guard');
 session=assignCharacter(army,session,bsb.id,sea.id);
 proj=projectArmyEffects(army,session);
 const sharedBanner=byRule(proj,sea.id,'banner-of-confidence');
 assert.equal(sharedBanner.length,1);
 assert.equal(sharedBanner[0].shared,true);
 assert.equal(sharedBanner[0].ownerId,bsb.id);
 assert.equal(sharedBanner[0].status,'conditional');
 assert.match(sharedBanner[0].scope,/joining.*legality not checked/);
 const razorOnBSB=byRule(proj,bsb.id,'razor-standard');
 assert.equal(razorOnBSB.length,1);
 assert.equal(razorOnBSB[0].shared,true);
 assert.equal(byRule(proj,sea.id,'ruby-ring-of-ruin').length,0,
  'Character-only Ruby Ring must not become a regiment cast');
 assert.equal(byRule(proj,sea.id,'charmed-shield').length,0,
  'Charmed Shield benefits must stay on individual bearers');
 assert.equal(byRule(proj,bsb.id,'the-loremasters-cloak').length,0,
  'Champion cloak is not inferred to protect joined characters');
 session=assignCharacter(army,session,bsb.id,null);
 assert.equal(byRule(projectArmyEffects(army,session),sea.id,'banner-of-confidence').length,0);
});

test('One-use scroll and timed Elixir save, expire manually, and cannot be used on a different character',()=>{
 const army=fixture('owb-regular'),before=JSON.stringify(army);
 const wizard=name(army,'Storm Weaver');
 const elixir=army.units.find(u=>within(u,'Elixir of Power'));
 let s=restoreBattleSession(army);
 assert.equal(byRule(projectArmyEffects(army,s),wizard.id,'scroll-of-invocation')[0].status,'ready');
 s=setItemEffectState(army,s,wizard.id,'scroll-of-invocation','spent');
 assert.equal(byRule(projectArmyEffects(army,s),wizard.id,'scroll-of-invocation')[0].status,'spent');
 s=setItemEffectState(army,s,elixir.id,'elixir-of-power','active');
 assert.equal(byRule(projectArmyEffects(army,s),elixir.id,'elixir-of-power')[0].status,'active');
 assert.equal(projectArmyEffects(army,s).counts.active,1);
 const restored=restoreBattleSession(army,s);
 assert.deepEqual(restored.itemStates,s.itemStates);
 let ended=setItemEffectState(army,restored,elixir.id,'elixir-of-power','spent');
 assert.equal(byRule(projectArmyEffects(army,ended),elixir.id,'elixir-of-power')[0].status,'spent');
 ended=setItemEffectState(army,ended,wizard.id,'scroll-of-invocation','ready');
 assert.equal(byRule(projectArmyEffects(army,ended),wizard.id,'scroll-of-invocation')[0].status,'ready');
 assert.throws(()=>setItemEffectState(army,s,elixir.id,'scroll-of-invocation','spent'),/supported one-use item/);
 assert.throws(()=>setItemEffectState(army,s,wizard.id,'scroll-of-invocation','active'),/Invalid item-use status/);
 assert.throws(()=>setItemEffectState(army,s,'invalid','elixir-of-power','spent'),/supported one-use item/);
 assert.equal(JSON.stringify(army),before,'Use-state never mutates a roster');
});

test('Previously saved Charmed Shield use is reflected without a second conflicting item store',()=>{
 const army=fixture('owb-regular');
 const sky=army.units.find(u=>within(u,'Seed of Rebirth'));
 let s=restoreBattleSession(army);
 assert.equal(byRule(projectArmyEffects(army,s),sky.id,'charmed-shield')[0].status,'ready');
 s=markCharmedShieldUsed(army,s,sky.id,true);
 assert.equal(byRule(projectArmyEffects(army,s),sky.id,'charmed-shield')[0].status,'spent');
 assert.equal(restoreBattleSession(army,s).usedCharmedShields[sky.id],true);
 assert.deepEqual(restoreBattleSession(army,s).itemStates,{});
 assert.throws(()=>setItemEffectState(army,s,sky.id,'charmed-shield','spent'),/supported one-use item/);
});

test('Stored item effects are sanitized against absent IDs, invalid stages and other armies',()=>{
 const a=fixture('owb-regular');
 const wiz=name(a,'Storm Weaver');
 const id=wiz.id;
 const payload={
  [id]:{'scroll-of-invocation':'spent','elixir-of-power':'active',
   'ruby-ring-of-ruin':'spent','hacked':'active'},
  imaginary:{'elixir-of-power':'active'}
 };
 assert.deepEqual(sanitizeItemStates(a,payload),{[id]:{'scroll-of-invocation':'spent'}});
 const original=restoreBattleSession(a),bad={...original,itemStates:payload};
 assert.deepEqual(restoreBattleSession(a,bad).itemStates,{[id]:{'scroll-of-invocation':'spent'}});
 assert.deepEqual(restoreBattleSession(fixture('single-sea-guard'),bad).itemStates,{});
});

test('A named magic item with an explicit conflicting magic-item reference is not silently applied',()=>{
 const army=fixture('owb-regular');
 const sea=name(army,'Lothern Sea Guard');
 const finder=xs=>{
  for(const x of xs||[]){if(x.name==='Razor Standard')return x;
   const nested=finder(x.children);if(nested)return nested;}
  return null;
 };
 const selected=finder(sea.selections);
 assert.ok(selected);
 selected.reference={url:'https://tow.whfb.app/magic-item/banner-of-confidence'};
 const items=ownedItemEffects(army,null);
 assert.equal(items.filter(e=>e.ownerId===sea.id&&e.id==='razor-standard').length,0);
});

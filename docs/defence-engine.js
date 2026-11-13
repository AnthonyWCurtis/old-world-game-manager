/**
 * Verified, deliberately limited defensive reference register.
 * Values here are equipment-only or explicitly conditional, never a full
 * attack-specific saving throw or a claim of list/join eligibility.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {spellEffectsFor} from './spell-engine.js';
import {ITEM_EFFECT_RULES} from './effects-engine.js';
import {resolveSelections} from './selection-resolver.js';

export const DEFENCE_SOURCES=Object.freeze({
 armour:'https://tow.whfb.app/weapons-of-war/armour-value',
 shield:'https://tow.whfb.app/weapons-of-war/shield',
 noArmour:'https://tow.whfb.app/weapons-of-war/no-armour',
 ward:'https://tow.whfb.app/the-shooting-phase/ward-saves',
 regeneration:'https://tow.whfb.app/special-rules/regeneration',
 cloak:'https://tow.whfb.app/magic-item/the-loremasters-cloak',
 charmedShield:'https://tow.whfb.app/magic-item/charmed-shield',
 seed:'https://tow.whfb.app/magic-item/seed-of-rebirth',
 mathlannsIre:'https://tow.whfb.app/magic-item/mathlanns-ire',
 faq:'https://tow.whfb.app/faq/general-principles'
});
const hasShield=selections=>selections.some(s=>s.canonicalIdentity==='equipment:shield'||s.canonicalIdentity==='charmed-shield');
const hasItem=(selections,id)=>selections.some(s=>s.canonicalIdentity===id&&s.verificationStatus==='verified'&&!s.duplicateOf);
const cloakRule=(scope)=>({
 name:"The Loremaster's Cloak",saveType:'ward',value:4,label:'4+',
 condition:'Magic Missiles only',scope,sourceUrl:DEFENCE_SOURCES.cloak,
 status:'conditional: attack type and joining eligibility',available:true
});
const otherDefensiveEffects=(selections)=>{
 const effects=[];
 if(hasItem(selections,'mathlanns-ire'))effects.push({
  name:"Mathlann's Ire",scope:'bearer only',
  condition:'Combat phase: one successful enemy To Hit roll against bearer must be re-rolled; not a save.',
  sourceUrl:DEFENCE_SOURCES.mathlannsIre
 });
 return effects;
};

function armourFrom(selections,mounted=false){
 const available=new Set(selections.map(s=>s.canonicalIdentity));
 const base=available.has('equipment:full-plate-armour')?4:available.has('equipment:heavy-armour')?5:
  available.has('equipment:light-armour')?6:null;
 const shield=hasShield(selections);
 // 7+ means unarmoured for the purpose of modifiers; without improvements,
 // it is not presented as a usable 7+ armour save.
 const value=base===null?(shield?6:null):Math.max(2,base-(shield?1:0));
 const twoHand=['equipment:great-weapon','equipment:halberd','equipment:flail']
  .some(id=>available.has(id));
 let note='Selected armour and shield only; excludes enemy Armour Piercing, attack modifiers, spells and unverified special rules.';
 if(twoHand&&shield)note+=' Shield cannot be used while fighting with a weapon requiring two hands.';
 if(mounted)note+=' Mount and rider armour interactions have not been calculated.';
 if(value===null)note+=' No usable armour value is established by the selected equipment (unarmoured 7+ is only used for modifiers).';
 return {
  value,label:value===null?'Not established':value+'+',
  status:value===null?'unresolved':mounted||twoHand&&shield?'conditional':'equipment-only',
  note,sources:[DEFENCE_SOURCES.armour,...(shield?[DEFENCE_SOURCES.shield]:[])]
 };
}

function ownDefence(unit,session,all){
 const resolved=all.filter(s=>s.ownerUnitId===unit.id);
 const mountChoiceUnknown=resolved.some(s=>s.scope.mountedArmourChoice==='unresolved');
 const selected=resolved.filter(s=>s.verificationStatus==='verified'&&!s.duplicateOf&&
   (s.scope.kind==='character'||s.scope.kind==='unit')&&
   (s.selectedItem?.kind==='equipment'||s.canonicalIdentity==='charmed-shield'));
 const personal=resolved.filter(s=>s.verificationStatus==='verified'&&!s.duplicateOf&&
   (s.scope.kind==='character'||s.scope.kind==='unit'&&s.selectedItem?.scope==='standard'));
 const ward=[];
 if(hasItem(personal,'the-loremasters-cloak'))ward.push(cloakRule('bearer only'));
 if(hasItem(personal,'charmed-shield'))ward.push({
  name:'Charmed Shield',saveType:'ward',value:5,label:'5+',
  condition:'once per game against one wound',scope:'bearer only',
  conditionDetail:mountChoiceUnknown?'Choose rider armour value to use this magic shield; mount armour choice unresolved.':null,
  sourceUrl:DEFENCE_SOURCES.charmedShield,
  status:mountChoiceUnknown?'conditional: rider armour choice unresolved':'single-use',
  available:session?.usedCharmedShields?.[unit.id]===true?false:mountChoiceUnknown?null:true,
  faqUrl:mountChoiceUnknown?'https://tow.whfb.app/faq/characters':null
 });
 const regeneration=[];
 if(hasItem(personal,'seed-of-rebirth'))regeneration.push({
  name:'Seed of Rebirth',saveType:'regeneration',value:5,label:'5+',
  condition:'Wound lost by bearer',scope:'bearer only',
  sourceUrl:DEFENCE_SOURCES.seed,status:'source-rule; bearer only',available:true
 });
 return {armour:armourFrom(selected,mountChoiceUnknown),
  ward,regeneration,
  otherEffects:otherDefensiveEffects(personal),
  selectionIssues:resolved.filter(s=>s.conflict||s.unresolved).map(s=>({
   name:s.selection.name,status:s.verificationStatus,
   reason:s.conflict||s.unresolved,importedUrl:s.sourceProvenance.importedUrl}))};
}

function championDefences(unit,all){
 const result=[];
 for(const entry of all.filter(s=>s.ownerUnitId===unit.id&&s.scope.role==='champion'&&
   s.verificationStatus==='verified'&&!s.duplicateOf)){
  const ward=entry.canonicalIdentity==='the-loremasters-cloak'?[cloakRule('champion only')]:
   entry.canonicalIdentity==='charmed-shield'?[{name:'Charmed Shield',saveType:'ward',
    value:5,label:'5+',scope:'champion only',condition:'once per game against one wound',
    status:'one-use state requires model-specific tracking',available:null,
    sourceUrl:DEFENCE_SOURCES.charmedShield}]:[];
  const regeneration=entry.canonicalIdentity==='seed-of-rebirth'?[{
   name:'Seed of Rebirth',saveType:'regeneration',value:5,label:'5+',scope:'champion only',
   condition:'Wound lost by champion',status:'source-rule; champion only',available:true,
   sourceUrl:DEFENCE_SOURCES.seed}]:[];
  if(!ward.length&&!regeneration.length)continue;
  result.push({name:entry.selectionPath.at(-2)||'Champion',ward,
   regeneration,status:'Bearer-specific item; not automatically shared with regiment'});
 }
 return result;
}

/**
 * A full regiment shows its own protection separately from attached characters.
 * General spell effects and unreviewed source data are intentionally excluded.
 */
export function evaluateDefences(army,session,unitId,unitRecords={}){
 const model=createGameScreenModel(army);
 const identity=model.units.find(u=>u.id===unitId);
 if(!identity)throw Error('Unknown imported unit for defensive calculation.');
 const unit=army.units.find(u=>u.id===unitId);
 const resolved=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords});
 const own=ownDefence(unit,session,resolved);
 const spell=spellEffectsFor(army,session,unitId);
 const attachedIds=model.characters.filter(c=>session?.assignments?.[c.id]===unitId);
 const joinedCharacters=identity.isCharacter?[]:attachedIds.map(character=>{
  const imported=army.units.find(u=>u.id===character.id);
  const personal=ownDefence(imported,session,resolved);
  const magic=spellEffectsFor(army,session,character.id);
  return {id:character.id,name:character.name,
   defence:{...personal,ward:[...personal.ward,...magic.ward],
    attackModifiers:magic.attackModifiers,movementRestrictions:magic.movementRestrictions,
    spellWarnings:magic.warnings}};
 });
 const sharedWard=[];
 for(const member of attachedIds){
  const imported=army.units.find(u=>u.id===member.id);
  if(resolved.some(s=>s.ownerUnitId===member.id&&s.canonicalIdentity==='the-loremasters-cloak'&&
    s.verificationStatus==='verified'&&!s.duplicateOf&&s.scope.kind==='character'))sharedWard.push({
   ...cloakRule('joined regiment (assignment not legality-verified)'),
   fromCharacterId:member.id,fromCharacterName:member.name
  });
 }
 return {
  id:unitId,name:unit.name,isCharacter:identity.isCharacter,
  ...own,
  ward:[...own.ward,...spell.ward],
  attackModifiers:spell.attackModifiers,
  movementRestrictions:spell.movementRestrictions,
  spellWarnings:spell.warnings,
  activeSpellEffects:spell.activeEffects,
  spellMovementNotes:spell.movementNotes,
  champions:identity.isCharacter?[]:championDefences(unit,resolved),
  joinedCharacters,sharedWard,
  disclosure:'Armour is equipment-only. Ward and incoming To Hit effects from spells are player-declared and conditional; no automatic legality, enemy AP or dice resolution.'
 };
}

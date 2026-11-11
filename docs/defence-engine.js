/**
 * Verified, deliberately limited defensive reference register.
 * Values here are equipment-only or explicitly conditional, never a full
 * attack-specific saving throw or a claim of list/join eligibility.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {spellEffectsFor} from './spell-engine.js';

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
const label=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const options=entry=>Array.isArray(entry?.selections)?entry.selections:[];
const names=entry=>options(entry).map(s=>label(s.name||s.raw));
const includesName=(selections,name)=>selections.some(s=>label(s.name||s.raw)===name);
const hasShield=selections=>selections.some(s=>['shield','shields','charmed shield'].includes(label(s.name||s.raw)));
const hasCharmed=entry=>includesName(options(entry),'charmed shield');
const hasCloak=entry=>includesName(options(entry),"the loremaster's cloak");
const cloakRule=(scope)=>({
 name:"The Loremaster's Cloak",saveType:'ward',value:4,label:'4+',
 condition:'Magic Missiles only',scope,sourceUrl:DEFENCE_SOURCES.cloak,
 status:'conditional: attack type and joining eligibility',available:true
});
const otherDefensiveEffects=(selections)=>{
 const effects=[];
 if(includesName(selections,"mathlann's ire"))effects.push({
  name:"Mathlann's Ire",scope:'bearer only',
  condition:'Combat phase: one successful enemy To Hit roll against bearer must be re-rolled; not a save.',
  sourceUrl:DEFENCE_SOURCES.mathlannsIre
 });
 return effects;
};

function armourFrom(selections){
 const available=selections.map(s=>label(s.name||s.raw));
 const base=available.includes('full plate armour')?4:available.includes('heavy armour')?5:
  available.includes('light armour')?6:null;
 const shield=hasShield(selections);
 // 7+ means unarmoured for the purpose of modifiers; without improvements,
 // it is not presented as a usable 7+ armour save.
 const value=base===null?(shield?6:null):Math.max(2,base-(shield?1:0));
 const twoHand=available.some(n=>['great weapon','great weapons','halberd','halberds',
  'flail','flails','double-handed weapon','two-handed weapon'].includes(n));
 const mount=available.some(n=>/\b(skycutter|chariot|dragon|griffon|steed|mount)\b/.test(n)&&n!=='on foot');
 let note='Selected armour and shield only; excludes enemy Armour Piercing, attack modifiers, spells and unverified special rules.';
 if(twoHand&&shield)note+=' Shield cannot be used while fighting with a weapon requiring two hands.';
 if(mount)note+=' Mount and rider armour interactions have not been calculated.';
 if(value===null)note+=' No usable armour value is established by the selected equipment (unarmoured 7+ is only used for modifiers).';
 return {
  value,label:value===null?'Not established':value+'+',
  status:value===null?'unresolved':twoHand&&shield?'conditional':'equipment-only',
  note,sources:[DEFENCE_SOURCES.armour,...(shield?[DEFENCE_SOURCES.shield]:[])]
 };
}

function ownDefence(unit,session){
 const selected=options(unit);
 const ward=[];
 if(hasCloak(unit))ward.push(cloakRule('bearer only'));
 if(hasCharmed(unit))ward.push({
  name:'Charmed Shield',saveType:'ward',value:5,label:'5+',
  condition:'once per game against one wound',scope:'bearer only',
  sourceUrl:DEFENCE_SOURCES.charmedShield,status:'single-use',
  available:session?.usedCharmedShields?.[unit.id]!==true
 });
 const regeneration=[];
 if(includesName(selected,'seed of rebirth'))regeneration.push({
  name:'Seed of Rebirth',saveType:'regeneration',value:5,label:'5+',
  condition:'Wound lost by bearer',scope:'bearer only',
  sourceUrl:DEFENCE_SOURCES.seed,status:'source-rule; bearer only',available:true
 });
 return {armour:armourFrom(selected),ward,regeneration,otherEffects:otherDefensiveEffects(selected)};
}

function championDefences(unit){
 const result=[];
 for(const selection of options(unit)){
  const children=Array.isArray(selection.children)?selection.children:[];
  if(!children.length||!/(?:champion|sea master)/i.test(selection.raw||selection.name||''))continue;
  const ward=[];
  if(includesName(children,"the loremaster's cloak"))
   ward.push(cloakRule('champion only'));
  if(!ward.length)continue;
  result.push({name:selection.name||'Champion',ward,
   regeneration:[],status:'Bearer-specific item; not automatically shared with regiment'});
 }
 return result;
}

/**
 * A full regiment shows its own protection separately from attached characters.
 * General spell effects and unreviewed source data are intentionally excluded.
 */
export function evaluateDefences(army,session,unitId){
 const model=createGameScreenModel(army);
 const identity=model.units.find(u=>u.id===unitId);
 if(!identity)throw Error('Unknown imported unit for defensive calculation.');
 const unit=army.units.find(u=>u.id===unitId);
 const own=ownDefence(unit,session);
 const spell=spellEffectsFor(army,session,unitId);
 const attachedIds=model.characters.filter(c=>session?.assignments?.[c.id]===unitId);
 const joinedCharacters=identity.isCharacter?[]:attachedIds.map(character=>{
  const imported=army.units.find(u=>u.id===character.id);
  const personal=ownDefence(imported,session);
  const magic=spellEffectsFor(army,session,character.id);
  return {id:character.id,name:character.name,
   defence:{...personal,ward:[...personal.ward,...magic.ward],
    attackModifiers:magic.attackModifiers,movementRestrictions:magic.movementRestrictions,
    spellWarnings:magic.warnings}};
 });
 const sharedWard=[];
 for(const member of attachedIds){
  const imported=army.units.find(u=>u.id===member.id);
  if(hasCloak(imported))sharedWard.push({
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
  champions:identity.isCharacter?[]:championDefences(unit),
  joinedCharacters,sharedWard,
  disclosure:'Armour is equipment-only. Ward and incoming To Hit effects from spells are player-declared and conditional; no automatic legality, enemy AP or dice resolution.'
 };
}

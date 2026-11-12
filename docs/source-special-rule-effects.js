/**
 * Reviewed, SOURCE-EXTRACTED published special rules with character-granted benefits.
 *
 * This is rule DATA, never a faction switch in the engine. We can add further
 * verified rule descriptors without changing the generic eligibility/projector.
 * Unknown or unverified special rules remain source-linked reference entries;
 * their bonuses are never guessed or automatically assigned.
 *
 * Exclusive factual source: https://tow.whfb.app (reviewed 2026-11-12).
 */
import {createGameScreenModel} from './game-screen-model.js';
import {reviewedCoreRule} from './source-core-rule-effects.js';

const SOURCE='https://tow.whfb.app/';
const isRuleSource=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/special-rules\/[a-z0-9-]+\/?$/.test(url);
const text=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const isVerifiedRecord=(unit,record)=>!!unit?.reference?.url&&
 unit.reference.url===record?.source?.sourceUrl&&
 record?.source?.verificationStatus==='source-extracted'&&
 Array.isArray(record?.startingRules);
const specialRule=(id,name,ownerUnitUrl,targetUnitUrl,description,quickLabel,quickDetail)=>Object.freeze({
 id,name,sourceUrl:SOURCE+'special-rules/'+id,
 sourceOwnerUrl:SOURCE+'unit/'+ownerUnitUrl,
 targetUnitUrl:SOURCE+'unit/'+targetUnitUrl,
 trigger:'recorded-joined-regiment',kind:'Special rule',status:'conditional',
 description,quickLabel,quickDetail,verifiedOn:'2026-11-12'
});

export const REVIEWED_CHARACTER_RULES=Object.freeze({
 'precision-strikes':specialRule(
  'precision-strikes','Precision Strikes','ishaya-vess','lothern-sea-guard',
  'A Lothern Sea Guard unit joined by Ishaya Vess improves the Armour Piercing characteristic of its weapons by 1. This is a joined-regiment weapon benefit; do not assume a personal attack modifier on Ishaya Vess or a bonus to unrelated units.',
  'Precision Strikes · AP +1',
  'While Ishaya Vess is joined to this Lothern Sea Guard unit, improve its weapons\' AP by 1. This is separate from Armour Bane (2), which applies only on the specified natural 6 To Wound.'
 )
});

/**
 * Rules inherited by a recorded regiment from any qualifying character.
 * Scope is explicit, and the source rule must be present on the matching
 * source-extracted character record. These are reminders, not automated rolls.
 */
export const REVIEWED_CONTAGIOUS_RULES=Object.freeze({
 'stupidity':Object.freeze({
  id:'stupidity',name:'Stupidity',
  sourceUrl:SOURCE+'special-rules/stupidity',
  faqUrl:SOURCE+'faq/universal-special-rules',
  trigger:'recorded-joined-regiment',kind:'Special rule',
  status:'conditional',effectGroup:'restriction',verifiedOn:'2026-11-12',
  description:'A unit becomes subject to Stupidity when joined by a character with Stupidity. Unless fleeing or engaged in combat, a subject unit takes a Leadership test in its Start of Turn sub-phase. On failure until its next Start of Turn, it cannot move (except to flee), shoot, cast spells or attempt Wizardly dispels, and must Hold if charged. No test or failed result is assumed.',
  quickLabel:'Stupidity · test required',
  quickDetail:'A recorded joined character with Stupidity makes the regiment subject to the rule. Test when required; restrictions apply only after failure. Leaving removes the inherited rule.'
 })
});

/** Only the published rules from a unit's *matching* source-extracted record. */
export function verifiedPublishedRules(unit,record){
 if(!isVerifiedRecord(unit,record))return [];
 const seen=new Set();
 return record.startingRules.filter(ref=>{
  if(!isRuleSource(ref?.sourceUrl)||!text(ref?.name))return false;
  const key=ref.sourceUrl;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 }).map(ref=>({name:text(ref.name),sourceUrl:ref.sourceUrl}));
}

/** All published source rules that aren't currently interpreted as effects.
 * These remain informational; many are individual or formation rules rather
 * than buffs, and other subsystems may handle them.
 */
export function referenceOnlyPublishedRules(unit,record){
 const available=verifiedPublishedRules(unit,record);
 const modelled=new Set(Object.values(REVIEWED_CHARACTER_RULES)
  .filter(rule=>unit?.reference?.url===rule.sourceOwnerUrl)
  .map(rule=>rule.sourceUrl));
 // General contagious rules are projected only from character instances.
 // Keep the same rules visible as reference-only on ordinary regiments.
 if(/characters?/i.test(unit?.section||''))
  for(const rule of Object.values(REVIEWED_CONTAGIOUS_RULES))
   modelled.add(rule.sourceUrl);
 return available.filter(ref=>!modelled.has(ref.sourceUrl)&&!reviewedCoreRule(ref));
}

function candidateSourceRule(owner,record,rule){
 if(owner?.reference?.url!==rule.sourceOwnerUrl)return false;
 return verifiedPublishedRules(owner,record).some(ref=>
  ref.name===rule.name&&ref.sourceUrl===rule.sourceUrl);
}

/** Adds validated rule data to the existing per-unit effect projection.
 * This is view-only; joins have been RECORDED but not rules-legality checked.
 */
export function projectReviewedCharacterRules(army,session,unitRecords={},byUnit={}){
 const model=createGameScreenModel(army);
 const importedById=new Map((army?.units||[]).map(unit=>[unit.id,unit]));
 const regiments=new Map(model.regiments.map(u=>[u.id,u]));
 for(const character of model.characters){
  const owner=importedById.get(character.id);
  const record=unitRecords?.[character.id];
  for(const rule of Object.values(REVIEWED_CHARACTER_RULES)){
   if(!candidateSourceRule(owner,record,rule))continue;
   if(!byUnit[character.id])continue;
   // The special rule exists on its bearer, independent of a recorded join.
   // It is NOT a personal AP modifier; show it as a conditional support rule.
   byUnit[character.id].push({
    ...rule,ownerId:character.id,ownerName:character.name,ownerIsCharacter:true,
    beneficiaryId:character.id,
    scope:'Source character only: grants this benefit to a qualifying regiment while joined. Not a bonus to the character’s own weapons.',
    shared:false,joinedFrom:null,effectGroup:'support',quickLabel:rule.name,
    trackUse:false,boundSpell:null
   });
   const regiment=regiments.get(session?.assignments?.[character.id]);
   const importedRegiment=regiment&&importedById.get(regiment.id);
   if(!regiment||importedRegiment?.reference?.url!==rule.targetUnitUrl||
       !byUnit[regiment.id])continue;
   byUnit[regiment.id].push({
    ...rule,ownerId:character.id,ownerName:character.name,ownerIsCharacter:true,
    beneficiaryId:regiment.id,
    scope:'From '+character.name+': recorded join to this regiment. Applies to the qualifying Lothern Sea Guard weapons; join legality and on-table eligibility are not automatically verified.',
    shared:true,joinedFrom:character.id,effectGroup:'offensive',
    trackUse:false,boundSpell:null
   });
  }
  // This projector is deliberately army-agnostic: a verified character with
  // this published rule grants its listed unit-level consequences to whichever
  // regiment it is recorded as joining. It does not automate joining legality,
  // tests, results, mounts, casualties, or any other special rule.
  for(const rule of Object.values(REVIEWED_CONTAGIOUS_RULES)){
   if(!verifiedPublishedRules(owner,record).some(ref=>
      ref.name===rule.name&&ref.sourceUrl===rule.sourceUrl))continue;
   if(!byUnit[character.id])continue;
   byUnit[character.id].push({
    ...rule,ownerId:character.id,ownerName:character.name,
    ownerIsCharacter:true,beneficiaryId:character.id,
    scope:'Character has this verified source rule; any legally joined regiment also becomes subject. No test result is assumed.',
    shared:false,joinedFrom:null,trackUse:false,boundSpell:null
   });
   const regiment=regiments.get(session?.assignments?.[character.id]);
   if(!regiment||!byUnit[regiment.id])continue;
   byUnit[regiment.id].push({
    ...rule,ownerId:character.id,ownerName:character.name,
    ownerIsCharacter:true,beneficiaryId:regiment.id,
    scope:'From '+character.name+': this regiment is subject to Stupidity while the character is joined. Joining legality, test results and failed-test restrictions are not automated.',
    shared:true,joinedFrom:character.id,trackUse:false,boundSpell:null
   });
  }
 }
 return byUnit;
}

/**
 * Reviewed, read-only reminders for common PUBLISHED starting special rules.
 *
 * These never adjust numeric stats, battle state, saves, legal joins, attack
 * totals, or imported options. Exact name + canonical source URL and matching
 * source-extracted unit record are required; missing/mismatched evidence fails
 * closed. Source: https://tow.whfb.app (reviewed 2026-11-12).
 *
 * This module is pure rule-data interpretation and contains no faction switch.
 */
const ORIGIN='https://tow.whfb.app';
const SRC=ORIGIN+'/special-rules/';
const checked='2026-11-12';
const fixed=Object.freeze({
 'close-order':Object.freeze({
  name:'Close Order',kind:'formation',phase:'Formation',
  summary:'A unit consisting of models with Close Order may adopt a Close Order formation. Possessing the rule does not establish the current formation.',
  scope:'Published unit profile lists Close Order. Check every model and actual formation; this is not an automatic combat-resolution bonus.'
 }),
 'swiftstride':Object.freeze({
  name:'Swiftstride',kind:'movement',phase:'Movement',
  summary:'A unit consisting entirely of models with Swiftstride increases its maximum possible charge range by 3 inches. Before making a Charge, Flee or Pursuit roll, the unit may choose to add D6 to the roll.',
  scope:'The entire unit must have the rule, including any joined models. No extra movement or D6 is applied automatically.'
 })
});
const variable=Object.freeze({
 'armour-bane':Object.freeze({
  title:'Armour Bane',pattern:/^Armour Bane \(([1-9]\d*)\)$/,
  kind:'offence',phase:'Combat / Shooting',
  describe:x=>`A model with Armour Bane (${x}) improves its weapon's AP by ${x} only for a natural 6 on its To Wound roll. It is not an always-on modifier.`,
  scope:'Only eligible attacks made by model(s) with the rule. Do not change AP on other To Wound results or assume every model carries the rule.'
 }),
 'regeneration':Object.freeze({
  title:'Regeneration',pattern:/^Regeneration \(([1-6]\+)\)$/,
  kind:'defence',phase:'Unsaved Wounds',
  describe:x=>`A model with Regeneration (${x}) may roll a ${x} Regeneration save immediately after losing a Wound and before removal. A recovered Wound still counts towards combat result; armour modifiers do not modify its Regeneration value unless specifically stated.`,
  scope:'Model-level saving rule. Do not assume every model in the unit shares this value, or that a save has been rolled.'
 }),
 'impact-hits':Object.freeze({
  title:'Impact Hits',pattern:/^Impact Hits \(((?:[1-9]\d*|(?:[1-9]\d*)?D[1-9]\d*(?:\+[1-9]\d*)?))\)$/,
  kind:'combat',phase:'Charge / Combat',
  describe:x=>`Impact Hits (${x}) apply only to a charging model that moved at least 3 inches and is in base contact. Resolve ${x} automatic hits at the attacker's unmodified Strength when choosing the combat, before challenges.`,
  scope:'Check charge movement, base contact and the model bearing this rule. Do not assume a charge, dice result, model count or successful wound.'
 }),
 'stomp-attacks':Object.freeze({
  title:'Stomp Attacks',pattern:/^Stomp Attacks \(((?:[1-9]\d*|(?:[1-9]\d*)?D[1-9]\d*(?:\+[1-9]\d*)?))\)$/,
  kind:'combat',phase:'Combat',
  describe:x=>`Stomp Attacks (${x}) may be made by an eligible model in base contact. Resolve ${x} automatic hits using that model's unmodified Strength after all other attacks, including Initiative 1 attacks.`,
  scope:'Check the individual model, base contact and number rolled; this does not create automatic hits or wounds in the calculator.'
 })
});
export const REVIEWED_CORE_RULES=Object.freeze({
 ...Object.fromEntries(Object.entries(fixed).map(([slug,r])=>[slug,Object.freeze({
  id:slug,sourceUrl:SRC+slug,kind:r.kind,phase:r.phase,
  verifiedOn:checked,mode:'manual-reference'
 })])),
 ...Object.fromEntries(Object.entries(variable).map(([slug,r])=>[slug,Object.freeze({
  id:slug,sourceUrl:SRC+slug,kind:r.kind,phase:r.phase,
  verifiedOn:checked,mode:'manual-reference'
 })]))
});
const validSource=(unit,record)=>!!unit?.reference?.url&&
 unit.reference.url===record?.source?.sourceUrl&&
 /^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+\/?$/.test(unit.reference.url)&&
 record?.source?.verificationStatus==='source-extracted'&&
 Array.isArray(record?.startingRules);

export function reviewedCoreRule(ref){
 if(!ref||typeof ref.name!=='string'||typeof ref.sourceUrl!=='string')return null;
 const name=ref.name.trim();
 for(const [slug,definition] of Object.entries(fixed)){
  if(ref.sourceUrl===SRC+slug&&name===definition.name)
   return Object.freeze({
    id:'published-'+slug,name,sourceUrl:ref.sourceUrl,
    phase:definition.phase,description:definition.summary,scope:definition.scope,
    effectKind:definition.kind
   });
 }
 for(const [slug,definition] of Object.entries(variable)){
  if(ref.sourceUrl!==SRC+slug)continue;
  const m=definition.pattern.exec(name);
  if(!m)return null;
  return Object.freeze({
   id:'published-'+slug+'-'+m[1].replace(/\+/g,'plus').toLowerCase(),
   name,sourceUrl:ref.sourceUrl,phase:definition.phase,
   description:definition.describe(m[1]),scope:definition.scope,
   effectKind:definition.kind
  });
 }
 return null;
}

/**
 * Only exact source-extracted STARTING rules. Optional selections, equipment
 * names and joined characters do not grant rules to every regiment member.
 */
export function projectReviewedCoreRules(army,records={},byUnit={}){
 for(const unit of army?.units||[]){
  const record=records?.[unit.id];
  if(!validSource(unit,record)||!byUnit[unit.id])continue;
  const seen=new Set();
  for(const ref of record.startingRules){
   const match=reviewedCoreRule(ref);
   if(!match||seen.has(match.id))continue;
   seen.add(match.id);
   byUnit[unit.id].push({
    ...match,kind:'Published special rule',mode:'manual-reference',
    status:'manual',verifiedOn:checked,ownerId:unit.id,
    ownerName:unit.name,ownerIsCharacter:false,beneficiaryId:unit.id,
    phase:match.phase,effectGroup:'manual',
    scope:match.scope+' Source says the published unit has this rule; verify eligible models and the actual on-table situation.',
    shared:false,joinedFrom:null,trackUse:false,boundSpell:null,
    quickLabel:null,quickDetail:null
   });
  }
 }
 return byUnit;
}

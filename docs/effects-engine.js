/**
 * Source-reviewed item and spell effect projection for imported unit instances.
 * No effect is inferred from a catalogue match: an item must occur in the
 * actual imported selections. The registry is deliberately limited; unknown
 * items remain listed in the imported roster without a fabricated effect.
 *
 * References exclusively https://tow.whfb.app (reviewed 2026-11-11).
 * Manual character assignments are NOT verified as legal joins.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {SPELL_RULES,spellEffectsFor} from './spell-engine.js';

const SOURCE='https://tow.whfb.app/';
const item=(id,name,kind,mode,description,extra={})=>Object.freeze({
 id,name,kind,mode,description,sourceUrl:SOURCE+'magic-item/'+id,
 verifiedOn:'2026-11-11',...extra
});
export const ITEM_EFFECT_RULES=Object.freeze({
 'razor-standard':item('razor-standard','Razor Standard','Magic standard','passive',
  'The unit carrying this standard gains Armour Bane (2). On a natural 6 To Wound, the Armour Piercing of the weapon used for that wound improves by 2 (for example, AP – becomes AP -2). This is not AP -2 on every wound, does not apply to spells and does not gain Magical Attacks.',
  {scope:'standard',effectGroup:'offensive',quickLabel:'Armour Bane (2)',
   quickDetail:'Natural 6 To Wound: the weapon\'s AP improves by 2 for that wound only (AP – becomes AP -2). Not an automatic -2 to every enemy save; not for spells.',
   ruleUrl:SOURCE+'special-rules/armour-bane',faqUrl:SOURCE+'faq/universal-special-rules'}),
 'banner-of-confidence':item('banner-of-confidence','Banner of Confidence','Magic standard','conditional',
  'A unit carrying this standard does not suffer the usual -1 To Hit modifier when making a Stand & Shoot charge reaction.',
  {scope:'standard'}),
 'the-loremasters-cloak':item('the-loremasters-cloak',"The Loremaster's Cloak",'Talisman','conditional',
  'The bearer and any unit they have joined have a 4+ Ward save against wounds caused by Magic Missiles only. It is not a general Ward save.',
  {scope:'joined-unit'}),
 'charmed-shield':item('charmed-shield','Charmed Shield','Magic armour','single-use',
  'This is a shield; once per game its bearer may use a 5+ Ward save against a single wound. After use it becomes an ordinary non-magical shield.',
  {scope:'bearer',usesExistingShieldState:true}),
 'seed-of-rebirth':item('seed-of-rebirth','Seed of Rebirth','Enchanted item','passive',
  'The bearer gains Regeneration (5+). This benefit belongs to its bearer, not automatically to a joined regiment.',
  {scope:'bearer'}),
 'ruby-ring-of-ruin':item('ruby-ring-of-ruin','Ruby Ring of Ruin','Enchanted item','bound-spell',
  'The bearer can cast Fireball as a Bound spell at Power Level 1. Fireball is a 24" Magic Missile (casting value 8+) causing 2D6 Strength 4 hits with Flaming Attacks and no AP modifier. Casting and damage are not resolved automatically.',
  {scope:'bearer',boundSpell:{name:'Fireball',url:SOURCE+'spell/fireball',
    powerLevel:1,phase:'Shooting',type:'Magic Missile'},
   faqUrl:SOURCE+'magic/bound-spells'}),
 'mathlanns-ire':item('mathlanns-ire',"Mathlann's Ire",'Magic weapon','conditional',
  'Combat weapon: Strength +1, AP -2. During the Combat phase, an enemy must re-roll one successful roll To Hit made against its wielder.',
  {scope:'bearer'}),
 'hunters-scorn':item('hunters-scorn',"Hunter's Scorn",'Magic weapon','conditional',
  '30" bow, Strength 5, AP -1. If a model with 2+ Wounds suffers an unsaved wound from it, that model and its unit suffer -1 Initiative (minimum 1) for the rest of the game; if the wielder fails to wound their target, the effect is lost. Enemy penalties are not tracked automatically.',
  {scope:'bearer'}),
 'bow-of-the-seafarer':item('bow-of-the-seafarer','Bow of the Seafarer','Magic weapon','conditional',
  '30" shooting weapon, Strength 5, AP -3. Counts as a Bow of Avelorn and fires like a bolt thrower with Through & Through. Not an automatic bonus to other weapons.',
  {scope:'bearer'}),
 'reaver-bow':item('reaver-bow','Reaver Bow','Magic weapon','conditional',
  '30" shooting weapon, Strength equal to bearer Strength +1, AP -. The bearer may make shooting attacks equal to their Attacks characteristic with no Multiple Shots modifiers. It counts as a Bow of Avelorn.',
  {scope:'bearer'}),
 'lore-familiar':item('lore-familiar','Lore Familiar','Arcane item','conditional',
  'The owner chooses spells from their selected lore, including its signature spell, instead of generating them randomly. This changes spell generation, not the number of successful casts.',
  {scope:'bearer'}),
 'scroll-of-invocation':item('scroll-of-invocation','Scroll of Invocation','Arcane item','single-use',
  'Single use, 0-1 per Wizard. Use instead of making a Casting roll: the spell counts as cast with its minimum casting value; opponents may still dispel normally.',
  {scope:'bearer',trackUse:true}),
 'elixir-of-power':item('elixir-of-power','Elixir of Power','Enchanted item','timed-single-use',
  'Single use, consumed during your Command sub-phase. The bearer gains +1 Strength, Attacks and Initiative (each to a maximum of 10) until their next Start of Turn. When it ends they lose one Wound, which Regeneration cannot save.',
  {scope:'bearer',trackUse:true})
});

const norm=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/\s+/g,' ').replace(/[’‘]/g,"'").trim();
const byName=new Map(Object.values(ITEM_EFFECT_RULES).map(rule=>[norm(rule.name),rule]));
function selectionsFor(unit){
 const selected=[];
 const visit=(list,parent='',group='')=>{
  if(!Array.isArray(list))return;
  for(const selection of list){
   if(!selection||typeof selection!=='object')continue;
   const current={selection,parent,group};
   selected.push(current);
   visit(selection.children,selection.name||selection.raw||'',group);
  }
 };
 visit(unit?.selections);
 for(const group of unit?.modelGroups||[])visit(group.selections,'',group.name||'');
 return selected;
}
function sourceMatches(selection,rule){
 // An explicit, conflicting magic-item URL must never be turned into an
 // effect for another magic item. Unmatched exports can still use the
 // name-to-reviewed-source register without requiring a live site request.
 const ref=selection?.reference?.url;
 return typeof ref!=='string'||!ref.startsWith(SOURCE+'magic-item/')||
  ref.replace(/\/$/,'')===rule.sourceUrl;
}
function stateFor(rule,ownerId,session){
 if(rule.usesExistingShieldState)
  return session?.usedCharmedShields?.[ownerId]?'spent':'ready';
 if(rule.trackUse){
  const saved=session?.itemStates?.[ownerId]?.[rule.id];
  if(saved==='spent')return 'spent';
  if(saved==='active'&&rule.mode==='timed-single-use')return 'active';
  return 'ready';
 }
 if(rule.mode==='passive')return 'equipped';
 if(rule.mode==='conditional')return 'conditional';
 if(rule.mode==='bound-spell')return 'bound-spell';
 return 'reference';
}
function scopeFor(rule,owner,ctx){
 if(rule.scope==='standard')return owner.isCharacter?
  'Standard borne by character; joining eligibility not verified':
  'Unit carrying standard; joined characters included (FAQ)';
 if(rule.scope==='joined-unit'&&owner.isCharacter)
  return 'Bearer and legal joined unit; Magic Missiles only';
 if(rule.scope==='joined-unit'&&ctx.champion)
  return 'Champion bearer only; no joined-unit protection assumed';
 if(rule.scope==='joined-unit')
  return 'Imported item bearer not established; no unit-wide Ward assumed';
 return owner.isCharacter?'Bearer only':
  ctx.champion?'Champion bearer only':'Imported bearer only; model not individually identified';
}
export function ownedItemEffects(army,session){
 const model=createGameScreenModel(army),byId=new Map(model.units.map(u=>[u.id,u]));
 const found=[];
 for(const unit of army?.units||[]){
  const owner=byId.get(unit.id);
  if(!owner)continue;
  const seen=new Set();
  for(const {selection,parent,group} of selectionsFor(unit)){
   const rule=byName.get(norm(selection.name||selection.raw));
   if(!rule||!sourceMatches(selection,rule)||seen.has(rule.id))continue;
   const champion=/champion|sea master/i.test(parent+' '+group);
   // A standard buried under an explicitly non-standard model is not
   // projected across an entire regiment by guessing its bearer.
   const standardBearer=/(?:standard bearer|battle standard bearer|bsb)/i.test(parent+' '+group);
   const unresolvedStandard=rule.scope==='standard'&&!owner.isCharacter&&!standardBearer&&!(!parent&&!group);
   seen.add(rule.id);
   found.push({
    id:rule.id,name:rule.name,kind:rule.kind,mode:rule.mode,
    description:rule.description,sourceUrl:rule.sourceUrl,
    verifiedOn:rule.verifiedOn,faqUrl:rule.faqUrl||null,
    ownerId:owner.id,ownerName:unit.name,ownerIsCharacter:owner.isCharacter,
    beneficiaryId:owner.id,scope:scopeFor(rule,owner,{champion}),
    sourceSelection:selection.name||selection.raw,
    champion,unresolvedStandard,
    status:stateFor(rule,owner.id,session),
    boundSpell:rule.boundSpell||null,
    effectGroup:rule.effectGroup||null,quickLabel:rule.quickLabel||null,
    quickDetail:rule.quickDetail||null,ruleUrl:rule.ruleUrl||null,
    trackUse:rule.trackUse===true,
    usesExistingShieldState:rule.usesExistingShieldState===true,
    shared:false,joinedFrom:null
   });
  }
 }
 return found;
}
export function sanitizeItemStates(army,stored){
 const eligible=new Set(ownedItemEffects(army,null)
  .filter(e=>e.trackUse).map(e=>e.ownerId+':'+e.id));
 const result={};
 if(!stored||typeof stored!=='object'||Array.isArray(stored))return result;
 for(const [ownerId,items] of Object.entries(stored)){
  if(!items||typeof items!=='object'||Array.isArray(items))continue;
  for(const [id,status] of Object.entries(items)){
   if(!eligible.has(ownerId+':'+id))continue;
   const rule=ITEM_EFFECT_RULES[id];
   if(status!=='spent'&&!(rule.mode==='timed-single-use'&&status==='active'))continue;
   if(!result[ownerId])result[ownerId]={};
   result[ownerId][id]=status;
  }
 }
 return result;
}
export function setItemEffectState(army,session,ownerId,id,status){
 const item=ownedItemEffects(army,session)
  .find(entry=>entry.ownerId===ownerId&&entry.id===id);
 if(!item||!item.trackUse)throw Error('Select a supported one-use item in this imported unit.');
 const allowed=item.mode==='timed-single-use'?['ready','active','spent']:['ready','spent'];
 if(!allowed.includes(status))throw Error('Invalid item-use status.');
 const current=sanitizeItemStates(army,session?.itemStates);
 const next={...current,[ownerId]:{...current[ownerId]}};
 if(status==='ready')delete next[ownerId][id];else next[ownerId][id]=status;
 if(!Object.keys(next[ownerId]).length)delete next[ownerId];
 return {...session,itemStates:next};
}
const added=(list,entry,recipient,scope)=>{
 list.push({...entry,beneficiaryId:recipient,shared:recipient!==entry.ownerId,
  scope:recipient===entry.ownerId?entry.scope:scope,joinedFrom:recipient!==entry.ownerId?entry.ownerId:null});
};
export function projectArmyEffects(army,session){
 const model=createGameScreenModel(army);
 const byUnit=Object.fromEntries(model.units.map(u=>[u.id,[]]));
 const entryById=new Map(model.units.map(u=>[u.id,u]));
 const assignments=session?.assignments||{};
 const owned=ownedItemEffects(army,session);
 for(const entry of owned){
  added(byUnit[entry.ownerId],entry,entry.ownerId,entry.scope);
  const owner=entryById.get(entry.ownerId);
  if(entry.unresolvedStandard||!owner)continue;
  let regimentId=null;
  if(entry.id==='the-loremasters-cloak'&&!owner.isCharacter)continue;
  if(entry.kind!=='Magic standard'&&entry.id!=='the-loremasters-cloak')continue;
  if(owner.isCharacter)regimentId=assignments[entry.ownerId]||null;
  else if(entry.kind==='Magic standard')regimentId=entry.ownerId;
  if(!regimentId||!entryById.has(regimentId))continue;
  const members=[regimentId,...Object.entries(assignments)
   .filter(([,to])=>to===regimentId).map(([from])=>from)];
  for(const beneficiary of members){
   if(beneficiary===entry.ownerId||!byUnit[beneficiary])continue;
   const scope=entry.kind==='Magic standard'?
    'Shared by unit carrying standard; character joins recorded, legality not checked':
    'Conditional 4+ Ward versus Magic Missiles from joined bearer; legality not checked';
   added(byUnit[beneficiary],entry,beneficiary,scope);
  }
 }
 // Normalize active spell records in the SAME unit-facing shape. Existing
 // specialised spell/defence engines remain the source of numeric effects.
 for(const unit of model.units){
  const magic=spellEffectsFor(army,session,unit.id);
  for(const active of magic.activeEffects){
   const rule=SPELL_RULES[active.spellId];
   if(!rule)continue;
   byUnit[unit.id].push({
    id:rule.id,name:rule.name,kind:'Spell',mode:'spell',
    status:'active',description:rule.effectSummary||'View the spell source for effect details.',
    sourceUrl:rule.sourceUrl,verifiedOn:'2026-11-11',
    ownerId:active.casterId,ownerName:entryById.get(active.casterId)?.name||'Caster',
    beneficiaryId:unit.id,scope:active.scope,shared:active.casterId!==unit.id,
    duration:rule.duration,trackUse:false,boundSpell:null
   });
  }
  for(const movement of magic.movementNotes){
   const rule=SPELL_RULES['travel-mystical-pathway'];
   byUnit[unit.id].push({
    id:rule.id,name:rule.name,kind:'Spell',mode:'spell',
    status:'resolved',description:movement.detail,sourceUrl:rule.sourceUrl,
    verifiedOn:'2026-11-11',ownerId:movement.casterId,
    ownerName:entryById.get(movement.casterId)?.name||'Caster',
    beneficiaryId:unit.id,scope:'Target unit already moved in Movement phase',
    duration:'Movement phase',shared:true,trackUse:false,boundSpell:null
   });
  }
 }
 const counts={equipped:0,conditional:0,ready:0,active:0,spent:0,boundSpells:0};
 for(const item of owned){
  if(item.status==='equipped')counts.equipped++;
  else if(item.status==='conditional')counts.conditional++;
  else if(item.status==='ready')counts.ready++;
  else if(item.status==='active')counts.active++;
  else if(item.status==='spent')counts.spent++;
  else if(item.status==='bound-spell')counts.boundSpells++;
 }
 return {owned,byUnit,counts,
  boundSpells:owned.filter(e=>e.boundSpell),
  trackedItems:owned.filter(e=>e.trackUse||e.usesExistingShieldState)};
}

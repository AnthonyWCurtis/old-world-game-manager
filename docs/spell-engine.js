/**
 * Two source-reviewed enchantments with player-declared success/ownership.
 * Pure state + effect projection; NEVER treats an imported lore as spell knowledge.
 * All limitations are explicit (range, combat eligibility, joining and timing).
 */
import {createGameScreenModel} from './game-screen-model.js';

export const SPELL_RULES=Object.freeze({
 'earthen-ramparts':Object.freeze({
  id:'earthen-ramparts',name:'Earthen Ramparts',lore:'Elementalism',type:'Enchantment',
  castingValue:'9+',range:'15"',duration:'until next Start of Turn',
  sourceUrl:'https://tow.whfb.app/spell/earthen-ramparts',
  targeting:'friendly-unit',ruleStatus:'verified-rule; player-declared-casting'
 }),
 'glittering-robe':Object.freeze({
  id:'glittering-robe',name:'Glittering Robe',lore:'Illusion',type:'Enchantment',
  castingValue:'8+',range:'Self',duration:'until next Start of Turn',
  sourceUrl:'https://tow.whfb.app/spell/glittering-robe',
  targeting:'self',ruleStatus:'verified-rule; player-declared-casting'
 })
});

const normalize=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function allSelections(unit){
 const entries=[];
 const visit=s=>{entries.push(s);for(const c of s?.children||[])visit(c);};
 for(const selection of unit?.selections||[])visit(selection);
 return entries;
}
const unitIds=(army)=>new Set((army?.units||[]).map(u=>u.id));
const model=(army)=>createGameScreenModel(army);
const spellKey=(entry)=>entry.spellId+':'+entry.casterId;

/** A lore names a candidate spell. The game does NOT assume it was learned. */
export function eligibleWizardSpells(army){
 const characters=model(army).characters;
 const result=[];
 for(const unit of characters){
  const selections=allSelections(unit);
  const names=new Set(selections.map(s=>normalize(s?.name)));
  const isWizard=names.has('wizard')||[...names].some(n=>/^level [1-4] wizard$/.test(n));
  if(!isWizard)continue;
  for(const rule of Object.values(SPELL_RULES)){
   if(!names.has(normalize(rule.lore)))continue;
   const explicitlyNamed=names.has(normalize(rule.name));
   result.push({spellId:rule.id,spellName:rule.name,casterId:unit.id,
    casterName:unit.name,casterIndex:unit.index,lore:rule.lore,
    castingValue:rule.castingValue,range:rule.range,
    sourceUrl:rule.sourceUrl,knownStatus:explicitlyNamed?
     'imported-spell-name; confirm-cast':'requires-player-confirmation'});
  }
 }
 return result;
}

const available=(army,casterId,spellId)=>
 eligibleWizardSpells(army).some(x=>x.casterId===casterId&&x.spellId===spellId);
const isRegiment=(army,id)=>model(army).regiments.some(u=>u.id===id);
const isCharacter=(army,id)=>model(army).characters.some(u=>u.id===id);

function isTargetAllowed(army,assignments,targetId){
 if(isRegiment(army,targetId))return true;
 if(isCharacter(army,targetId)&&!assignments?.[targetId])return true;
 return false;
}

/** Filter all stored or externally supplied effects before use or persistence. */
export function sanitizeActiveSpells(army,records,assignments={}){
 if(!Array.isArray(records))return [];
 const result=[],seen=new Set(),ids=unitIds(army);
 for(const raw of records){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const {spellId,casterId}=raw;
  const rule=SPELL_RULES[spellId];
  if(!rule||typeof casterId!=='string'||!available(army,casterId,spellId)||
     raw.confirmed!==true)continue;
  const key=spellId+':'+casterId;
  if(seen.has(key))continue;
  const targetId=raw.targetId??null,joinedUnitId=raw.joinedUnitId??null;
  if(rule.targeting==='friendly-unit'){
   if(typeof targetId!=='string'||!(isRegiment(army,targetId)||isCharacter(army,targetId)))continue;
  }else if(targetId!==null)continue;
  if(joinedUnitId!==null&&(!ids.has(joinedUnitId)||!isRegiment(army,joinedUnitId)))continue;
  if(rule.targeting==='friendly-unit'&&joinedUnitId!==null)continue;
  // Retain joined unit at time of casting; if membership changes later, do not retarget.
  result.push({spellId,casterId,targetId,joinedUnitId,confirmed:true});
  seen.add(key);
 }
 return result;
}

function recipients(army,session,effect){
 const ids=new Set();
 const assignments=session?.assignments||{};
 if(effect.spellId==='earthen-ramparts'){
  ids.add(effect.targetId);
  // A spell on a character which later joins a unit may affect that entire
  // unit, and a spell on the unit may affect its joined characters.
  // The player's join is recorded, not legality-verified.
  const parentUnit=isCharacter(army,effect.targetId)?
   (assignments[effect.targetId]||null):effect.targetId;
  if(parentUnit){
   ids.add(parentUnit);
   for(const [characterId,unitId] of Object.entries(assignments)){
    if(unitId===parentUnit)ids.add(characterId);
   }
  }
 }else if(effect.spellId==='glittering-robe'){
  ids.add(effect.casterId);
  if(effect.joinedUnitId&&assignments[effect.casterId]===effect.joinedUnitId){
   ids.add(effect.joinedUnitId);
   for(const [characterId,unitId] of Object.entries(assignments))
    if(unitId===effect.joinedUnitId)ids.add(characterId);
  }
 }
 return ids;
}
const sameRecipient=(a,b)=>[...a].some(x=>b.has(x));

/**
 * Activating a spell is a deliberate PLAYER declaration. A validated lore
 * selection, cast success, valid targeting/range and applicable phase are
 * confirmed by the player, not inferred by this app.
 */
export function activateSpell(army,session,{spellId,casterId,targetId=null,confirmed=false}={}){
 const rule=SPELL_RULES[spellId];
 if(!rule)throw Error('Unsupported spell rule.');
 if(!available(army,casterId,spellId))
  throw Error('That character is not an imported Wizard with the required lore.');
 if(confirmed!==true)
  throw Error('Confirm that this Wizard knows the spell, cast it successfully and met range/phase/target restrictions.');
 const assignments=session?.assignments||{};
 if(rule.targeting==='friendly-unit'){
  if(!isTargetAllowed(army,assignments,targetId))
   throw Error('Select a valid target friendly regiment or independent character.');
 }else if(targetId!==null)
  throw Error('A range Self spell takes no separate target.');
 const effect={
  spellId,casterId,targetId:rule.targeting==='self'?null:targetId,
  joinedUnitId:rule.targeting==='self'?(assignments[casterId]||null):null,
  confirmed:true
 };
 const existing=sanitizeActiveSpells(army,session?.activeSpells,assignments);
 const newRecipients=recipients(army,session,effect);
 const next=existing.filter(old=>{
  if(spellKey(old)===spellKey(effect))return false;
  // Only Glittering Robe has the explicit older-Enchantments-expire clause.
  if(spellId==='glittering-robe'&&
     sameRecipient(newRecipients,recipients(army,session,old)))return false;
  return true;
 });
 next.push(effect);
 return {...session,activeSpells:next};
}
export function endSpell(army,session,spellId,casterId){
 if(!SPELL_RULES[spellId])throw Error('Unsupported spell rule.');
 return {...session,activeSpells:sanitizeActiveSpells(
  army,session?.activeSpells,session?.assignments).filter(e=>!(e.spellId===spellId&&e.casterId===casterId))};
}
/** Player invokes at the correct own Start of Turn; not automatic clock expiry. */
export function expireAtNextStartOfTurn(army,session){
 return {...session,activeSpells:[]};
}
const uniqueBy=(items,key)=>{const seen=new Set();return items.filter(x=>{
 const k=key(x);if(seen.has(k))return false;seen.add(k);return true;
});};

/** Read-only per-imported-instance defensive and incoming-attack projection. */
export function spellEffectsFor(army,session,unitId){
 const ids=unitIds(army);
 if(!ids.has(unitId))throw Error('Unknown imported unit for spell effects.');
 const result={ward:[],attackModifiers:[],movementRestrictions:[],activeEffects:[],warnings:[]};
 const effects=sanitizeActiveSpells(army,session?.activeSpells,session?.assignments);
 const assignments=session?.assignments||{};
 for(const effect of effects){
  const rule=SPELL_RULES[effect.spellId];
  const applies=recipients(army,session,effect).has(unitId);
  if(effect.spellId==='glittering-robe'&&
    effect.joinedUnitId&&assignments[effect.casterId]!==effect.joinedUnitId){
   if(unitId===effect.casterId||unitId===effect.joinedUnitId||
      unitId===assignments[effect.casterId])
    result.warnings.push('Caster membership changed since Glittering Robe was cast; re-evaluate joined-unit coverage. No automatic retargeting.');
  }
  if(!applies)continue;
  const joined=effect.spellId==='earthen-ramparts'
   ?unitId!==effect.targetId
   :unitId!==effect.casterId;
  const scope=joined?'joined unit/model; joining eligibility not verified':
   effect.spellId==='earthen-ramparts'?'target friendly unit':'caster';
  const status=joined?'conditional: joining legality unverified':'player-declared-active';
  const base={name:rule.name,sourceUrl:rule.sourceUrl,scope,status,
   condition:effect.spellId==='earthen-ramparts'?'all wounds':'Enemy To Hit rolls',
   duration:rule.duration,casterId:effect.casterId,spellId:effect.spellId,available:true};
  result.activeEffects.push(base);
  if(effect.spellId==='earthen-ramparts'){
   result.ward.push({...base,saveType:'ward',value:5,label:'5+'});
   const limits=[
    ['cannot-march','Cannot march'],
    ['cannot-charge','Cannot charge'],
    ['defended-obstacle-if-charged','Counts as behind a defended low linear obstacle when charged']
   ];
   for(const [code,detail] of limits)
    result.movementRestrictions.push({...base,code,detail});
  }else if(effect.spellId==='glittering-robe'){
   result.attackModifiers.push({...base,value:-1,label:'-1 To Hit',
    condition:'Enemy To Hit against affected models',scope});
  }
 }
 result.ward=uniqueBy(result.ward,e=>e.spellId+':'+e.value);
 result.attackModifiers=uniqueBy(result.attackModifiers,e=>e.spellId+':'+e.value);
 result.movementRestrictions=uniqueBy(result.movementRestrictions,e=>e.code);
 return result;
}

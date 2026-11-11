/**
 * Source-reviewed, deliberately limited battle tracking for five known spells.
 * A selected/known spell is NEVER automatically cast or made active.
 * All limitations are explicit (range, combat eligibility, joining and timing).
 */
import {createGameScreenModel} from './game-screen-model.js';
import {spellsForWizard} from './player-customization.js';

export const SPELL_RULES=Object.freeze({
 'earthen-ramparts':Object.freeze({
  id:'earthen-ramparts',name:'Earthen Ramparts',lore:'Elementalism',type:'Enchantment',
  castingValue:'9+',range:'15"',duration:'until next Start of Turn',
  sourceUrl:'https://tow.whfb.app/spell/earthen-ramparts',
  targeting:'friendly-unit',lifecycle:'duration',ruleStatus:'verified-rule; player-declared-casting',
  effectSummary:'Until your next Start of Turn, the target friendly unit gains a 5+ Ward save against any wounds suffered and counts as behind a defended low linear obstacle if charged. While this spell is in play, the unit cannot march or charge.'
 }),
 'glittering-robe':Object.freeze({
  id:'glittering-robe',name:'Glittering Robe',lore:'Illusion',type:'Enchantment',
  castingValue:'8+',range:'Self',duration:'until next Start of Turn',
  sourceUrl:'https://tow.whfb.app/spell/glittering-robe',
  targeting:'self',lifecycle:'duration',ruleStatus:'verified-rule; player-declared-casting',
  effectSummary:'Until your next Start of Turn, enemy units suffer -1 To Hit against the caster and any unit they have joined. When cast, any other Enchantments previously cast on the affected models immediately expire.'
 })
 ,
 'plague-of-rust':Object.freeze({
  id:'plague-of-rust',name:'Plague of Rust',lore:'Elementalism',type:'Hex',
  castingValue:'9+',range:'21"',duration:'until next Start of Turn',
  sourceUrl:'https://tow.whfb.app/spell/plague-of-rust',
  targeting:'enemy-unit',lifecycle:'duration',ruleStatus:'verified-rule; player-declared-casting',
  effectSummary:'Target enemy unit suffers -2 to its armour value; may target an enemy engaged in combat.'
 }),
 'travel-mystical-pathway':Object.freeze({
  id:'travel-mystical-pathway',name:'Travel Mystical Pathway',lore:'Elementalism',
  type:'Conveyance',castingValue:'10+',range:'9"',duration:'immediate; current Movement phase',
  sourceUrl:'https://tow.whfb.app/spell/travel-mystical-pathway',
  targeting:'friendly-unit',lifecycle:'instant',ruleStatus:'verified-rule; player-declared-casting',
  effectSummary:'Target friendly unit not fleeing or previously moved may be repositioned within 12" of original location, more than 6" from enemies; cannot move again this Movement phase.'
 }),
 'drain-magic':Object.freeze({
  id:'drain-magic',name:'Drain Magic',lore:'High Magic',type:'Hex',
  castingValue:'9+',range:'Self',duration:'Remains in Play',
  sourceUrl:'https://tow.whfb.app/spell/drain-magic',
  targeting:'self',lifecycle:'remains-in-play',ruleStatus:'verified-rule; player-declared-casting',
  effectSummary:'Enemy Wizards within 24" of the caster have +2 to the casting value when attempting spells.'
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


/** The user's checked spells, not the whole lore: one candidate per instance. */
export function selectedWizardSpells(army,session,magicIndex){
 const characters=model(army).characters;
 const byId=new Map((army?.units||[]).map(u=>[u.id,u]));
 const candidates=[];
 for(const character of characters){
  const unit=byId.get(character.id);
  const allowed=spellsForWizard(unit,magicIndex);
  const sourceById=new Map(allowed.map(s=>[s.id,s]));
  for(const id of session?.knownSpells?.[character.id]||[]){
   const spell=sourceById.get(id);
   if(!spell)continue; // Previously saved off-lore names are not cast candidates.
   const rule=Object.values(SPELL_RULES).find(x=>x.sourceUrl===spell.url)||null;
   candidates.push({casterId:character.id,casterName:character.name,casterIndex:character.index,
    spellId:rule?.id??null,spellName:spell.name,spellUrl:spell.url,rule,
    supported:Boolean(rule)});
  }
 }
 return candidates;
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
  if(!rule||rule.lifecycle==='instant'||typeof casterId!=='string'||!available(army,casterId,spellId)||
     raw.confirmed!==true)continue;
  const key=spellId+':'+casterId;
  if(seen.has(key))continue;
  const targetId=raw.targetId??null,joinedUnitId=raw.joinedUnitId??null;
  if(rule.targeting==='friendly-unit'){
   if(typeof targetId!=='string'||!(isRegiment(army,targetId)||isCharacter(army,targetId)))continue;
  }else if(targetId!==null)continue;
  const enemyName=typeof raw.enemyName==='string'?raw.enemyName.trim():'';
  if(rule.targeting==='enemy-unit'&&(!enemyName||enemyName.length>100))continue;
  if(rule.targeting!=='enemy-unit'&&enemyName)continue;
  if(joinedUnitId!==null&&(!ids.has(joinedUnitId)||!isRegiment(army,joinedUnitId)))continue;
  if(rule.targeting==='friendly-unit'&&joinedUnitId!==null)continue;
  // Retain joined unit at time of casting; if membership changes later, do not retarget.
  result.push({...{spellId,casterId,targetId,joinedUnitId,confirmed:true},
   ...(rule.targeting==='enemy-unit'?{enemyName}:{})});
  seen.add(key);
 }
 return result;
}


export function sanitizeSpellEvents(army,stored){
 if(!Array.isArray(stored))return [];
 const out=[],seen=new Set();
 for(const raw of stored){
  if(raw?.spellId!=='travel-mystical-pathway'||raw.confirmed!==true||
     typeof raw.casterId!=='string'||typeof raw.targetId!=='string'||
     !available(army,raw.casterId,raw.spellId)||
     !(isRegiment(army,raw.targetId)||isCharacter(army,raw.targetId)))continue;
  const key=raw.spellId+':'+raw.casterId+':'+raw.targetId;
  if(seen.has(key))continue;
  seen.add(key);out.push({spellId:raw.spellId,casterId:raw.casterId,
   targetId:raw.targetId,confirmed:true});
 }
 return out.slice(0,50);
}
export function clearSpellEvent(army,session,spellId,casterId,targetId){
 if(spellId!=='travel-mystical-pathway')throw Error('Unknown movement spell event.');
 return {...session,spellEvents:sanitizeSpellEvents(army,session?.spellEvents)
  .filter(e=>!(e.spellId===spellId&&e.casterId===casterId&&e.targetId===targetId))};
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
 }else if(effect.spellId==='drain-magic'){
  ids.add(effect.casterId);
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
export function activateSpell(army,session,{spellId,casterId,targetId=null,enemyName=null,confirmed=false}={}){
 const rule=SPELL_RULES[spellId];
 if(!rule)throw Error('Unsupported spell rule.');
 if(!available(army,casterId,spellId))
  throw Error('That character is not an imported Wizard with the required lore.');
 const known=session?.knownSpells?.[casterId];
 if(Array.isArray(known)&&known.length&&!known.includes('magic-ref:/spell/'+spellId))
  throw Error('This spell is not among the caster’s selected known spells.');
 if(confirmed!==true)
  throw Error('Confirm that this Wizard knows the spell, cast it successfully and met range/phase/target restrictions.');
 const assignments=session?.assignments||{};
 const namedEnemy=typeof enemyName==='string'?enemyName.trim():'';
 if(rule.targeting==='friendly-unit'){
  if(!isTargetAllowed(army,assignments,targetId))
   throw Error('Select a valid target friendly regiment or independent character.');
  if(namedEnemy)throw Error('A friendly-unit spell cannot target an enemy.');
 }else if(rule.targeting==='enemy-unit'){
  if(targetId!==null||!namedEnemy||namedEnemy.length>100)
   throw Error('Enter an enemy unit name (up to 100 characters).');
 }else if(targetId!==null||namedEnemy)
  throw Error('A range Self spell takes no separate target.');
 if(rule.lifecycle==='instant'){
  const record={spellId,casterId,targetId,confirmed:true};
  const existing=sanitizeSpellEvents(army,session?.spellEvents);
  return {...session,spellEvents:[...existing.filter(e=>!(e.spellId===spellId&&e.casterId===casterId)),record]};
 }
 const effect={
  spellId,casterId,targetId:rule.targeting==='friendly-unit'?targetId:null,
  joinedUnitId:rule.targeting==='self'?(assignments[casterId]||null):null,
  ...(rule.targeting==='enemy-unit'?{enemyName:namedEnemy}:{}),
  confirmed:true
 };
 const existing=sanitizeActiveSpells(army,session?.activeSpells,assignments);
 const newRecipients=recipients(army,session,effect);
 const next=existing.filter(old=>{
  if(spellKey(old)===spellKey(effect))return false;
  // Glittering Robe removes older Enchantments on affected models only.
  if(spellId==='glittering-robe'&&SPELL_RULES[old.spellId]?.type==='Enchantment'&&
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
 return {...session,
  activeSpells:sanitizeActiveSpells(army,session?.activeSpells,session?.assignments)
   .filter(e=>SPELL_RULES[e.spellId]?.lifecycle==='remains-in-play'),
  spellEvents:[]};
}
const uniqueBy=(items,key)=>{const seen=new Set();return items.filter(x=>{
 const k=key(x);if(seen.has(k))return false;seen.add(k);return true;
});};

/** Read-only per-imported-instance defensive and incoming-attack projection. */
export function spellEffectsFor(army,session,unitId){
 const ids=unitIds(army);
 if(!ids.has(unitId))throw Error('Unknown imported unit for spell effects.');
 const result={ward:[],attackModifiers:[],movementRestrictions:[],activeEffects:[],movementNotes:[],warnings:[]};
 const effects=sanitizeActiveSpells(army,session?.activeSpells,session?.assignments);
 const assignments=session?.assignments||{};
 for(const note of sanitizeSpellEvents(army,session?.spellEvents)){
  if(note.targetId===unitId)result.movementNotes.push({
   name:'Travel Mystical Pathway',
   detail:'Moved via Travel Mystical Pathway — cannot move again this Movement phase (player-confirmed).',
   sourceUrl:SPELL_RULES['travel-mystical-pathway'].sourceUrl,
   casterId:note.casterId
  });
 }
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
  }else if(effect.spellId==='drain-magic'){
   result.activeEffects[result.activeEffects.length-1].condition=
    'Remains in Play: enemy Wizards within 24" of caster suffer +2 casting value';
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

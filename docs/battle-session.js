/**
 * Player-recorded battle membership, separate from imported roster and rules.
 * Joining is NOT validated against troop type, special rules, phase or formation.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {sanitizeActiveSpells,sanitizeSpellEvents} from './spell-engine.js';
import {sanitizeItemStates,ownedItemEffects} from './effects-engine.js';
import {MAX_UNIT_NAME_LENGTH,wizardDescriptor,isIndexedSpellId,sanitizeKnownSpells,spellsForWizard} from './player-customization.js';

const STATE_VERSION=1;
const validEntries=(army)=>{
 const model=createGameScreenModel(army);
 return {
  characters:new Set(model.characters.map(u=>u.id)),
  regiments:new Set(model.regiments.map(u=>u.id))
 };
};

/** Compact deterministic identifier for the exact original pasted text. */
export function armySessionKey(army){
 const input=army?.originalText;
 if(typeof input!=='string')throw Error('Army import text is unavailable for battle-state storage.');
 let forward=2166136261,reverse=2166136261;
 for(let i=0,j=input.length-1;i<input.length;i++,j--){
  forward=Math.imul(forward^input.charCodeAt(i),16777619);
  reverse=Math.imul(reverse^input.charCodeAt(j),16777619);
 }
 return 'army:'+input.length.toString(16)+':'+(forward>>>0).toString(16).padStart(8,'0')+
  ':'+(reverse>>>0).toString(16).padStart(8,'0');
}

/**
 * Recover only assignments that still refer to a known imported character
 * and a distinct non-character unit in this exact roster.
 */
export function restoreBattleSession(army,stored,unitRecords={}){
 const armyKey=armySessionKey(army);
 const {characters,regiments}=validEntries(army);
 const assignments={};
 const usedCharmedShields={};
 const validShieldOwners=new Set(ownedItemEffects(army,null,unitRecords)
  .filter(item=>item.id==='charmed-shield'&&item.scopeKind==='character')
  .map(item=>item.ownerId));
 if(stored?.schemaVersion===STATE_VERSION&&stored?.armyKey===armyKey&&
    stored.assignments&&typeof stored.assignments==='object'&&!Array.isArray(stored.assignments)){
  for(const [characterId,unitId] of Object.entries(stored.assignments)){
   if(characters.has(characterId)&&regiments.has(unitId))
    assignments[characterId]=unitId;
  }
  if(stored.usedCharmedShields&&typeof stored.usedCharmedShields==='object'&&!Array.isArray(stored.usedCharmedShields)){
   for(const [characterId,used] of Object.entries(stored.usedCharmedShields)){
    if(characters.has(characterId)&&used===true&&validShieldOwners.has(characterId))
     usedCharmedShields[characterId]=true;
   }
  }
 }
 const personal=stored?.schemaVersion===STATE_VERSION&&stored?.armyKey===armyKey?stored:null;
 const unitNames={};
 if(personal?.unitNames&&typeof personal.unitNames==='object'&&!Array.isArray(personal.unitNames)){
  const valid=new Set((army.units||[]).map(u=>u.id));
  for(const [id,name] of Object.entries(personal.unitNames)){
   if(!valid.has(id)||typeof name!=='string')continue;
   const clean=name.trim();
   if(clean&&clean.length<=MAX_UNIT_NAME_LENGTH)unitNames[id]=clean;
  }
 }
 const knownSpells=sanitizeKnownSpells(army,personal?.knownSpells);
 const activeSpells=sanitizeActiveSpells(army,personal?.activeSpells,assignments);
 const spellEvents=sanitizeSpellEvents(army,personal?.spellEvents);
 const itemStates=sanitizeItemStates(army,personal?.itemStates,unitRecords);
 return {schemaVersion:STATE_VERSION,armyKey,assignments,usedCharmedShields,activeSpells,spellEvents,itemStates,unitNames,knownSpells};
}

/**
 * Preserve saved one-use flags while the matching source records are loading.
 * The returned state is for deferred storage/revalidation only. Consumers
 * still require verified selections before projecting an item effect, and
 * restoreBattleSession must be called again once records become available.
 * An explicit player use/reset wins over the older saved flag.
 */
export function preservePendingUseState(army,session,pending,{shieldUse=null,itemUse=null}={}){
 if(!session||!pending||pending.schemaVersion!==STATE_VERSION||
    session.armyKey!==armySessionKey(army)||pending.armyKey!==session.armyKey)return session;
 const {characters}=validEntries(army);
 const owners=new Set((army.units||[]).map(u=>u.id));
 const usedCharmedShields={};
 for(const source of [pending.usedCharmedShields,session.usedCharmedShields]){
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  for(const [id,used] of Object.entries(source)){
   if(characters.has(id)&&used===true)usedCharmedShields[id]=true;
  }
 }
 if(shieldUse&&characters.has(shieldUse.ownerId)){
  if(shieldUse.used===true)usedCharmedShields[shieldUse.ownerId]=true;
  else if(shieldUse.used===false)delete usedCharmedShields[shieldUse.ownerId];
 }
 const itemStates={};
 for(const source of [pending.itemStates,session.itemStates]){
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  for(const [ownerId,items] of Object.entries(source)){
   if(!owners.has(ownerId)||!items||typeof items!=='object'||Array.isArray(items))continue;
   for(const [id,status] of Object.entries(items)){
    if(!/^[a-z0-9-]{1,100}$/.test(id)||!['spent','active'].includes(status))continue;
    (itemStates[ownerId]??={})[id]=status;
   }
  }
 }
 if(itemUse&&owners.has(itemUse.ownerId)&&/^[a-z0-9-]{1,100}$/.test(itemUse.itemId)){
  const items=itemStates[itemUse.ownerId]??={};
  if(itemUse.status==='ready')delete items[itemUse.itemId];
  else if(['active','spent'].includes(itemUse.status))items[itemUse.itemId]=itemUse.status;
  if(!Object.keys(items).length)delete itemStates[itemUse.ownerId];
 }
 return {...session,usedCharmedShields,itemStates};
}

/** Assign or detach one character, returning new state without mutating inputs. */
export function assignCharacter(army,session,characterId,unitId,unitRecords={}){
 const {characters,regiments}=validEntries(army);
 if(!characters.has(characterId))throw Error('Select an imported character first.');
 if(unitId!==null&&!regiments.has(unitId))
  throw Error('Select a valid non-character unit or remove the assignment.');
 const state=restoreBattleSession(army,session,unitRecords);
 if(unitId===null)delete state.assignments[characterId];
 else state.assignments[characterId]=unitId;
 return state;
}

export function charactersForUnit(session,unitId){
 return Object.entries(session?.assignments||{}).filter(([,id])=>id===unitId).map(([id])=>id);
}

/** Player-controlled one-use item flag, persisted separately from the army list. */
export function markCharmedShieldUsed(army,session,characterId,used,unitRecords={}){
 const {characters}=validEntries(army);
 const selected=ownedItemEffects(army,session,unitRecords).some(e=>e.id==='charmed-shield'&&
  e.ownerId===characterId&&e.scopeKind==='character');
 if(!characters.has(characterId)||!selected)
  throw Error('Only a selected Charmed Shield on an imported character can be marked used.');
 if(typeof used!=='boolean')throw Error('Charmed Shield usage must be a boolean.');
 const state=restoreBattleSession(army,session,unitRecords);
 if(used)state.usedCharmedShields[characterId]=true;
 else delete state.usedCharmedShields[characterId];
 return state;
}

/** Optional personal label for any instance; the original imported name is untouched. */
export function setUnitDisplayName(army,session,unitId,name,unitRecords={}){
 if(!(army?.units||[]).some(u=>u.id===unitId))throw Error('Select a valid imported unit.');
 if(name!==null&&typeof name!=='string')throw Error('Unit name must be text.');
 const clean=name===null?'':name.trim();
 if(clean.length>MAX_UNIT_NAME_LENGTH)throw Error('Unit name must be 80 characters or fewer.');
 const state=restoreBattleSession(army,session,unitRecords);
 if(clean)state.unitNames[unitId]=clean;
 else delete state.unitNames[unitId];
 return state;
}
/** User-recorded spell knowledge; the catalogue validates the new selection. */
export function setWizardKnownSpell(army,session,unitId,spellId,known,magicIndex,unitRecords={}){
 const unit=(army?.units||[]).find(u=>u.id===unitId);
 if(!unit||!wizardDescriptor(unit))throw Error('Select an imported wizard.');
 if(typeof known!=='boolean'||!isIndexedSpellId(spellId))
  throw Error('A known spell must be an indexed spell ID and a boolean choice.');
 const state=restoreBattleSession(army,session,unitRecords);
 const list=new Set(state.knownSpells[unitId]||[]);
 const permitted=spellsForWizard(unit,magicIndex).some(s=>s.id===spellId);
 // An older all-spells selection may be removed but never added again without
 // the correct imported-lore evidence; preserve other saved choices intact.
 if(!permitted&&(known||!list.has(spellId)))
  throw Error('This spell is not linked to the imported Wizard lore.');
 if(known)list.add(spellId);else list.delete(spellId);
 if(list.size>150)throw Error('Too many spell records.');
 if(list.size)state.knownSpells[unitId]=[...list];
 else delete state.knownSpells[unitId];
 return state;
}

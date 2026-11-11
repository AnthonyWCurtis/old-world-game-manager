/**
 * Player-recorded battle membership, separate from imported roster and rules.
 * Joining is NOT validated against troop type, special rules, phase or formation.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {sanitizeActiveSpells,sanitizeSpellEvents} from './spell-engine.js';
import {sanitizeItemStates} from './effects-engine.js';
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
export function restoreBattleSession(army,stored){
 const armyKey=armySessionKey(army);
 const {characters,regiments}=validEntries(army);
 const assignments={};
 const usedCharmedShields={};
 if(stored?.schemaVersion===STATE_VERSION&&stored?.armyKey===armyKey&&
    stored.assignments&&typeof stored.assignments==='object'&&!Array.isArray(stored.assignments)){
  for(const [characterId,unitId] of Object.entries(stored.assignments)){
   if(characters.has(characterId)&&regiments.has(unitId))
    assignments[characterId]=unitId;
  }
  if(stored.usedCharmedShields&&typeof stored.usedCharmedShields==='object'&&!Array.isArray(stored.usedCharmedShields)){
   for(const [characterId,used] of Object.entries(stored.usedCharmedShields)){
    const entry=army.units.find(u=>u.id===characterId);
    if(characters.has(characterId)&&used===true&&
       entry?.selections?.some(s=>String(s.name||'').toLowerCase()==='charmed shield'))
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
 const itemStates=sanitizeItemStates(army,personal?.itemStates);
 return {schemaVersion:STATE_VERSION,armyKey,assignments,usedCharmedShields,activeSpells,spellEvents,itemStates,unitNames,knownSpells};
}

/** Assign or detach one character, returning new state without mutating inputs. */
export function assignCharacter(army,session,characterId,unitId){
 const {characters,regiments}=validEntries(army);
 if(!characters.has(characterId))throw Error('Select an imported character first.');
 if(unitId!==null&&!regiments.has(unitId))
  throw Error('Select a valid non-character unit or remove the assignment.');
 const state=restoreBattleSession(army,session);
 if(unitId===null)delete state.assignments[characterId];
 else state.assignments[characterId]=unitId;
 return state;
}

export function charactersForUnit(session,unitId){
 return Object.entries(session?.assignments||{}).filter(([,id])=>id===unitId).map(([id])=>id);
}

/** Player-controlled one-use item flag, persisted separately from the army list. */
export function markCharmedShieldUsed(army,session,characterId,used){
 const {characters}=validEntries(army);
 const entry=army.units.find(u=>u.id===characterId);
 if(!characters.has(characterId)||!entry?.selections?.some(s=>
    String(s.name||'').toLowerCase()==='charmed shield'))
  throw Error('Only a selected Charmed Shield on an imported character can be marked used.');
 if(typeof used!=='boolean')throw Error('Charmed Shield usage must be a boolean.');
 const state=restoreBattleSession(army,session);
 if(used)state.usedCharmedShields[characterId]=true;
 else delete state.usedCharmedShields[characterId];
 return state;
}

/** Optional personal label for any instance; the original imported name is untouched. */
export function setUnitDisplayName(army,session,unitId,name){
 if(!(army?.units||[]).some(u=>u.id===unitId))throw Error('Select a valid imported unit.');
 if(name!==null&&typeof name!=='string')throw Error('Unit name must be text.');
 const clean=name===null?'':name.trim();
 if(clean.length>MAX_UNIT_NAME_LENGTH)throw Error('Unit name must be 80 characters or fewer.');
 const state=restoreBattleSession(army,session);
 if(clean)state.unitNames[unitId]=clean;
 else delete state.unitNames[unitId];
 return state;
}
/** User-recorded spell knowledge; the catalogue validates the new selection. */
export function setWizardKnownSpell(army,session,unitId,spellId,known,magicIndex){
 const unit=(army?.units||[]).find(u=>u.id===unitId);
 if(!unit||!wizardDescriptor(unit))throw Error('Select an imported wizard.');
 if(typeof known!=='boolean'||!isIndexedSpellId(spellId))
  throw Error('A known spell must be an indexed spell ID and a boolean choice.');
 const state=restoreBattleSession(army,session);
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

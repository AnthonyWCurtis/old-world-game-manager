/**
 * Player-recorded battle membership, separate from imported roster and rules.
 * Joining is NOT validated against troop type, special rules, phase or formation.
 */
import {createGameScreenModel} from './game-screen-model.js';
import {sanitizeActiveSpells} from './spell-engine.js';

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
 const activeSpells=sanitizeActiveSpells(army,stored?.schemaVersion===STATE_VERSION&&stored?.armyKey===armyKey?stored.activeSpells:[],assignments);
 return {schemaVersion:STATE_VERSION,armyKey,assignments,usedCharmedShields,activeSpells};
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

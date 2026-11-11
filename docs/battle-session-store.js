/**
 * Separate IndexedDB store for player-recorded game state.
 * Saved imported rosters in `snapshots` are not rewritten by assignments.
 */
const DBNAME='old-world-game-manager-imports';
const VERSION=2;
const SESSION_STORE='battle_sessions';
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){
   reject(Error('Browser local storage unavailable; assignments are only kept in this tab.'));
   return;
  }
  const req=indexedDB.open(DBNAME,2);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('snapshots'))
    db.createObjectStore('snapshots',{keyPath:'id'});
   if(!db.objectStoreNames.contains('battle_sessions'))
    db.createObjectStore('battle_sessions',{keyPath:'armyKey'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Could not open game state storage.'));
  req.onblocked=()=>reject(Error('Another tab is blocking the game state storage upgrade.'));
 });
}
async function transaction(mode,action){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  let result;
  try{
   const tx=db.transaction(SESSION_STORE,mode);
   const req=action(tx.objectStore(SESSION_STORE));
   req.onsuccess=()=>{result=req.result;};
   req.onerror=()=>reject(req.error||Error('Game state operation failed.'));
   tx.oncomplete=()=>{db.close();resolve(result);};
   tx.onerror=()=>{db.close();reject(tx.error||Error('Game state transaction failed.'));};
   tx.onabort=()=>{db.close();reject(tx.error||Error('Game state transaction aborted.'));};
  }catch(error){db.close();reject(error);}
 });
}
export function readBattleSession(armyKey){
 return transaction('readonly',store=>store.get(armyKey));
}
// Keep writes in order when the player taps several assignments rapidly.
let queue=Promise.resolve();
export function writeBattleSession(session){
 const copy={schemaVersion:session.schemaVersion,armyKey:session.armyKey,
  assignments:{...session.assignments},usedCharmedShields:{...(session.usedCharmedShields||{})},activeSpells:(session.activeSpells||[]).map(effect=>({...effect})),savedAt:new Date().toISOString()};
 queue=queue.catch(()=>{}).then(()=>transaction('readwrite',store=>store.put(copy)));
 return queue;
}

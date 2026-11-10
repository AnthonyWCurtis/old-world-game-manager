/**
 * Compact, read-only handoff for the dedicated army roster page.
 *
 * Only copies the already-parsed import, not a second parser or new point
 * calculator. No user identity, raw clipboard text or source rules body.
 */
export const ROSTER_SESSION_KEY='old-world-game-manager:roster-view:v1';
export const IMPORT_RESTORE_KEY='old-world-game-manager:import-return:v1';

const safeNumber=value=>(Number.isFinite(value)&&value>=0?value:null);
const f=value=>value&&typeof value==='object'&&'value' in value?value.value:null;

export function buildRosterSnapshot(army){
 if(!army||!Array.isArray(army.units)||!army.units.length)
  throw Error('Import an army with at least one unit before opening its roster.');
 const sections=new Map((army.sections||[]).map(s=>[s.id,s.name]));
 const units=army.units.map((unit,index)=>{
  const quantity=safeNumber(f(unit.quantity));
  const selections=(unit.selections||[]).map(s=>({
   text:String(s.raw||s.name||''),line:s.line??null
  })).filter(s=>s.text);
  const modelGroups=(unit.modelGroups||[]).map(group=>({
   name:String(group.name||'Model group'),
   quantity:safeNumber(group.quantity),
   text:String(group.raw||''),
   selections:(group.selections||[]).map(s=>String(s.raw||s.name||'')).filter(Boolean)
  }));
  return {
   id:String(unit.id||'unit-index-'+index),
   ordinal:index+1,
   name:String(unit.name||'Unknown unit'),
   nickname:unit.nickname?String(unit.nickname):null,
   sectionId:unit.sectionId??null,
   sectionName:sections.get(unit.sectionId)||'Army units',
   quantity,
   points:safeNumber(f(unit.reportedPoints)),
   reference:unit.reference?.url?{
    id:unit.reference.id||null,
    url:String(unit.reference.url),
    source:unit.reference.source||null
   }:null,
   selections,modelGroups
  };
 });
 return {
  schemaVersion:1,
  kind:'game-manager-army-roster',
  army:{
   name:String(f(army.army?.name)||'Imported army'),
   faction:String(f(army.army?.faction)||'Faction not specified'),
   reportedPoints:safeNumber(f(army.army?.reportedPoints)),
   calculatedPoints:safeNumber(f(army.army?.derivedPoints)),
   pointsLimit:safeNumber(f(army.army?.limitPoints))
  },
  units
 };
}

/** Fail-closed on corrupt or stale session data; keep the import page intact. */
export function validateRosterSnapshot(snapshot){
 if(snapshot?.schemaVersion!==1||snapshot?.kind!=='game-manager-army-roster'||
    !snapshot.army||!Array.isArray(snapshot.units)||!snapshot.units.length||
    snapshot.units.length>1000)throw Error('No valid army roster is available in this tab.');
 const ids=new Set();
 for(const [i,u] of snapshot.units.entries()){
  if(!u||typeof u.id!=='string'||!u.id||ids.has(u.id)||
     u.ordinal!==i+1||typeof u.name!=='string'||!u.name||
     !Array.isArray(u.selections)||!Array.isArray(u.modelGroups)||
     (u.quantity!==null&&safeNumber(u.quantity)===null)||
     (u.points!==null&&safeNumber(u.points)===null))
   throw Error('The imported roster snapshot is incomplete.');
  ids.add(u.id);
 }
 return snapshot;
}

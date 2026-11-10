/**
 * Non-rule descriptors supplied by army-list exporters.
 *
 * "On foot" describes the roster's selected mount state. It is not an item,
 * rule, upgrade, or source link, and does not need a reference match.
 * Keep the literal imported selection and its source line unchanged.
 */
const normalized=value=>String(value||'').normalize('NFKC').toLowerCase()
  .replace(/\s+/g,' ').trim();

export function isInformationalSelection(selection){
 return selection?.kind==='mount-state'&&normalized(selection.name)==='on foot';
}

const walk=items=>(items||[]).flatMap(x=>[x,...walk(x.children||[])]);
export function allArmySelections(army){
 return (army?.units||[]).flatMap(unit=>walk(unit.selections||[]).concat(
  (unit.modelGroups||[]).flatMap(group=>walk(group.selections||[]))
 ));
}

/** Recalculate link status without counting descriptors as unmatched or matched. */
export function recountReferenceStats(army){
 if(!army?.stats||!Array.isArray(army.units))return;
 const selections=allArmySelections(army);
 army.stats.matchedUnits=army.units.filter(u=>u.matchStatus==='matched').length;
 army.stats.unmatchedUnits=army.units.length-army.stats.matchedUnits;
 army.stats.matchedSelections=selections.filter(s=>
  !isInformationalSelection(s)&&s.matchStatus==='matched').length;
 army.stats.unmatchedSelections=selections.filter(s=>
  !isInformationalSelection(s)&&s.matchStatus!=='matched').length;
 army.stats.informationalSelections=selections.filter(isInformationalSelection).length;
}

/**
 * Normalise old saved imports as well as new ones. Do not leave a fabricated
 * tow.whfb.app match or a green linked-reference badge on "On foot".
 */
export function applyInformationalPlaceholders(army){
 if(!army?.units)return {updated:0};
 let updated=0;
 for(const s of allArmySelections(army)){
  if(!isInformationalSelection(s))continue;
  if(s.matchStatus!=='informational'||s.reference!==null)updated++;
  s.matchStatus='informational';
  s.reference=null;
 }
 recountReferenceStats(army);
 return {updated};
}

/** Reference badge state; an identified unit is only fully matched when all options are linked. */
export const hasUnmatchedSelection = selection =>
 selection?.matchStatus !== 'matched' ||
 (selection.children||[]).some(hasUnmatchedSelection);

export const unitHasUnmatched = unit =>
 unit?.matchStatus !== 'matched' ||
 (unit.selections||[]).some(hasUnmatchedSelection) ||
 (unit.modelGroups||[]).some(group=>(group.selections||[]).some(hasUnmatchedSelection));

export function unitMatchState(unit){
 if(unit?.matchStatus !== 'matched')return 'unmatched';
 return unitHasUnmatched(unit)?'partial':'matched';
}
export function selectionMatchState(selection){
 if(selection?.matchStatus !== 'matched')return 'unmatched';
 return hasUnmatchedSelection(selection)?'partial':'matched';
}

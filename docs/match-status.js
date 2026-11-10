/** Reference badge state; descriptive mount-state labels are neither links nor errors. */
import {isInformationalSelection} from './selection-information.js?v=0.4.2';

export const hasUnmatchedSelection = selection =>
 (!isInformationalSelection(selection) && selection?.matchStatus !== 'matched') ||
 (selection?.children||[]).some(hasUnmatchedSelection);

export const unitHasUnmatched = unit =>
 unit?.matchStatus !== 'matched' ||
 (unit.selections||[]).some(hasUnmatchedSelection) ||
 (unit.modelGroups||[]).some(group=>(group.selections||[]).some(hasUnmatchedSelection));

export function unitMatchState(unit){
 if(unit?.matchStatus !== 'matched')return 'unmatched';
 return unitHasUnmatched(unit)?'partial':'matched';
}
export function selectionMatchState(selection){
 if(isInformationalSelection(selection))
  return (selection.children||[]).some(hasUnmatchedSelection)?'partial':'informational';
 if(selection?.matchStatus !== 'matched')return 'unmatched';
 return hasUnmatchedSelection(selection)?'partial':'matched';
}

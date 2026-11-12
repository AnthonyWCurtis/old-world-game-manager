import {sourcePrintedArmour} from './source-printed-armour.js';
/**
 * Candidate mount/chariot source armour from selection references only.
 * This must not infer mount ownership or troop type from a name string.
 */
export function selectedArmourSourceCandidates(unit,fallbackProfiles={}){
 const output=[],seen=new Set();
 const walk=items=>{
  for(const item of Array.isArray(items)?items:[]){
   const url=item?.reference?.url;
   if(typeof url==='string'&&!seen.has(url)){
    const source=sourcePrintedArmour({source:{sourceUrl:url}},fallbackProfiles[url]);
    if(source){seen.add(url);output.push({
     selectionName:String(item.name||item.raw||'Selected option'),
     ...source,associationStatus:'candidate only; mount role and applicability unverified'
    });}
   }
   walk(item?.children);
  }
 };
 walk(unit?.selections);
 for(const model of Array.isArray(unit?.modelGroups)?unit.modelGroups:[])walk(model.selections);
 return output;
}

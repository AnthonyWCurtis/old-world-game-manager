/**
 * Import-first, display-only source profile filter.
 * Source-listed champion alternatives are not members of every imported unit.
 * Preserve mandatory or unknown-status profiles rather than guessing.
 * Never alters source data, quantities, or combat calculations.
 */
const norm=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const selectionsOf=unit=>{
 const result=[];
 const walk=items=>{
  for(const x of Array.isArray(items)?items:[]){
   result.push(norm(x?.name||x?.raw));
   walk(x?.children);
  }
 };
 walk(unit?.selections);
 for(const group of Array.isArray(unit?.modelGroups)?unit.modelGroups:[])walk(group?.selections);
 return result;
};
export function importedSelectionMatchesName(unit,name){
 const needle=norm(name);
 if(!needle)return false;
 return selectionsOf(unit).some(value=>{
  const selected=value.replace(/^\d+\s*(?:x|×)\s*/i,'')
   .replace(/^\d+\s+/,'');
  return selected===needle||selected===needle+'s'||
   selected.startsWith(needle+' (')||selected.startsWith(needle+' [');
 });
}
function isSourceListedOptionalModel(profile,record){
 const name=norm(profile?.name);
 if(!name)return false;
 return (record?.upgradeGroups||[]).some(group=>
  (group?.options||[]).some(option=>{
   const description=norm(option?.description);
   // Match the named result of an upgrade, not a substring: "Crew"
   // must not be mistaken for a separately offered "Master Crew".
   const targetIndex=description.lastIndexOf(' to ');
   if(targetIndex<0||!/\b(?:upgrade|upgraded)\b/.test(description)||
      !/\b(?:model|character|crew|warrior)\b/.test(description))return false;
   const target=description.slice(targetIndex+4).replace(/^(?:an?|the)\s+/,'');
   return target===name||target.startsWith(name+' (')||
    target.startsWith(name+' champion');
  }));
}
export function displayModelProfiles(unit,record,fallback){
 const profiles=Array.isArray(record?.modelProfiles)&&record.modelProfiles.length?
  record.modelProfiles:Array.isArray(fallback?.models)?fallback.models:[];
 return profiles.filter(profile=>!isSourceListedOptionalModel(profile,record)||
  importedSelectionMatchesName(unit,profile.name));
}
/** Only selected optional rules should appear in the on-list reference panel. */
export function selectedPublishedOptionalRules(unit,record){
 return (record?.optionalRules||[]).filter(rule=>
  importedSelectionMatchesName(unit,rule?.name));
}

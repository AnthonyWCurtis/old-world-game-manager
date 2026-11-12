/**
 * Import-first, display-only source profile filter.
 * Source-listed champion alternatives are not members of every imported unit.
 * Preserve mandatory or unknown-status profiles rather than guessing.
 * Never alters source data, quantities, or combat calculations.
 */
const norm=v=>String(v??'').normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const escapeRegex=s=>s.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
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
 const re=new RegExp('^(?:(?:\\d+\\s*(?:x|×)\\s*|\\d+\\s+))?'+escapeRegex(needle)+'(?=$|\\s*[\\[(])','i');
 return selectionsOf(unit).some(value=>re.test(value));
}
function isSourceListedOptionalModel(profile,record){
 const name=norm(profile?.name);
 if(!name)return false;
 return (record?.upgradeGroups||[]).some(group=>
  (group?.options||[]).some(option=>{
   const description=norm(option?.description);
   const nameInSource=new RegExp('(?:^|\\W)'+escapeRegex(name)+'(?:$|\\W)','i').test(description);
   return nameInSource&&/\\b(?:upgrade|champion)\\b/.test(description)&&
    /\\b(?:model|character|crew|warrior)\\b/.test(description);
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

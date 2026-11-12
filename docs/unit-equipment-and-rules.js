/**
 * One import-first unit loadout for the Game Screen.
 * Keeps exact imported options, merges identical published defaults and
 * uses source-page upgrade wording for replacement relationships.
 * Read-only: never edits source records, roster points or combat rules.
 */
import {selectedPublishedOptionalRules} from './imported-unit-display.js';
import {selectedCommandRuleLink} from './selected-command-rule-links.js';

const norm=s=>String(s??'').normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const singular=s=>{
 const v=norm(s);
 // Comparison only: do not alter the label shown to the user.
 return v.endsWith('ies')?v.slice(0,-3)+'y':
  v.endsWith('s')&&!v.endsWith('ss')?v.slice(0,-1):v;
};
const same=(a,b)=>!!norm(a)&&singular(a)===singular(b);
const sourceUrl=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(url);
const refOf=item=>sourceUrl(item?.sourceUrl)?item.sourceUrl:
 sourceUrl(item?.reference?.url)?item.reference.url:null;
const flatSelections=unit=>{
 const result=[];
 function walk(selections,scope=''){
  for(const selection of Array.isArray(selections)?selections:[]){
   result.push({selection,scope});
   walk(selection.children,scope);
  }
 }
 walk(unit?.selections);
 for(const group of Array.isArray(unit?.modelGroups)?unit.modelGroups:[])
  walk(group.selections,(Number.isSafeInteger(group.quantity)?group.quantity+'× ':'')+(group.name||'Model group'));
 return result;
};
const nonInformational=({selection})=>selection?.matchStatus!=='informational'&&
 norm(selection?.name||selection?.raw)!=='on foot';
const selected=unit=>flatSelections(unit).filter(nonInformational);
const selectedReference=(selections,ref)=>selections.some(({selection})=>
 (refOf(ref)&&refOf(selection)===refOf(ref))||same(selection.name||selection.raw,ref.name));

/**
 * Only a published replacement option for the same unit permits dropping a
 * default. Never infer that a newly selected rule replaces another rule.
 */
function sourceReplacements(selections,record){
 const removed=new Set();
 const defaults=[...(record?.startingEquipment||[]),...(record?.startingRules||[])];
 for(const group of record?.upgradeGroups||[]){
  const clause=norm(group?.eligibilityClause);
  for(const option of group?.options||[]){
   const description=norm(option?.description);
   const replaces=/\breplace\b.*\bwith\b/.test(clause+' '+description);
   if(!replaces)continue;
   const references=(option?.linkedReferences||[]).filter(r=>r?.name);
   const old=references.filter(r=>defaults.some(d=>same(d.name,r.name)));
   const added=references.filter(r=>!old.includes(r));
   if(old.length&&added.length&&added.every(r=>selectedReference(selections,r))){
    for(const ref of old)removed.add(singular(ref.name));
    continue;
   }
   // E.g. "May replace light armour with:" + option "Heavy armour"
   // where the original equipment is in the eligibility clause, not links.
   const clauseFrom=clause.match(/\breplace\s+(?:its\s+|their\s+|the\s+)?(.+?)\s+with\b/);
   if(clauseFrom&&references.length&&
      references.every(r=>selectedReference(selections,r))){
    for(const defaultRef of defaults)
     if(same(clauseFrom[1],defaultRef.name))
      removed.add(singular(defaultRef.name));
   }
  }
 }
 return removed;
}
const categoryOf=(sel,matchedRule,matchedGear)=>{
 const url=refOf(sel)||'';
 if(matchedRule||/\/(?:special-rules|unusual-formations)\//.test(url))
  return 'rules';
 if(matchedGear||sel?.kind==='equipment'||sel?.reference?.type==='equipment'||
    /\/(?:weapons-of-war|magic-item|magic-items)\//.test(url))
  return 'equipment';
 return 'upgrades';
};
export function unitEquipmentAndRules(unit,record){
 const imported=selected(unit);
 const eq=Array.isArray(record?.startingEquipment)?record.startingEquipment:[];
 const rules=Array.isArray(record?.startingRules)?record.startingRules:[];
 const optional=selectedPublishedOptionalRules(unit,record);
 const refs=[...eq,...rules,...optional];
 const removed=sourceReplacements(imported,record);
 const groups={equipment:[],rules:[],upgrades:[]};
 const seenDefaults=new Set();
 const sourceVerified=record?.source?.verificationStatus==='source-extracted'&&
  sourceUrl(record?.source?.sourceUrl)&&unit?.reference?.url===record.source.sourceUrl;
 const items=sourceVerified?refs:[];
 for(const {selection,scope} of imported){
  const name=String(selection?.name||selection?.raw||'Imported option').trim();
  const url=refOf(selection);
  const ref=items.find(r=>(url&&url===refOf(r))||same(name,r?.name));
  const matchedRule=!!ref&&(rules.includes(ref)||optional.includes(ref));
  const matchedGear=!!ref&&eq.includes(ref);
  const category=categoryOf(selection,matchedRule,matchedGear);
  const command=category==='upgrades'&&sourceVerified?
   selectedCommandRuleLink(selection,unit,record):null;
  groups[category].push({
   name,sourceUrl:command?.sourceUrl||refOf(ref)||url,
   commandRole:command?.role||null,
   ruleTitle:command?.ruleTitle||null,
   origin:'imported',scope,
   status:selection?.matchStatus||'unmatched'
  });
 }
 if(sourceVerified){
  for(const [category,standard] of [['equipment',eq],['rules',rules]]){
   for(const item of standard){
    if(removed.has(singular(item.name)))continue;
    if(imported.some(({selection})=>same(selection.name||selection.raw,item.name)||
       (refOf(item)&&refOf(selection)===refOf(item))))continue;
    const id=refOf(item)||singular(item.name);
    if(seenDefaults.has(category+':'+id))continue;
    seenDefaults.add(category+':'+id);
    groups[category].push({
     name:item.name,sourceUrl:refOf(item),origin:'published-default',
     scope:'',status:'source-extracted'
    });
   }
  }
  // This can occur when the imported selection has no resolved source link.
  // Only add a selected optional rule if no equivalent imported entry exists.
  for(const rule of optional){
   if(imported.some(({selection})=>same(selection.name||selection.raw,rule.name)||
      (refOf(rule)&&refOf(selection)===refOf(rule))))continue;
   groups.rules.push({
    name:rule.name,sourceUrl:refOf(rule),origin:'selected-source-rule',
    scope:'',status:'conditional'
   });
  }
 }
 return {groups,
  count:Object.values(groups).reduce((n,items)=>n+items.length,0),
  sourceVerified};
}

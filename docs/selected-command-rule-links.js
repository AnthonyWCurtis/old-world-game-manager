/**
 * Universal command-group rules references for selected, source-backed
 * command upgrades. A link explains a rule, never confirms upgrade legality.
 * Champion titles are army-specific, so resolve them only from the unit's
 * own published upgrade option, not a list of hardcoded champion names.
 */
export const COMMAND_RULE_URLS=Object.freeze({
 champion:'https://tow.whfb.app/command-groups/champions',
 standardBearer:'https://tow.whfb.app/command-groups/standard-bearers',
 musician:'https://tow.whfb.app/command-groups/musicians'
});
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const validSource=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+$/.test(url);

/** @returns {null | {role:string,sourceUrl:string,ruleTitle:string}} */
export function selectedCommandRuleLink(selection,unit,record){
 if(!selection||!unit||!validSource(unit?.reference?.url)||
    record?.source?.sourceUrl!==unit.reference.url||
    record.source.verificationStatus!=='source-extracted')return null;
 const selected=normalize(selection?.name||selection?.raw)
  .replace(/\s+\(champion\)$/,'');
 if(!selected)return null;
 const options=(record.upgradeGroups||[]).flatMap(g=>g.options||[]);
 const sourceOption=options.some(o=>{
  const description=normalize(o?.description).replace(/^or:\s*/,'');
  if(selected==='standard bearer')
   return /^upgrade one model to an? standard bearer\b/.test(description);
  if(selected==='musician')
   return /^upgrade one model to an? musician\b/.test(description);
  // e.g. "Upgrade one model to a Sea Master (champion) (+7 points)".
  const match=description.match(/^upgrade one model to an? (.+?) \(champion\)(?:\s|$)/);
  return match&&normalize(match[1])===selected;
 });
 if(!sourceOption)return null;
 if(selected==='standard bearer')
  return {role:'standardBearer',sourceUrl:COMMAND_RULE_URLS.standardBearer,ruleTitle:'Standard Bearers'};
 if(selected==='musician')
  return {role:'musician',sourceUrl:COMMAND_RULE_URLS.musician,ruleTitle:'Musicians'};
 return {role:'champion',sourceUrl:COMMAND_RULE_URLS.champion,ruleTitle:'Champions'};
}

/**
 * Published defensive special-rule references for a unit; read-only.
 * Separates a rule printed as standard from a rule only offered as an option.
 * No save or modifier is applied to any model here.
 */
const SOURCE='https://tow.whfb.app';
const defensive=/^(?:Armoured Hide(?:\s*\([^)]*\))?|Regeneration(?:\s*\([^)]*\))?|Ward Save(?:\s*\([^)]*\))?|Scaly Skin(?:\s*\([^)]*\))?)$/i;
const isSourceUrl=url=>{
 try{const u=new URL(url);return u.origin===SOURCE&&!u.search&&!u.hash&&
  /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(u.pathname);}
 catch{return false;}
};
export function sourceDefensiveRules(record){
 if(!isSourceUrl(record?.source?.sourceUrl))return [];
 const results=[],seen=new Set();
 for(const [key,classification] of [
  ['startingRules','source-listed standard rule'],
  ['optionalRules','source-listed option (not selected automatically)']
 ]){
  for(const item of Array.isArray(record[key])?record[key]:[]){
   const name=String(item?.name||'').trim(),url=item?.sourceUrl;
   if(!defensive.test(name)||!isSourceUrl(url))continue;
   const id=classification+':'+name.toLowerCase()+':'+url;
   if(seen.has(id))continue;
   seen.add(id);
   results.push({name,sourceUrl:url,classification,
    scope:'No armour, Ward or Regeneration value applied; confirm affected models, conditions and selected upgrades'});
  }
 }
 return results;
}
export function sourceArmourCap(record){
 const types=record?.classification?.troopType;
 if(!isSourceUrl(record?.source?.sourceUrl)||!Array.isArray(types))return null;
 // Classification is a unit record, not proof of a character's individual
 // troop type after mounting or an attack-specific saving throw.
 const typeNames=types.map(x=>String(x).toLowerCase());
 const large=typeNames.some(x=>/\b(chariot|monster|war machine|behemoth|monstrous creature)\b/.test(x));
 const small=typeNames.some(x=>/\b(infantry|cavalry)\b/.test(x));
 if(large===small)return null;
 return {cap:large?3:2,sourceUrl:'https://tow.whfb.app/weapons-of-war/maximum-armour-value',
  scope:'Published unit troop-type indication only; mount, rider and model-specific application not established'};
}

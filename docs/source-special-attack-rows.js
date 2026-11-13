/**
 * Narrow source-reviewed special attack display. Read-only: the game does not
 * assume charge, contact, breath-weapon use, rolls or successful wounds.
 * Exact source URL + a source-extracted unit record are mandatory.
 */
const DRAGON_FIRE='https://tow.whfb.app/weapons-of-war/dragon-fire';
const STOMP='https://tow.whfb.app/special-rules/stomp-attacks';
const verified=r=>r?.source?.verificationStatus==='source-extracted'&&
 typeof r.source.sourceUrl==='string'&&r.source.sourceUrl.startsWith('https://tow.whfb.app/unit/');
const sourceItems=(record,key)=>Array.isArray(record?.[key])?record[key]:[];
const strengthOf=record=>{
 const value=record?.modelProfiles?.find(p=>Number.isInteger(p?.characteristics?.S)&&p.characteristics.S>0)?.characteristics?.S;
 return Number.isInteger(value)?String(value):'—';
};
const stompCount=name=>{
 const found=/^Stomp Attacks \((D[36](?:\+[1-9][0-9]?)?|[1-9][0-9]?)\)$/.exec(String(name));
 return found?found[1]:null;
};
export function reviewedSpecialAttackRows(record,mountGroups=[],recordsByUrl={}){
 const sources=[];
 if(verified(record))sources.push(record);
 for(const mount of mountGroups||[]){
  const linked=recordsByUrl?.[mount.sourceUrl];
  if(mount?.mountType&&verified(linked)&&linked.source.sourceUrl===mount.sourceUrl&&
   !sources.some(x=>x.source.sourceUrl===mount.sourceUrl))sources.push(linked);
 }
 const shooting=[],combat=[];
 for(const src of sources){
  for(const equipment of sourceItems(src,'startingEquipment')){
   if(equipment.sourceUrl!==DRAGON_FIRE||String(equipment.name).toLowerCase()!=='dragon fire')continue;
   shooting.push({
    name:'Dragon Fire',sourceUrl:DRAGON_FIRE,owner:src.name,
    stats:[['Range','N/A'],['Hits','Template'],['S','4'],['AP','−1'],['Type','Breath']],
    note:'Source-reviewed Breath Weapon · Flaming Attacks. Eligibility, template coverage and use state are not calculated.'
   });
  }
  for(const rule of sourceItems(src,'startingRules')){
   if(rule.sourceUrl!==STOMP)continue;
   const count=stompCount(rule.name);
   if(!count)continue;
   combat.push({
    name:'Stomp Attacks ('+count+')',sourceUrl:STOMP,owner:src.name,
    stats:[['To Hit','Auto'],['Hits',count],['S',strengthOf(src)],['Timing','Last'],['AP','—']],
    note:'Only an eligible mount/model in base contact. Unmodified Strength; attack-specific AP and dice are unresolved.'
   });
  }
 }
 return {shooting,combat};
}

/**
 * Pure, read-only game-screen projection.
 * Parsed roster choices remain separate from source-extracted base profiles.
 * Never infer an upgrade, characteristic, effect or legality from a source match.
 */
const field=x=>x?.value??null;
const knownCount=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const knownPoints=x=>Number.isFinite(x)?x:null;
const sourceList=x=>Array.isArray(x)?x:[];
const safeSourceUrl=value=>{
 try{
  const u=new URL(value);
  if(u.origin!=='https://tow.whfb.app'||u.search||u.hash)return null;
  return u.href;
 }catch{return null;}
};
const SOURCE_KEYS=['startingEquipment','startingRules','optionalRules','upgradeGroups'];
const publishedFor=record=>{
 const result={};
 for(const key of SOURCE_KEYS)result[key]=sourceList(record?.[key]);
 return result;
};
export function createGameScreenModel(parsedArmy,unitDataRecords={},fallbackProfiles={}){
 const sections=new Map(sourceList(parsedArmy?.sections).map(s=>[s.id,s]));
 const input=sourceList(parsedArmy?.units);
 const units=input.map((unit,index)=>{
  const section=sections.get(unit.sectionId);
  const sectionName=section?.name||'Uncategorised';
  const isCharacter=/\bcharacters?\b/i.test(sectionName);
  const record=unitDataRecords[unit.id];
  const fallback=fallbackProfiles[unit.reference?.url];
  const profiles=record?.modelProfiles?.length?record.modelProfiles:
   sourceList(fallback?.models);
  const warnings=sourceList(record?.extractionWarnings);
  const url=safeSourceUrl(record?.source?.sourceUrl)||
   safeSourceUrl(unit.reference?.url)||safeSourceUrl(fallback?.url);
  const referenceState=record?(warnings.length?'review-needed':'source-extracted'):
   (profiles.length?'cached-base-only':'unavailable');
  return {
   id:unit.id,index:index+1,name:unit.name,nickname:unit.nickname||null,
   section:sectionName,sectionId:unit.sectionId??null,isCharacter,
   count:knownCount(field(unit.quantity)),
   points:knownPoints(field(unit.reportedPoints)),
   selections:sourceList(unit.selections),modelGroups:sourceList(unit.modelGroups),
   profiles,referenceState,referenceUrl:url,
   published:publishedFor(record),extractionWarnings:warnings,
   classification:record?.classification||null,
   hasRulesEffects:false, // Stage 4, never implied from published option names.
   sourceRecord:record||null
  };
 });
 const groups=[];
 const bySection=new Map();
 for(const unit of units){
  const key=unit.sectionId??'uncategorised';
  if(!bySection.has(key)){
   const group={id:key,name:unit.section,units:[]};
   groups.push(group);bySection.set(key,group);
  }
  bySection.get(key).units.push(unit);
 }
 const counted=units.filter(u=>u.count!==null);
 const reported=field(parsedArmy?.army?.reportedPoints);
 const derived=field(parsedArmy?.army?.derivedPoints);
 return {
  army:{name:field(parsedArmy?.army?.name),faction:field(parsedArmy?.army?.faction),
   reportedPoints:knownPoints(reported),derivedPoints:knownPoints(derived)},
  units,groups,
  characters:units.filter(u=>u.isCharacter),
  regiments:units.filter(u=>!u.isCharacter),
  totals:{unitInstances:units.length,knownModelCount:counted.reduce((n,u)=>n+u.count,0),
   unknownModelUnitCount:units.length-counted.length,
   listedPoints:knownPoints(derived)??knownPoints(reported),
   availableProfiles:units.filter(u=>u.profiles.length>0).length}
 };
}

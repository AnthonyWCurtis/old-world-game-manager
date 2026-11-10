/**
 * Build mobile-sized, version-pinned static unit reference data from the separate
 * data-only GitHub branch. Does not fetch or alter the source game web site.
 *
 * Example:
 * node scripts/build-browser-unit-data.mjs --input /tmp/all-armies.json --output docs/unit-data \
 *   --source-commit c9f888b0e4d0cca941c117829644ae9a33966942
 *
 * The original unit source JSON is source-extracted, not rules/legality verified.
 * No options are inferred and none of the army-list parser's data is changed.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

export const SOURCE_COMMIT='c9f888b0e4d0cca941c117829644ae9a33966942';
export const SOURCE_REPO='AnthonyWCurtis/old-world-game-manager';
export const SHARD_COUNT=32;
export const REQUIRED_UNITS=581;
export const REQUIRED_ARMIES=19;
const origin='https://tow.whfb.app';
const idRx=/^unit:[a-z0-9-]+$/;
const sourceRx=/^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+$/;
const slashUrl=s=>String(s||'').replace(/\/$/,'');
export function shardForId(id){
 if(!idRx.test(id))throw Error('Invalid unit id: '+id);
 let h=2166136261;
 for(const character of id){h=Math.imul(h^character.charCodeAt(0),16777619)>>>0;}
 return (h%SHARD_COUNT).toString(16).padStart(2,'0');
}
const compactRef=r=>({
 name:r.name,sourceUrl:r.sourceUrl,
 ...(r.appliesToModel?{appliesToModel:r.appliesToModel}:{})
});
function compactUnit(u){
 const {id,name,nameSingular,source,classification,basePoints,modelProfiles,
   startingEquipment,startingRules,optionalRules,upgradeGroups,listedInArmies,
   extractionWarnings}=u;
 return {
  schemaVersion:'1.1.0',id,name,
  ...(nameSingular?{nameSingular}:{}),
  source:{
   sourceUrl:source.sourceUrl,
   sourceUpdatedAt:source.sourceUpdatedAt||null,
   displayedUpdatedAt:source.displayedUpdatedAt||null,
   publicationCitation:source.publicationCitation||null,
   verificationStatus:'source-extracted'
  },
  classification,basePoints,modelProfiles,
  startingEquipment:(startingEquipment||[]).map(compactRef),
  startingRules:(startingRules||[]).map(compactRef),
  optionalRules:(optionalRules||[]).map(compactRef),
  upgradeGroups:(upgradeGroups||[]).map(g=>({
   id:g.id,eligibilityClause:g.eligibilityClause||null,
   relationship:g.relationship||'not_asserted_mutually_exclusive',
   ...(g.compositionNote?{compositionNote:g.compositionNote}:{}),
   options:(g.options||[]).map(o=>({
    id:o.id,description:o.description,
    points:o.points||null,magicItemPointsCap:o.magicItemPointsCap||null,
    linkedReferences:(o.linkedReferences||[]).map(compactRef),
    status:'source-extracted-unverified',
    ...(o.minModels!=null?{minModels:o.minModels}:{}),
    ...(o.maxModels!=null?{maxModels:o.maxModels}:{})
   }))
  })),
  listedInArmies:(listedInArmies||[]).map(a=>({armyId:a.armyId,name:a.name,
    sourceUrl:a.sourceUrl,status:'source-listed'})),
  extractionWarnings:extractionWarnings||[],
  legalityVerified:false
 };
}
export function buildUnitDataBundle(source,{sourceCommit=SOURCE_COMMIT}={}){
 if(!/^[0-9a-f]{40}$/.test(sourceCommit))throw Error('Source commit must be a pinned SHA');
 if(source?.schemaVersion!=='1.1.0' ||
    source?.coverage?.sourceUnitCount!==REQUIRED_UNITS ||
    source?.coverage?.sourceArmyCount!==REQUIRED_ARMIES ||
    source?.coverage?.failedPages!==0 ||
    !Array.isArray(source.units)||source.units.length!==REQUIRED_UNITS||
    !Array.isArray(source.armies)||source.armies.length!==REQUIRED_ARMIES)
  throw Error('Missing or incomplete source data snapshot');
 const urls=new Set(),ids=new Set(),names=new Map();
 const shards=Object.fromEntries(Array.from({length:SHARD_COUNT},(_,i)=>[
  i.toString(16).padStart(2,'0'),{}
 ]));
 const index=[];
 for(const original of source.units){
  const u=compactUnit(original);
  if(!idRx.test(u.id)||!sourceRx.test(u.source.sourceUrl)||
     u.id!=='unit:'+new URL(u.source.sourceUrl).pathname.split('/')[2])
   throw Error('Invalid source-linked unit id '+u.id);
  if(ids.has(u.id)||urls.has(u.source.sourceUrl))throw Error('Duplicate unit id or URL: '+u.id);
  if(!Array.isArray(u.modelProfiles)||!u.modelProfiles.length||
     !u.name||u.source.verificationStatus!=='source-extracted')
   throw Error('Incomplete unit profiles: '+u.id);
  ids.add(u.id);urls.add(u.source.sourceUrl);
  const key=u.name.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
  names.set(key,(names.get(key)||0)+1);
  const shard=shardForId(u.id);
  shards[shard][u.id]=u;
  index.push({
   id:u.id,name:u.name,sourceUrl:u.source.sourceUrl,shard,
   hasWarnings:u.extractionWarnings.length>0,
   listedInArmies:u.listedInArmies.map(a=>a.armyId)
  });
 }
 index.sort((a,b)=>a.id.localeCompare(b.id));
 for(const army of source.armies){
  if(!/^army:[a-z0-9-]+$/.test(army.id)||
     !/^https:\/\/tow\.whfb\.app\/army\/[a-z0-9-]+$/.test(slashUrl(army.source?.sourceUrl)))
   throw Error('Invalid army entry: '+army.id);
 }
 const manifest={
  schemaVersion:1,kind:'game-manager-unit-data',
  source:{
   origin,repository:SOURCE_REPO,commit:sourceCommit,
   checkedAt:source.source.checkedAt,
   verificationStatus:'source-extracted'
  },
  counts:{
   units:index.length,armies:source.armies.length,
   unitsWithWarnings:index.filter(u=>u.hasWarnings).length
  },
  shards:SHARD_COUNT,entries:index
 };
 const armies={
  schemaVersion:1,sourceCommit,sourceUrl:source.source.sitemapUrl,
  armies:source.armies.map(a=>({id:a.id,name:a.name,sourceUrl:a.source.sourceUrl,
   unitIds:a.listedUnits.map(u=>u.unitId),verificationStatus:'source-extracted'}))
 };
 // Prevent a guessed source item from silently becoming a trusted reference.
 const sg=shards[shardForId('unit:lothern-sea-guard')]['unit:lothern-sea-guard'];
 if(!sg || sg.modelProfiles.length!==2 || sg.startingEquipment.length!==4 ||
    sg.startingRules.length!==5 || sg.upgradeGroups.length!==3 ||
    sg.upgradeGroups.flatMap(g=>g.options).length!==7 ||
    sg.upgradeGroups[2].eligibilityClause!=='0-1 unit per 1,000 points may:')
  throw Error('Lothern Sea Guard source snapshot regression');
 return {manifest,armies,shards};
}
export async function publishUnitData(input,output,{sourceCommit=SOURCE_COMMIT}={}){
 const source=JSON.parse(await readFile(input,'utf8'));
 const result=buildUnitDataBundle(source,{sourceCommit});
 await mkdir(join(output,'shards'),{recursive:true});
 await writeFile(join(output,'index.json'),JSON.stringify(result.manifest)+'\n');
 await writeFile(join(output,'armies.json'),JSON.stringify(result.armies)+'\n');
 for(const [shard,records] of Object.entries(result.shards)){
  await writeFile(join(output,'shards',shard+'.json'),
   JSON.stringify({schemaVersion:1,sourceCommit,shard,records})+'\n');
 }
 console.log('Published',result.manifest.counts.units,'units,',
  result.manifest.counts.armies,'armies,',
  Object.keys(result.shards).length,'shards; pinned source commit',sourceCommit);
 return result;
}
if(import.meta.url==='file://'+process.argv[1]){
 const args=process.argv.slice(2);
 const get=(flag,defaultValue)=>args.includes(flag)?(args[args.indexOf(flag)+1]||defaultValue):defaultValue;
 if(!args.includes('--input')||!args.includes('--output')){
  console.error('Usage: node scripts/build-browser-unit-data.mjs --input SOURCE.json --output docs/unit-data');
  process.exitCode=2;
 }else{
  publishUnitData(get('--input'),get('--output'),{
   sourceCommit:get('--source-commit',SOURCE_COMMIT)
  }).catch(e=>{console.error(e);process.exitCode=1;});
 }
}

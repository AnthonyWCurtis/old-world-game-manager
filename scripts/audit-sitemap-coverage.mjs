/**
 * Read-only sitemap -> catalogue -> shard coverage audit.
 * Uses committed, provenance-linked snapshots. It does not infer rules or
 * legality, and does not contact tow.whfb.app at runtime.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditReferenceCollections} from './audit-reference-collections.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const canonical=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const unique=xs=>new Set(xs).size===xs.length;
const issue=(code,kind,entry,detail)=>({
 code,kind,id:entry?.id||null,name:entry?.name||null,
 sourceUrl:entry?.url||entry?.sourceUrl||null,detail
});
const validSource=(url,type)=>{
 try { const u=new URL(url);return u.origin==='https://tow.whfb.app'&&!u.search&&!u.hash&&
  new RegExp('^/'+type+'/[a-z0-9-]+$').test(u.pathname); }
 catch{return false;}
};

export function auditCoverage(sitemap,catalogue,shards){
 const errors=[],warnings=[],counts={sitemapArmies:0,sitemapUnits:0,catalogueUnits:0,
  shardUnits:0,unitWarnings:0,unassignedArmyUnits:0};
 const sitemapEntries=Array.isArray(sitemap?.entries)?sitemap.entries:[];
 const catalogueEntries=Array.isArray(catalogue?.entries)?catalogue.entries:[];
 const armyEntries=sitemapEntries.filter(e=>e.kind==='army');
 const unitEntries=sitemapEntries.filter(e=>e.kind==='unit');
 counts.sitemapArmies=armyEntries.length;counts.sitemapUnits=unitEntries.length;
 counts.catalogueUnits=catalogueEntries.length;
 const checked=(condition,code,kind,entry,detail)=>{if(!condition)errors.push(issue(code,kind,entry,detail));};
 checked(sitemap?.source?.url==='https://tow.whfb.app/sitemap/armies','SOURCE_MISMATCH','index',null,'Unknown sitemap provenance');
 checked(unique(sitemapEntries.map(e=>e.url)),'DUPLICATE_SITEMAP_URL','index',null,'Repeated sitemap URLs');
 checked(unique(catalogueEntries.map(e=>e.sourceUrl)),'DUPLICATE_CATALOGUE_URL','index',null,'Repeated catalogue URLs');
 checked(unitEntries.length===sitemap?.counts?.units,'SITEMAP_UNIT_COUNT','index',null,'Declared unit count differs from entries');
 checked(armyEntries.length===sitemap?.counts?.armies,'SITEMAP_ARMY_COUNT','index',null,'Declared army count differs from entries');
 checked(catalogueEntries.length===catalogue?.counts?.units,'CATALOGUE_UNIT_COUNT','index',null,'Declared catalogue count differs from entries');
 const armyIds=new Set(armyEntries.map(e=>'army:'+new URL(e.url).pathname.split('/')[2]));
 const byCatalogue=new Map(catalogueEntries.map(e=>[e.sourceUrl,e]));
 const bySitemap=new Map(unitEntries.map(e=>[e.url,e]));
 const records=new Map();
 for(const [shardId,payload] of Object.entries(shards||{})){
  const shard=payload?.records;
  if(!shard||typeof shard!=='object'||Array.isArray(shard)){
   errors.push(issue('INVALID_SHARD','shard',null,'Invalid shard '+shardId));continue;
  }
  for(const [id,record] of Object.entries(shard)){
   if(records.has(id))errors.push(issue('DUPLICATE_SHARD_UNIT','unit',record,'Duplicate unit id '+id));
   records.set(id,record);
   if(record?.id!==id)errors.push(issue('SHARD_ID_MISMATCH','unit',record,'Key differs from record id'));
  }
 }
 counts.shardUnits=records.size;
 for(const army of armyEntries)checked(validSource(army.url,'army'),'INVALID_ARMY_SOURCE','army',army,'Invalid source URL');
 for(const entry of unitEntries){
  checked(validSource(entry.url,'unit'),'INVALID_UNIT_SOURCE','unit',entry,'Invalid source URL');
  const c=byCatalogue.get(entry.url);
  if(!c){errors.push(issue('MISSING_CATALOGUE_UNIT','unit',entry,'Unit absent from browser catalogue'));continue;}
  checked(c.id==='unit:'+new URL(entry.url).pathname.split('/')[2],'CATALOGUE_ID_MISMATCH','unit',entry,'Incorrect unit id');
  if(canonical(entry.name)!==canonical(c.name))
   warnings.push(issue('NAME_DIFFERENCE','unit',entry,'Sitemap: '+entry.name+'; catalogue: '+c.name));
  const record=records.get(c.id);
  if(!record){errors.push(issue('MISSING_SHARD_RECORD','unit',entry,'No full unit record in shard '+c.shard));continue;}
  checked(record?.source?.sourceUrl===entry.url,'SHARD_SOURCE_MISMATCH','unit',entry,'Full record source URL mismatch');
  checked(Array.isArray(record?.modelProfiles)&&record.modelProfiles.length>0,'NO_MODEL_PROFILES','unit',entry,'No extracted model profiles');
  checked(record?.source?.verificationStatus==='source-extracted','UNVERIFIED_EXTRACTION','unit',entry,'Source extraction not established');
  if(c.hasWarnings||record?.extractionWarnings?.length){
   counts.unitWarnings++;
   warnings.push(issue('EXTRACTION_WARNINGS','unit',entry,JSON.stringify(record?.extractionWarnings||[]).slice(0,1200)));
  }
  const memberships=record?.listedInArmies||[];
  if(!memberships.length){counts.unassignedArmyUnits++;warnings.push(issue('NO_ARMY_MEMBERSHIP','unit',entry,'No source-listed army association (may be valid)'));}
  for(const membership of memberships){
   if(!armyIds.has(membership.armyId))warnings.push(issue('UNKNOWN_ARMY_MEMBERSHIP','unit',entry,'Source association not found in armies sitemap: '+membership.armyId));
  }
 }
 for(const c of catalogueEntries){
  if(!bySitemap.has(c.sourceUrl))errors.push(issue('EXTRA_CATALOGUE_UNIT','unit',c,'Catalogue URL not in sitemap'));
  if(!records.has(c.id))errors.push(issue('CATALOGUE_RECORD_MISSING','unit',c,'Catalogue points to nonexistent record'));
 }
 for(const [id,record] of records){
  if(!catalogueEntries.some(e=>e.id===id))errors.push(issue('ORPHAN_SHARD_RECORD','unit',record,'Full record not in catalogue'));
 }
 checked(records.size===catalogueEntries.length,'SHARD_UNIT_COUNT','index',null,'Full record count differs from catalogue');
 return {schemaVersion:1,source:'https://tow.whfb.app/sitemap/armies',
  sourceSnapshotCheckedAt:sitemap?.source?.checkedAt||null,
  catalogueSourceCommit:catalogue?.source?.commit||null,
  counts:{...counts,errors:errors.length,warnings:warnings.length},
  status:errors.length?'fail':'pass-with-warnings',errors,warnings,
  scope:'Reference coverage and snapshot integrity only; no army legality, point validation or exporter-format completeness asserted.'};
}
export async function runAudit({root=ROOT,output=join(ROOT,'coverage-report.json')}={}){
 const load=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
 const sitemap=await load('docs/reference-records/armies-index.json');
 const catalogue=await load('docs/unit-data/index.json');
 const shards={};
 for(let i=0;i<catalogue.shards;i++){
  const id=i.toString(16).padStart(2,'0');
  shards[id]=await load('docs/unit-data/shards/'+id+'.json');
 }
 const result=auditCoverage(sitemap,catalogue,shards);
 const referenceCollections=auditReferenceCollections({
  rules:await load('docs/reference-records/rules-index.json'),
  magic:await load('docs/reference-records/magic-index.json'),
  'magic-items':await load('docs/reference-records/magic-items-index.json')
 });
 result.collections={armies:{entries:sitemap.entries.length,sourceSnapshotCheckedAt:sitemap.source?.checkedAt},...referenceCollections.summaries};
 result.overlappingReferenceUrls=referenceCollections.sharedUrls;
 result.errors.push(...referenceCollections.errors.map(e=>({...e,kind:e.collection})));
 result.warnings.push(...referenceCollections.warnings.map(e=>({...e,kind:e.collection})));
 result.counts.errors=result.errors.length;
 result.counts.warnings=result.warnings.length;
 result.counts.indexedReferences=Object.values(result.collections).reduce((n,c)=>n+c.entries,0);
 result.status=result.errors.length?'fail':result.warnings.length?'pass-with-warnings':'pass';
 result.scope+=' Additional collections are checked for sitemap-index integrity only, not source-page extraction.';
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log('Sitemap units: '+result.counts.sitemapUnits+
  ' | catalogue: '+result.counts.catalogueUnits+' | shards: '+result.counts.shardUnits);
 console.log('All four sitemap collections: '+result.counts.indexedReferences+' indexed references (may overlap)');
 console.log('Errors: '+result.counts.errors+' | warnings: '+result.counts.warnings+
  ' | affected extraction records: '+result.counts.unitWarnings);
 console.log('Report: '+output);
 if(result.errors.length)for(const error of result.errors.slice(0,25))
  console.error(error.code+': '+(error.sourceUrl||error.detail));
 return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]))){
 const output=process.argv[2]?join(process.cwd(),process.argv[2]):join(ROOT,'coverage-report.json');
 runAudit({output}).then(r=>{if(r.errors.length)process.exitCode=1;})
 .catch(e=>{console.error(e);process.exitCode=1;});
}

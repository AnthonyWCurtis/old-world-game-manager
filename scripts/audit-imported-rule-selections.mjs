/**
 * Offline import-fixture coverage. Counts references carried by real parser
 * output and source-extracted starting rules, never optional candidates.
 * Canonical status is a register claim, not confirmation a condition is active.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {parseArmy} from '../docs/parser.js';
import {applyUnitDataReferences,findIndexedUnit} from '../docs/unit-data.js';
import {applyIndexedReferences,applyProfileReferences} from '../docs/live-source.js';
import {applySourceScopedSelectionReferences} from '../docs/unit-selection-matcher.js';
import {applyGenericWizardReferences} from '../docs/wizard-references.js';
import {applyInformationalPlaceholders,isInformationalSelection} from '../docs/selection-information.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const complete=new Set(['Fully Implemented','Fully Implemented and Tested']);
function validSource(url){
 try{
  const u=new URL(url);
  return u.origin==='https://tow.whfb.app'&&!u.search&&!u.hash&&/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(u.pathname);
 }catch{return false;}
}
function sourceKey(url){return validSource(url)?url.replace(/\/$/,''):null;}
const sortedObject=object=>Object.fromEntries(Object.entries(object).sort(([a],[b])=>a.localeCompare(b,'en')));
const percentage=(n,d)=>d?Math.round(n/d*10000)/100:null;

/** Pure inspection of an already enriched import. No army or source mutations. */
export function auditImportedArmy({army,index,records,entries,file}){
 const byUrl=new Map(entries.filter(entry=>sourceKey(entry.sourceUrl)!==null)
  .map(entry=>[sourceKey(entry.sourceUrl),entry]));
 const occurrences=[],unitInstances=[];
 const totals={unitInstances:0,verifiedUnitRecords:0,unmatchedUnits:0,unverifiedUnitRecords:0,
  startingRuleOccurrences:0,startingEquipmentOccurrences:0,explicitSelections:0,
  informationalSelections:0,linkedSelections:0,unlinkedSelections:0,invalidSourceSelections:0,
  missingRegisterEntries:0,fullyImplementedOccurrences:0};
 function add({name,sourceUrl,kind,unitId,importPath,sourceRecordPath=null}){
  const key=sourceKey(sourceUrl);
  const canonical=key===null?undefined:byUrl.get(key);
  const status=!sourceUrl?'Unresolved':!validSource(sourceUrl)?'Unresolved':canonical?.status||'Missing';
  if(sourceUrl&&validSource(sourceUrl)&&!canonical)totals.missingRegisterEntries++;
  if(complete.has(status))totals.fullyImplementedOccurrences++;
  occurrences.push({name,kind,unitId,importPath,sourceRecordPath,sourceUrl:sourceUrl||null,
   canonicalId:canonical?.id||null,status,conditionEvaluation:'not evaluated; recorded source/reference occurrence only'});
 }
 for(const [unitNumber,unit] of (army?.units||[]).entries()){
  totals.unitInstances++;
  const path='/units/'+unitNumber,entry=findIndexedUnit(unit,index),record=records?.[unit.id];
  const verified=!!entry&&record?.id===entry.id&&record.source?.sourceUrl===entry.sourceUrl&&
   unit.reference?.url===entry.sourceUrl&&record.source?.verificationStatus==='source-extracted';
  if(verified)totals.verifiedUnitRecords++;
  else if(!entry)totals.unmatchedUnits++;
  else totals.unverifiedUnitRecords++;
  unitInstances.push({unitId:unit.id,name:unit.name,importPath:path,sourceUrl:unit.reference?.url||null,
   sourceUnitId:entry?.id||null,recordStatus:verified?'source-extracted':'Unresolved',
   problem:verified?null:!entry?'No unique indexed unit match':'Missing, unverified or conflicting unit source record'});
  if(verified){
   for(const [field,kind,total] of [['startingRules','starting-rule','startingRuleOccurrences'],['startingEquipment','starting-equipment','startingEquipmentOccurrences']]){
    for(const [refNumber,ref] of (record[field]||[]).entries()){
     totals[total]++;
     add({...ref,kind,unitId:unit.id,importPath:path,
      sourceRecordPath:'docs/unit-data/shards/'+entry.shard+'.json#/records/'+record.id+'/'+field+'/'+refNumber});
    }
   }
  }
  function walk(selections,parent){
   for(const [number,selection] of (selections||[]).entries()){
    const selectionPath=parent+'/'+number;totals.explicitSelections++;
    if(isInformationalSelection(selection))totals.informationalSelections++;
    else{
     const url=selection.reference?.url;
     if(!url)totals.unlinkedSelections++;
     else if(!validSource(url))totals.invalidSourceSelections++;
     else totals.linkedSelections++;
     add({name:selection.name,sourceUrl:url,kind:'explicit-selection',unitId:unit.id,importPath:selectionPath});
    }
    walk(selection.children,selectionPath+'/children');
   }
  }
  walk(unit.selections,path+'/selections');
  for(const [groupNumber,group] of (unit.modelGroups||[]).entries())
   walk(group.selections,path+'/modelGroups/'+groupNumber+'/selections');
 }
 const statusCounts={};for(const occurrence of occurrences)statusCounts[occurrence.status]=(statusCounts[occurrence.status]||0)+1;
 const denominator=totals.explicitSelections-totals.informationalSelections;
 return {file,totals,statusCounts:sortedObject(statusCounts),
  explicitSelectionCoverage:{numerator:totals.linkedSelections,denominator:denominator||null,
   percentage:percentage(totals.linkedSelections,denominator),meaning:'Source URL linking only; no implementation or legality claim'},
  unitInstances,occurrences};
}

/** Run the shipped parser/reference matchers on every checked-in example. */
export function buildImportedSelectionCoverage({root=ROOT,entries}){
 const base=root instanceof URL?fileURLToPath(root):resolve(root);
 const load=relative=>JSON.parse(readFileSync(join(base,relative),'utf8'));
 const index=load('docs/unit-data/index.json');
 const profiles=load('docs/source-profiles.json').profiles;
 const referenceEntries=['rules','armies','magic','magic-items'].flatMap(name=>load('docs/reference-records/'+name+'-index.json').entries);
 const shards={};for(const entry of index.entries)shards[entry.shard]??=load('docs/unit-data/shards/'+entry.shard+'.json');
 const files=readdirSync(join(base,'docs/examples')).filter(file=>file.endsWith('.txt')).sort();
 const perFixture=files.map(file=>{
  const army=parseArmy(readFileSync(join(base,'docs/examples',file),'utf8'));
  applyInformationalPlaceholders(army);applyGenericWizardReferences(army);
  applyUnitDataReferences(army,index);applyIndexedReferences(army,referenceEntries);applyProfileReferences(army,profiles);
  const records={};for(const unit of army.units){
   const entry=findIndexedUnit(unit,index);if(entry)records[unit.id]=shards[entry.shard]?.records?.[entry.id];
  }
  applySourceScopedSelectionReferences(army,records);
  return auditImportedArmy({army,index,records,entries,file:'docs/examples/'+file});
 });
 const totals={},statusCounts={};for(const fixture of perFixture){
  for(const [key,value] of Object.entries(fixture.totals))totals[key]=(totals[key]||0)+value;
  for(const [key,value] of Object.entries(fixture.statusCounts))statusCounts[key]=(statusCounts[key]||0)+value;
 }
 return {schemaVersion:1,
  scope:'Committed docs/examples/*.txt imported through existing parser and offline matchers; repeated exports and formats count separately, not unique player armies.',
  limitations:['Known-spell choices and battle-state conditions are unavailable in export fixtures.',
   'Geometry, joining legality, model eligibility and whether conditional effects are active are not inferred.',
   'Starting and explicit-selection references are occurrence metrics and may refer to the same canonical rule.',
   'Source-linked optional upgrade candidates are excluded unless explicitly imported as a selection.',
   'No complete army rules denominator: source extraction warnings, unmatched selections and unlinked interactions remain.'],
  completeArmyRulesPercentage:null,fixtureCount:perFixture.length,
  totals:sortedObject(totals),statusCounts:sortedObject(statusCounts),perFixture};
}

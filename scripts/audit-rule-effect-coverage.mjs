/**
 * Read-only, offline audit of the shipped tow.whfb.app source snapshot.
 *
 * "Source-indexed" means a title/URL is catalogued; "source-extracted"
 * means a published unit record was captured. Neither means its effects
 * are implemented, equipped, legal, or active in a battle.
 *
 * Usage: node scripts/audit-rule-effect-coverage.mjs [--json]
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {REVIEWED_CHARACTER_RULES,REVIEWED_CONTAGIOUS_RULES} from '../docs/source-special-rule-effects.js';
import {ITEM_EFFECT_RULES} from '../docs/effects-engine.js';
import {reviewedCoreRule,REVIEWED_CORE_RULES} from '../docs/source-core-rule-effects.js';

const ORIGIN='https://tow.whfb.app';
const RULE_URL=/^https:\/\/tow\.whfb\.app\/special-rules\/[a-z0-9-]+\/?$/;
const readJson=relative=>JSON.parse(readFileSync(new URL(relative,import.meta.url),'utf8'));
const validRule=ref=>ref&&typeof ref.name==='string'&&ref.name.trim()&&
 typeof ref.sourceUrl==='string'&&RULE_URL.test(ref.sourceUrl);
const characterCategory=record=>(record?.classification?.unitCategory||[]).includes('Character');
const characterRules=Object.values(REVIEWED_CHARACTER_RULES);
const contagiousRules=Object.values(REVIEWED_CONTAGIOUS_RULES);
const reviewedItems=Object.values(ITEM_EFFECT_RULES);

function reviewedStartingRule(record,ref){
 const match=(rule)=>rule.name===ref.name&&rule.sourceUrl===ref.sourceUrl;
 return characterRules.some(rule=>record.source.sourceUrl===rule.sourceOwnerUrl&&match(rule))||
  (characterCategory(record)&&contagiousRules.some(match));
}
const compare=(a,b)=>b.startingOccurrences-a.startingOccurrences||
 a.name.localeCompare(b.name)||a.sourceUrl.localeCompare(b.sourceUrl);

/**
 * Pure data inspection; may be used with small synthetic snapshots in tests.
 * No source data, imported roster or battle state is changed.
 */
export function buildRuleEffectCoverage({index,shards,magicIndex}){
 if(index?.schemaVersion!==1||!Array.isArray(index.entries)||
    magicIndex?.schemaVersion!==1||!Array.isArray(magicIndex.entries))
  throw Error('Unexpected source index format');
 const rules=new Map(),problems=[];
 let verifiedUnitRecords=0,missingUnitRecords=0,unverifiedUnitRecords=0,
  warningUnitRecords=0,startingSpecialRuleOccurrences=0,
  reviewedStartingOccurrences=0,manualStartingOccurrences=0,optionalSpecialRuleOccurrences=0,
  otherStartingReferenceOccurrences=0;
 const mark=(ref,field,unit)=>{
  let x=rules.get(ref.sourceUrl);
  if(!x){
   x={name:ref.name,sourceUrl:ref.sourceUrl,startingOccurrences:0,
    reviewedStartingOccurrences:0,manualStartingOccurrences:0,referenceOnlyStartingOccurrences:0,
    optionalOccurrences:0,examples:[]};
   rules.set(ref.sourceUrl,x);
  }
  x[field]++;
  if(field!=='optionalOccurrences')x.startingOccurrences++;
  if(x.examples.length<3&&!x.examples.includes(unit.name))
   x.examples.push(unit.name);
 };
 const seenIds=new Set();
 for(const entry of index.entries){
  if(seenIds.has(entry.id))throw Error('Duplicate unit index ID: '+entry.id);
  seenIds.add(entry.id);
  const record=shards?.[entry.shard]?.records?.[entry.id];
  if(!record){
   missingUnitRecords++;problems.push({unitId:entry.id,problem:'missing-record'});continue;
  }
  if(record.id!==entry.id||record.source?.sourceUrl!==entry.sourceUrl||
      record.source?.verificationStatus!=='source-extracted'){
   unverifiedUnitRecords++;
   problems.push({unitId:entry.id,problem:'unverified-or-mismatched-record'});continue;
  }
  verifiedUnitRecords++;
  if(record.extractionWarnings?.length)warningUnitRecords++;
  for(const ref of record.startingRules||[]){
   if(!validRule(ref)){otherStartingReferenceOccurrences++;continue;}
   startingSpecialRuleOccurrences++;
   const reviewed=reviewedStartingRule(record,ref);
   if(reviewed)reviewedStartingOccurrences++;
   const manual=!reviewed&&!!reviewedCoreRule(ref);
   if(manual)manualStartingOccurrences++;
   mark(ref,reviewed?'reviewedStartingOccurrences':manual?'manualStartingOccurrences':'referenceOnlyStartingOccurrences',record);
  }
  // Optional rule references are not necessarily selected by a player.
  for(const ref of record.optionalRules||[]){
   if(!validRule(ref))continue;
   optionalSpecialRuleOccurrences++;mark(ref,'optionalOccurrences',record);
  }
 }
 const sorted=[...rules.values()].map(r=>({
  ...r,reviewStatus:[r.reviewedStartingOccurrences,r.manualStartingOccurrences,r.referenceOnlyStartingOccurrences].filter(Boolean).length>1?
   'mixed-by-owner-and-scope':r.reviewedStartingOccurrences?'reviewed-conditional':
   r.manualStartingOccurrences?'reviewed-manual':'source-reference-only'
 })).sort(compare);
 const catalogue=magicIndex.entries.filter(e=>e.kind==='item-or-ability');
 const catalogueUrls=new Set(catalogue.map(e=>e.url));
 const supportedUrls=new Set(reviewedItems.map(item=>item.sourceUrl));
 const reviewedCatalogueMatches=[...supportedUrls].filter(u=>catalogueUrls.has(u)).length;
 return {
  schemaVersion:1,
  provenance:{
   origin:ORIGIN,unitSourceCommit:index.source?.commit||null,
   unitsCheckedAt:index.source?.checkedAt||null,
   magicCatalogueCheckedAt:magicIndex.source?.checkedAt||null,
   policy:'Source-indexed pages are references, not verified effect implementations.'
  },
  counts:{
   indexedUnits:index.entries.length,verifiedUnitRecords,
   missingUnitRecords,unverifiedUnitRecords,warningUnitRecords,
   distinctStartingOrOptionalRules:rules.size,
   startingSpecialRuleOccurrences,reviewedStartingOccurrences,manualStartingOccurrences,
   referenceOnlyStartingOccurrences:startingSpecialRuleOccurrences-reviewedStartingOccurrences-manualStartingOccurrences,
   optionalSpecialRuleOccurrences,otherStartingReferenceOccurrences,
   reviewedCharacterRuleDescriptors:characterRules.length,
   reviewedContagiousRuleDescriptors:contagiousRules.length,
   reviewedManualRuleDescriptors:Object.keys(REVIEWED_CORE_RULES).length,
   reviewedItemEffectDescriptors:reviewedItems.length,
   sourceIndexedItemOrAbilityPages:catalogue.length,
   reviewedItemSourceUrlsInCatalogue:reviewedCatalogueMatches
  },
  // Ranked by occurrence, not by game importance; some unimplemented rules
  // are already handled by other UI subsystems or are not buffs at all.
  mostCommonReferenceOnly:sorted.filter(x=>x.referenceOnlyStartingOccurrences>0)
   .sort((a,b)=>b.referenceOnlyStartingOccurrences-a.referenceOnlyStartingOccurrences||
      a.name.localeCompare(b.name)).slice(0,25),
  reviewedStartingRules:sorted.filter(x=>x.reviewedStartingOccurrences>0),
  ruleSources:sorted,
  problems
 };
}

export function loadShippedRuleEffectCoverage(){
 const index=readJson('../docs/unit-data/index.json');
 const magicIndex=readJson('../docs/reference-records/magic-items-index.json');
 const shards={};
 for(const entry of index.entries){
  if(!(entry.shard in shards))
   shards[entry.shard]=readJson('../docs/unit-data/shards/'+entry.shard+'.json');
 }
 return buildRuleEffectCoverage({index,shards,magicIndex});
}

function printSummary(r){
 const c=r.counts;
 const lines=[
  '# Source-backed effect coverage audit',
  '',
  'Snapshot: '+r.provenance.unitSourceCommit+' (units); '+r.provenance.magicCatalogueCheckedAt+' (item link catalogue)',
  '',
  'Verified unit records: '+c.verifiedUnitRecords+' / '+c.indexedUnits,
  'Records with extraction warnings: '+c.warningUnitRecords,
  'Published starting special-rule occurrences: '+c.startingSpecialRuleOccurrences,
  'Reviewed character/inherited effect occurrences: '+c.reviewedStartingOccurrences,
  'Reviewed manual-only starting-rule occurrences: '+c.manualStartingOccurrences,
  'Starting rule occurrences still reference-only in these projectors: '+c.referenceOnlyStartingOccurrences,
  'Optional special-rule references (NOT necessarily selected): '+c.optionalSpecialRuleOccurrences,
  'Effect descriptors for imported magic items: '+c.reviewedItemEffectDescriptors,
  'Indexed item/ability reference pages (NOT all magic items): '+c.sourceIndexedItemOrAbilityPages,
  'Reviewed item effect URLs represented in catalogue: '+c.reviewedItemSourceUrlsInCatalogue,
  '',
  'Most common reference-only starting rules (occurrences, not rule importance):',
  ...r.mostCommonReferenceOnly.map(x=>'- '+x.name+': '+x.referenceOnlyStartingOccurrences+' — '+x.sourceUrl),
  '',
  'IMPORTANT: Reviewed manual reminders do not compute rules or battle results.',
  'A source link does NOT mean an effect is computed. This audit',
  'does not verify legality, equipment selections, formations, combat results,',
  'or the correctness of rules in other independently implemented subsystems.'
 ];
 return lines.join('\n');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=loadShippedRuleEffectCoverage();
 process.stdout.write(process.argv.includes('--json')?
  JSON.stringify(report,null,2)+'\n':printSummary(report)+'\n');
 if(report.problems.length)process.exitCode=1;
}

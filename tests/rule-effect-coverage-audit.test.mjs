import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildRuleEffectCoverage,loadShippedRuleEffectCoverage
} from '../scripts/audit-rule-effect-coverage.mjs';

test('coverage report audits the complete shipped source snapshot without treating references as effects',()=>{
 const report=loadShippedRuleEffectCoverage(),c=report.counts;
 assert.equal(report.schemaVersion,1);
 assert.equal(report.problems.length,0,'Every indexed source record should resolve and match');
 assert.ok(c.indexedUnits>=500);
 assert.equal(c.verifiedUnitRecords,c.indexedUnits);
 assert.equal(c.missingUnitRecords,0);
 assert.equal(c.unverifiedUnitRecords,0);
 assert.ok(c.startingSpecialRuleOccurrences>c.reviewedStartingOccurrences);
 assert.ok(c.manualStartingOccurrences>100,'Reviewed manual-only rules have meaningful source coverage');
 assert.equal(c.startingSpecialRuleOccurrences,
  c.reviewedStartingOccurrences+c.manualStartingOccurrences+c.referenceOnlyStartingOccurrences);
 assert.ok(c.optionalSpecialRuleOccurrences>0);
 assert.ok(c.sourceIndexedItemOrAbilityPages>c.reviewedItemEffectDescriptors,
  'A source URL catalogue must not be mistaken for implemented item effects');
 assert.ok(c.reviewedItemSourceUrlsInCatalogue>0);
 assert.ok(report.mostCommonReferenceOnly.length>0);
 assert.ok(report.ruleSources.every(r=>r.sourceUrl.startsWith('https://tow.whfb.app/special-rules/')));
 assert.ok(report.ruleSources.every(r=>r.startingOccurrences===
  r.reviewedStartingOccurrences+r.manualStartingOccurrences+r.referenceOnlyStartingOccurrences));
 assert.ok(report.ruleSources.some(r=>r.name==='Close Order'&&r.manualStartingOccurrences>100));
 assert.ok(report.reviewedStartingRules.some(r=>
  r.sourceUrl==='https://tow.whfb.app/special-rules/precision-strikes'),
  'A known source-backed effect must be recognised by its exact owning unit');
 assert.ok(report.mostCommonReferenceOnly.every(r=>r.reviewStatus!=='reviewed-conditional'));
});

test('fake links, unverified records and optional selections never count as implemented effects',()=>{
 const precision='https://tow.whfb.app/special-rules/precision-strikes';
 const stupidity='https://tow.whfb.app/special-rules/stupidity';
 const r=(id,name,rules,category,verification='source-extracted')=>({
  id,name,source:{sourceUrl:'https://tow.whfb.app/unit/'+id.slice(5),
   verificationStatus:verification},
  classification:{unitCategory:[category]},
  startingRules:rules,
  optionalRules:[{name:'Stupidity',sourceUrl:stupidity}]
 });
 const index={schemaVersion:1,source:{},entries:[
  {id:'unit:ishaya-vess',sourceUrl:'https://tow.whfb.app/unit/ishaya-vess',shard:'00'},
  {id:'unit:unrelated',sourceUrl:'https://tow.whfb.app/unit/unrelated',shard:'01'},
  {id:'unit:unverified',sourceUrl:'https://tow.whfb.app/unit/unverified',shard:'01'}
 ]};
 const shards={
  '00':{records:{'unit:ishaya-vess':r('unit:ishaya-vess','Source character',[
    {name:'Precision Strikes',sourceUrl:precision},
    {name:'Stupidity',sourceUrl:stupidity}
   ],'Character')}},
  '01':{records:{
   'unit:unrelated':r('unit:unrelated','Other regiment',[
    {name:'Precision Strikes',sourceUrl:precision},
    {name:'Stupidity',sourceUrl:stupidity},
    {name:'Stupidity',sourceUrl:'https://invalid.example/stupidity'}
   ],'Core'),
   'unit:unverified':r('unit:unverified','Unverified unit',[
    {name:'Stupidity',sourceUrl:stupidity}
   ],'Character','pending')
  }}
 };
 const magicIndex={schemaVersion:1,entries:[{kind:'item-or-ability',
  url:'https://tow.whfb.app/magic-item/charmed-shield'}]};
 const report=buildRuleEffectCoverage({index,shards,magicIndex}),c=report.counts;
 assert.equal(c.indexedUnits,3);
 assert.equal(c.verifiedUnitRecords,2);
 assert.equal(c.unverifiedUnitRecords,1);
 assert.equal(c.startingSpecialRuleOccurrences,4);
 assert.equal(c.reviewedStartingOccurrences,2,
  'Only a qualifying character with exact source rule may project effects');
 assert.equal(c.manualStartingOccurrences,0);
 assert.equal(c.referenceOnlyStartingOccurrences,2);
 assert.equal(c.optionalSpecialRuleOccurrences,2);
 assert.equal(c.otherStartingReferenceOccurrences,1);
 assert.deepEqual(report.problems.map(p=>p.problem),['unverified-or-mismatched-record']);
 const p=report.ruleSources.find(x=>x.sourceUrl===precision);
 assert.equal(p.reviewedStartingOccurrences,1);
 assert.equal(p.referenceOnlyStartingOccurrences,1);
 assert.equal(p.reviewStatus,'mixed-by-owner-and-scope');
 const s=report.ruleSources.find(x=>x.sourceUrl===stupidity);
 assert.equal(s.reviewedStartingOccurrences,1);
 assert.equal(s.referenceOnlyStartingOccurrences,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {buildImportedSelectionCoverage,auditImportedArmy} from '../scripts/audit-imported-rule-selections.mjs';

const root=new URL('../',import.meta.url);
const sourceUrl='https://tow.whfb.app/unit/example';
const ruleUrl='https://tow.whfb.app/special-rules/close-order';
const index={entries:[{id:'unit:example',name:'Example',sourceUrl,shard:'00'}]};
const record={id:'unit:example',source:{sourceUrl,verificationStatus:'source-extracted'},startingRules:[{name:'Close Order',sourceUrl:ruleUrl}],optionalRules:[{name:'Fly (9)',sourceUrl:'https://tow.whfb.app/special-rules/fly'}]};
const entry={id:'tow:/special-rules/close-order',sourceUrl:ruleUrl,status:'Manual Support'};
const army=()=>({units:[{id:'u1',name:'Example',reference:{url:sourceUrl},selections:[{name:'On foot'},{name:'Unlinked upgrade',children:[{name:'Close Order',reference:{url:ruleUrl}}]}],modelGroups:[]} ]});

test('source starting rules and nested explicit selections preserve manual status and separate unknowns',()=>{
 const imported=army(),before=JSON.stringify(imported);
 const result=auditImportedArmy({army:imported,index,records:{u1:record},entries:[entry],file:'example.txt'});
 assert.equal(result.totals.startingRuleOccurrences,1);
 assert.equal(result.totals.explicitSelections,3);
 assert.equal(result.totals.informationalSelections,1);
 assert.equal(result.totals.unlinkedSelections,1);
 assert.equal(result.totals.fullyImplementedOccurrences,0);
 assert.equal(result.occurrences.filter(x=>x.status==='Manual Support').length,2);
 assert.ok(result.occurrences.some(x=>x.importPath==='/units/0/selections/1/children/0'));
 assert.ok(!result.occurrences.some(x=>x.sourceUrl?.endsWith('/fly')),'Optional source references are not selected');
 assert.equal(JSON.stringify(imported),before,'Auditing never mutates the imported army');
});

test('unverified or conflicting source records cannot supply inherited starting rules',()=>{
 for(const invalid of [{...record,source:{...record.source,verificationStatus:'source-indexed'}},{...record,source:{...record.source,sourceUrl:sourceUrl+'-other'}}]){
  const result=auditImportedArmy({army:army(),index,records:{u1:invalid},entries:[entry],file:'example.txt'});
  assert.equal(result.totals.startingRuleOccurrences,0);
  assert.equal(result.totals.unverifiedUnitRecords,1);
  assert.equal(result.unitInstances[0].recordStatus,'Unresolved');
 }
});

test('unlinked and source-linked but unregistered selections remain visible',()=>{
 const a=army();a.units[0].selections=[{name:'Unknown',reference:{url:'https://tow.whfb.app/magic-item/unknown'}},{name:'Foreign',reference:{url:'https://example.com/rule'}}];
 const result=auditImportedArmy({army:a,index,records:{u1:record},entries:[entry],file:'example.txt'});
 assert.equal(result.occurrences.find(x=>x.name==='Unknown').status,'Missing');
 assert.equal(result.occurrences.find(x=>x.name==='Foreign').status,'Unresolved');
 assert.equal(result.totals.missingRegisterEntries,1);
 assert.equal(result.totals.invalidSourceSelections,1);
});

test('manual, partial and conditional canonical statuses never count as complete imported occurrences',()=>{
 for(const status of ['Manual Support','Partial Implementation','Conditional Implementation','Source Verified','Reference Only']){
  const result=auditImportedArmy({army:army(),index,records:{u1:record},entries:[{...entry,status}],file:'example.txt'});
  assert.equal(result.totals.fullyImplementedOccurrences,0,status);
  assert.equal(result.statusCounts[status],2,status);
 }
});

test('source-less gap entries never lend canonical IDs to unlinked or foreign selections',()=>{
 const a=army();a.units[0].selections=[
  {name:'Unlinked'},
  {name:'Foreign',reference:{url:'https://example.com/rule'}},
  {name:'Unregistered',reference:{url:'https://tow.whfb.app/magic-item/unregistered'}}
 ];
 const result=auditImportedArmy({army:a,index,records:{u1:record},entries:[entry,
  {id:'gap:no-source',sourceUrl:null,status:'Missing'},
  {id:'gap:invalid-source',sourceUrl:'https://example.com/rule',status:'Fully Implemented'}
 ],file:'example.txt'});
 for(const name of ['Unlinked','Foreign','Unregistered'])
  assert.equal(result.occurrences.find(x=>x.name===name).canonicalId,null,name);
 for(const name of ['Unlinked','Foreign'])
  assert.equal(result.occurrences.find(x=>x.name===name).status,'Unresolved',name);
 assert.equal(result.occurrences.find(x=>x.name==='Unregistered').status,'Missing');
 assert.equal(result.totals.fullyImplementedOccurrences,0);
});

test('empty import has no invented selection denominator',()=>{
 const result=auditImportedArmy({army:{units:[]},index,records:{},entries:[],file:'empty.txt'});
 assert.equal(result.explicitSelectionCoverage.denominator,null);
 assert.equal(result.explicitSelectionCoverage.percentage,null);
});

test('all shipped exports are reproducibly audited without treating repeated formats as unique armies',()=>{
 const first=buildImportedSelectionCoverage({root,entries:[entry]});
 const second=buildImportedSelectionCoverage({root,entries:[entry]});
 assert.deepEqual(first,second);
 assert.equal(first.perFixture.length,readdirSync(new URL('docs/examples/',root)).filter(x=>x.endsWith('.txt')).length);
 assert.ok(first.totals.unitInstances>0);
 assert.ok(first.totals.startingRuleOccurrences>0);
 assert.ok(first.totals.unlinkedSelections>0);
 assert.match(first.scope,/repeated exports/i);
 assert.equal(first.completeArmyRulesPercentage,null);
 for(const fixture of first.perFixture){
  assert.equal(Object.values(fixture.statusCounts).reduce((a,b)=>a+b,0),fixture.occurrences.length);
  assert.equal(fixture.totals.explicitSelections,fixture.totals.informationalSelections+fixture.totals.linkedSelections+fixture.totals.unlinkedSelections+fixture.totals.invalidSourceSelections);
 }
});

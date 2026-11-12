import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter} from '../docs/battle-session.js';
import {projectArmyEffects} from '../docs/effects-engine.js';
import {referenceOnlyPublishedRules} from '../docs/source-special-rule-effects.js';

const fixture=()=>parseArmy(readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8'));
const shard=JSON.parse(readFileSync(new URL('../docs/unit-data/shards/1e.json',import.meta.url),'utf8'));
const ishayaRecord=shard.records['unit:ishaya-vess'];
const result=(army,session,records,unitId)=>projectArmyEffects(army,session,records).byUnit[unitId]||[];
const find=(list,id)=>list.filter(entry=>entry.id===id);
const person=(army,name)=>army.units.find(unit=>unit.name===name);
const sourceMap=(ishaya,record=ishayaRecord)=>({[ishaya.id]:record});

test('Shipped Ishaya source record contains Precision Strikes at its real, reviewed tow.whfb.app URL',()=>{
 assert.equal(ishayaRecord.source.sourceUrl,'https://tow.whfb.app/unit/ishaya-vess');
 assert.equal(ishayaRecord.source.verificationStatus,'source-extracted');
 assert.ok(ishayaRecord.startingRules.some(rule=>rule.name==='Precision Strikes'&&
  rule.sourceUrl==='https://tow.whfb.app/special-rules/precision-strikes'));
 const army=fixture(),ishaya=person(army,'Ishaya Vess');
 const refs=referenceOnlyPublishedRules(ishaya,ishayaRecord);
 assert.ok(refs.some(x=>x.name==='Commanding Voice'));
 assert.ok(refs.some(x=>x.name==='Rallying Cry'));
 assert.equal(refs.some(x=>x.name==='Precision Strikes'),false,
  'Implemented benefits are shown as Effects, all other published source rules remain reviewable');
});
test('Precision Strikes follows the actual assigned unit and is distinct from Razor Standard',()=>{
 const army=fixture(),before=JSON.stringify(army);
 const ishaya=person(army,'Ishaya Vess'),sea=person(army,'Lothern Sea Guard');
 assert.ok(ishaya?.reference?.url==='https://tow.whfb.app/unit/ishaya-vess');
 assert.ok(sea?.reference?.url==='https://tow.whfb.app/unit/lothern-sea-guard');
 const records=sourceMap(ishaya);
 let session=restoreBattleSession(army);
 let effects=result(army,session,records,sea.id);
 assert.equal(find(effects,'precision-strikes').length,0,'No character assignment = no join bonus');
 assert.equal(find(result(army,session,records,ishaya.id),'precision-strikes').length,1,
  'Ishaya can review her potential character ability while independent');
 session=assignCharacter(army,session,ishaya.id,sea.id);
 effects=result(army,session,records,sea.id);
 const granted=find(effects,'precision-strikes');
 assert.equal(granted.length,1,'One reviewed rule on joined regiment');
 assert.equal(granted[0].ownerId,ishaya.id);
 assert.equal(granted[0].beneficiaryId,sea.id);
 assert.equal(granted[0].shared,true);
 assert.equal(granted[0].status,'conditional');
 assert.equal(granted[0].sourceUrl,'https://tow.whfb.app/special-rules/precision-strikes');
 assert.match(granted[0].quickLabel,/AP \+1/);
 assert.match(granted[0].quickDetail,/weapons.*by 1/i);
 assert.equal(find(effects,'razor-standard').length,1,'Razor Standard effect remains independent');
 assert.equal(find(result(army,session,records,ishaya.id),'precision-strikes').length,1,
  'Owner carries rule reference but not a false personal offensive AP modifier');
 assert.equal(find(result(army,session,records,ishaya.id),'precision-strikes')[0].effectGroup,'support');
 for(const unit of army.units.filter(u=>u.name==="Ship's Company"))
  assert.equal(find(result(army,session,records,unit.id),'precision-strikes').length,0,
   'Similar troop names do not qualify');
 session=assignCharacter(army,session,ishaya.id,null);
 assert.equal(find(result(army,session,records,sea.id),'precision-strikes').length,0,
  'Detaching removes benefit with no stale projection');
 assert.equal(JSON.stringify(army),before,'Display projection must not rewrite the imported army');
});
test('Rules fail closed without source proof, with mismatched owner, unverified rules or invalid target',()=>{
 const army=fixture(),ishaya=person(army,'Ishaya Vess'),sea=person(army,'Lothern Sea Guard');
 const company=person(army,"Ship's Company");
 let session=assignCharacter(army,restoreBattleSession(army),ishaya.id,sea.id);
 assert.equal(find(result(army,session,{},sea.id),'precision-strikes').length,0);
 const record=structuredClone(ishayaRecord);
 record.source.verificationStatus='unverified';
 assert.equal(find(result(army,session,sourceMap(ishaya,record),sea.id),'precision-strikes').length,0);
 record.source.verificationStatus='source-extracted';
 record.source.sourceUrl='https://tow.whfb.app/unit/other-character';
 assert.equal(find(result(army,session,sourceMap(ishaya,record),sea.id),'precision-strikes').length,0);
 record.source.sourceUrl=ishayaRecord.source.sourceUrl;
 record.startingRules=record.startingRules.filter(x=>x.name!=='Precision Strikes');
 assert.equal(find(result(army,session,sourceMap(ishaya,record),sea.id),'precision-strikes').length,0);
 session=assignCharacter(army,session,ishaya.id,company.id);
 assert.equal(find(result(army,session,sourceMap(ishaya),company.id),'precision-strikes').length,0);
 assert.equal(find(result(army,session,sourceMap(ishaya),sea.id),'precision-strikes').length,0);
});

test('Stupidity rule transfer is source-gated, reversible and army-agnostic (synthetic source fixture)',()=>{
 const army=fixture(),ishaya=person(army,'Ishaya Vess'),sea=person(army,'Lothern Sea Guard');
 const company=person(army,"Ship's Company");
 const pristine=JSON.stringify(army);
 const records=sourceMap(ishaya);
 const rule={name:'Stupidity',sourceUrl:'https://tow.whfb.app/special-rules/stupidity'};
 // Synthetic source record models a character with Stupidity; the real
 // Ishaya record above is NEVER asserted to have this rule.
 const simulated=structuredClone(ishayaRecord);
 simulated.startingRules.push(rule);
 let session=assignCharacter(army,restoreBattleSession(army),ishaya.id,sea.id);
 assert.equal(find(result(army,session,records,sea.id),'stupidity').length,0,
  'Real Ishaya has no Stupidity, and must never project it');
 const proof=sourceMap(ishaya,simulated);
 let effects=find(result(army,session,proof,sea.id),'stupidity');
 assert.equal(effects.length,1);
 assert.equal(effects[0].kind,'Special rule');
 assert.equal(effects[0].status,'conditional');
 assert.equal(effects[0].effectGroup,'restriction');
 assert.equal(effects[0].shared,true);
 assert.equal(effects[0].ownerId,ishaya.id);
 assert.equal(effects[0].sourceUrl,rule.sourceUrl);
 assert.match(effects[0].quickDetail,/test when required/i);
 assert.match(effects[0].scope,/not automated/i);
 assert.equal(find(result(army,session,proof,ishaya.id),'stupidity').length,1);
 assert.equal(find(result(army,session,proof,company.id),'stupidity').length,0);
 session=assignCharacter(army,session,ishaya.id,company.id);
 assert.equal(find(result(army,session,proof,sea.id),'stupidity').length,0,
  'Previous regiment must immediately lose inherited rule');
 assert.equal(find(result(army,session,proof,company.id),'stupidity').length,1,
  'Any regiment can inherit the rule, not only a particular faction or unit name');
 session=assignCharacter(army,session,ishaya.id,null);
 assert.equal(find(result(army,session,proof,company.id),'stupidity').length,0);
 assert.equal(JSON.stringify(army),pristine,'Effect projection must be read-only');
});
test('Stupidity transfer fails closed on invalid records, altered rule names or wrong URLs',()=>{
 const army=fixture(),ishaya=person(army,'Ishaya Vess'),sea=person(army,'Lothern Sea Guard');
 const session=assignCharacter(army,restoreBattleSession(army),ishaya.id,sea.id);
 const simulated=structuredClone(ishayaRecord);
 simulated.startingRules.push({name:'Stupidity',sourceUrl:'https://tow.whfb.app/special-rules/stupidity'});
 const projected=r=>find(result(army,session,sourceMap(ishaya,r),sea.id),'stupidity');
 assert.equal(projected(simulated).length,1);
 for(const change of [
  r=>{r.source.verificationStatus='unverified';},
  r=>{r.source.sourceUrl='https://tow.whfb.app/unit/other';},
  r=>{r.startingRules.at(-1).name='Fear';},
  r=>{r.startingRules.at(-1).sourceUrl='https://example.invalid/stupidity';},
  r=>{r.startingRules.at(-1).sourceUrl='https://tow.whfb.app/special-rules/fear';}
 ]){
  const wrong=structuredClone(simulated);change(wrong);
  assert.equal(projected(wrong).length,0);
 }
});

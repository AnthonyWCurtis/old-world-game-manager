import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,assignCharacter} from '../docs/battle-session.js';
import {projectArmyEffects} from '../docs/effects-engine.js';
import {reviewedCoreRule,projectReviewedCoreRules,REVIEWED_CORE_RULES}
 from '../docs/source-core-rule-effects.js';
import {referenceOnlyPublishedRules} from '../docs/source-special-rule-effects.js';

const file=name=>readFileSync(new URL('../docs/examples/'+name+'.txt',import.meta.url),'utf8');
const fixture=name=>parseArmy(file(name));
const shipped=(shard,id)=>JSON.parse(readFileSync(
 new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records[id];
const seaRecord=shipped('0f','unit:lothern-sea-guard');
const chaosRecord=shipped('14','unit:chaos-ogres');
const seaArmy=()=>fixture('owb-regular');
const named=(army,name)=>army.units.find(u=>u.name===name);
const manual=(army,session,records,unit)=>projectArmyEffects(army,session,records)
 .byUnit[unit.id].filter(e=>e.mode==='manual-reference');
const ref=(name,slug)=>({name,sourceUrl:'https://tow.whfb.app/special-rules/'+slug});

test('Six common source-reviewed rules provide exact, manual-only descriptors, never calculated modifiers',()=>{
 assert.equal(Object.keys(REVIEWED_CORE_RULES).length,6);
 const examples=[
  ['Close Order','close-order',/may adopt a Close Order formation/],
  ['Swiftstride','swiftstride',/entirely of models/],
  ['Regeneration (5+)','regeneration',/recovered Wound still counts/],
  ['Armour Bane (2)','armour-bane',/natural 6/],
  ['Impact Hits (D3+1)','impact-hits',/at least 3 inches/],
  ['Stomp Attacks (D3)','stomp-attacks',/Initiative 1/]
 ];
 for(const [name,slug,pattern] of examples){
  const result=reviewedCoreRule(ref(name,slug));
  assert.ok(result,'Missing reviewed rule '+name);
  assert.equal(result.name,name);
  assert.equal(result.sourceUrl,'https://tow.whfb.app/special-rules/'+slug);
  assert.match(result.description,pattern);
  assert.ok(result.scope.length>55);
  assert.ok(result.phase);
 }
});

test('Actual shipped Chaos Ogres and Lothern Sea Guard receive only their published starting rules',()=>{
 const army=fixture('warriors-chaos'),ogres=named(army,'Chaos Ogres');
 const saved=JSON.stringify(army);
 assert.equal(ogres?.reference?.url,chaosRecord.source.sourceUrl);
 const effects=manual(army,restoreBattleSession(army),
  {[ogres.id]:chaosRecord},ogres);
 assert.deepEqual(effects.map(e=>e.name).sort(),
  ['Armour Bane (1)','Close Order','Impact Hits (1)'].sort());
 assert.ok(effects.every(e=>e.status==='manual'&&e.effectGroup==='manual'&&
  e.ownerId===ogres.id&&!e.shared&&!e.quickLabel&&!e.trackUse));
 assert.ok(effects.some(e=>e.name==='Impact Hits (1)'&&
  /charge movement/.test(e.scope)));
 const other=army.units.find(u=>u.name!=='Chaos Ogres');
 assert.equal(manual(army,null,{[ogres.id]:chaosRecord},other).length,0);
 assert.equal(JSON.stringify(army),saved,'No changes to army points, selections or original text');
 const he=seaArmy(),sea=named(he,'Lothern Sea Guard');
 assert.equal(sea.reference.url,seaRecord.source.sourceUrl);
 const effect=manual(he,null,{[sea.id]:seaRecord},sea);
 assert.deepEqual(effect.map(e=>e.name),['Close Order']);
 const otherReferences=referenceOnlyPublishedRules(sea,seaRecord);
 assert.equal(otherReferences.some(r=>r.name==='Close Order'),false,
  'Reviewed manual rule should not be duplicated under source-only rules');
 assert.ok(otherReferences.some(r=>r.name==='Naval Discipline'),
  'Unreviewed rule remains explicitly source-only');
});

test('Synthetic variable source rules cover model save, stomp and whole-unit movement without granting fake bonuses',()=>{
 const army=seaArmy(),sea=named(army,'Lothern Sea Guard');
 const synthetic=structuredClone(seaRecord);
 synthetic.startingRules.push(
  ref('Swiftstride','swiftstride'),
  ref('Regeneration (5+)','regeneration'),
  ref('Stomp Attacks (D3)','stomp-attacks')
 );
 const effects=manual(army,null,{[sea.id]:synthetic},sea);
 assert.equal(effects.length,4);
 const byName=new Map(effects.map(e=>[e.name,e]));
 assert.match(byName.get('Swiftstride').scope,/entire unit/);
 assert.match(byName.get('Regeneration (5+)').scope,/Model-level/);
 assert.match(byName.get('Stomp Attacks (D3)').description,/base contact/);
 assert.equal(byName.get('Regeneration (5+)').status,'manual');
 assert.ok(!effects.some(e=>e.effectGroup==='offensive'),
  'No fake automatic offensive buff or computed save');
});

test('Spoofed or optional rules never become reviewed effects, and inherited assignment is not assumed',()=>{
 const army=seaArmy(),sea=named(army,'Lothern Sea Guard');
 const ishaya=named(army,'Ishaya Vess');
 let saved=JSON.stringify(army);
 const notStarting=structuredClone(seaRecord);
 notStarting.optionalRules.push(ref('Impact Hits (D3)','impact-hits'));
 assert.deepEqual(manual(army,null,{[sea.id]:notStarting},sea).map(e=>e.name),
  ['Close Order'],'Optional source options are not automatically selected');
 const tampered=structuredClone(seaRecord);
 tampered.startingRules.push(
  ref('Armour Bane (2)','impact-hits'),
  ref('Impact Hits (2)','stomp-attacks'),
  ref('Stomp Attacks (D3)','impact-hits'),
  {name:'Swiftstride',sourceUrl:'https://other.invalid/special-rules/swiftstride'},
  ref('Regeneration (1+); fake','regeneration'),
  ref('Impact Hits (D3+oops)','impact-hits')
 );
 assert.deepEqual(manual(army,null,{[sea.id]:tampered},sea).map(e=>e.name),
  ['Close Order'],'Incorrect name/source pairs and expressions fail closed');
 for(const change of [
  r=>{r.source.sourceUrl='https://tow.whfb.app/unit/unrelated';},
  r=>{r.source.verificationStatus='unverified';},
  r=>{delete r.startingRules;}
 ]){
  const bad=structuredClone(seaRecord);change(bad);
  assert.equal(manual(army,null,{[sea.id]:bad},sea).length,0);
 }
 const joined=assignCharacter(army,restoreBattleSession(army),ishaya.id,sea.id);
 assert.equal(manual(army,joined,{[sea.id]:seaRecord},ishaya).length,0,
  'A joined character does not automatically gain regiment special rules');
 assert.equal(JSON.stringify(army),saved);
});

test('Manual reviewed references are not presented as active compact buffs or computed attack effects',()=>{
 const roster=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../docs/effects-ui.js',import.meta.url),'utf8');
 const src=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(roster,/entry\?\.status==='active'/);
 assert.doesNotMatch(roster,/game-card-chip-item/);
 assert.match(ui,/manual:'Reviewed · manual'/);
 assert.match(ui,/rule is not applied to rolls, saves, movement, formations or combat totals/);
 assert.match(src,/source-core-rule-effects\.js/);
});

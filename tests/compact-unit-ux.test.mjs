import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackingDefinition,readTrackedRemaining,setTrackedRemaining} from '../docs/unit-wound-tracker.js';
import {reviewedSpecialAttackRows} from '../docs/source-special-attack-rows.js';
const data=id=>{
 const index=JSON.parse(readFileSync(new URL('../docs/unit-data/index.json',import.meta.url),'utf8'));
 const entry=index.entries.find(x=>x.id==='unit:'+id);
 const shard=JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+entry.shard+'.json',import.meta.url),'utf8'));
 return shard.records[entry.id];
};
const prince=data('prince'),dragon=data('star-dragon'),sea=data('lothern-sea-guard');
const unit=(id,record,count=null)=>({
 id,reference:{url:record.source.sourceUrl},quantity:{value:count},selections:[]
});
test('single source-model Wounds and Toughness are displayed without invented modifiers',()=>{
 const spec=trackingDefinition(unit('p',prince),prince,null,[]);
 assert.equal(spec.kind,'wounds');assert.equal(spec.max,3);assert.equal(spec.toughness,3);
});
test('source-linked ridden monster characteristic additions give one combined pool',()=>{
 const attached=[{sourceUrl:dragon.source.sourceUrl,mountType:'riddenMonster',
  profiles:dragon.modelProfiles}];
 const spec=trackingDefinition(unit('p',prince),prince,null,attached);
 assert.equal(spec.max,9);
 assert.equal(spec.toughness,6);
 assert.match(spec.note,/not validated/i);
});
test('unverified chariot or missing mount W cannot fabricate a wounds total',()=>{
 const base=unit('p',prince);
 assert.equal(trackingDefinition(base,prince,null,[{
  sourceUrl:'https://tow.whfb.app/unit/lothern-skycutter',mountType:'chariot',profiles:[]
 }]).kind,'unresolved');
 assert.equal(trackingDefinition(base,prince,null,[{
  sourceUrl:dragon.source.sourceUrl,mountType:'riddenMonster',profiles:[{name:'Unknown',characteristics:{W:'—'}}]
 }]).max,null);
});
test('regiment quick counter records surviving models, not individual wounds',()=>{
 const spec=trackingDefinition(unit('sea',sea,32),sea,null,[]);
 assert.equal(spec.kind,'models');assert.equal(spec.max,32);
 const multi={...sea,modelProfiles:[{name:'Example',characteristics:{W:3,T:4}}]};
 const group=trackingDefinition(unit('multi',multi,3),multi,null,[]);
 assert.equal(group.kind,'models');assert.match(group.note,/multi-wound/i);
});
test('manual counters are isolated by imported army and instance; invalid writes fail',()=>{
 const army={originalText:'fixture-for-compact-unit-ux'};
 const other={originalText:'unrelated-fixture-for-compact-unit-ux'};
 const spec={kind:'models',max:16};
 assert.equal(readTrackedRemaining(army,'a',spec),16);
 const saved=setTrackedRemaining(army,'a',spec,13);
 assert.equal(saved.remaining,13);
 assert.equal(readTrackedRemaining(army,'a',spec),13);
 assert.equal(readTrackedRemaining(army,'b',spec),16);
 assert.equal(readTrackedRemaining(other,'a',spec),16);
 assert.throws(()=>setTrackedRemaining(army,'a',spec,-1),/Invalid manual/);
 assert.throws(()=>setTrackedRemaining(army,'a',spec,17),/Invalid manual/);
});
test('Stomp and Dragon Fire only display from exact verified starting source references',()=>{
 const rows=reviewedSpecialAttackRows(prince,[{
  sourceUrl:dragon.source.sourceUrl,mountType:'riddenMonster',profiles:dragon.modelProfiles
 }],{[dragon.source.sourceUrl]:dragon});
 assert.equal(rows.combat.length,1);
 assert.equal(rows.combat[0].name,'Stomp Attacks (D6+1)');
 assert.deepEqual(rows.combat[0].stats.slice(0,3),[['To Hit','Auto'],['Hits','D6+1'],['S','7']]);
 assert.equal(rows.shooting.length,1);
 assert.equal(rows.shooting[0].name,'Dragon Fire');
 assert.equal(rows.shooting[0].stats[3][1],'−1');
 const unrelated=reviewedSpecialAttackRows(prince,[],{});
 assert.deepEqual(unrelated,{shooting:[],combat:[]});
 const unverified={...dragon,source:{...dragon.source,verificationStatus:'unresolved'}};
 assert.deepEqual(reviewedSpecialAttackRows(unverified,[],{}),{shooting:[],combat:[]});
});

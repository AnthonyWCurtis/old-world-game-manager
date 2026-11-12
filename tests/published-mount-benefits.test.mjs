import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publishedMountBenefits} from '../docs/published-mount-benefits.js';
import {resolveSelectedMountProfiles} from '../docs/resolve-selected-mount-profiles.js';

const url='https://tow.whfb.app/unit/example-chariot';
const character='https://tow.whfb.app/unit/example-rider';
const record={
 source:{sourceUrl:url,verificationStatus:'source-extracted'},
 classification:{unitCategory:['Chariot'],troopType:['Heavy Chariot']},
 startingRules:[
  {name:'Impact Hits (D6+1, Chariot only)',sourceUrl:'https://tow.whfb.app/special-rules/impact-hits'},
  {name:'First Charge',sourceUrl:'https://tow.whfb.app/special-rules/first-charge'}
 ],
 optionalRules:[{name:'Regeneration (5+)',sourceUrl:'https://tow.whfb.app/special-rules/regeneration'}]
};
test('chariot shows source-based combined movement, wounds, toughness and nonduplicated impact hits',()=>{
 const b=publishedMountBenefits(record,'chariot');
 assert.deepEqual(b.benefits.map(x=>x.name),[
  'Split-profile special rules','Movement','Wounds','Toughness',
  'Impact Hits and Stomp Attacks','Separate attacks']);
 assert.match(b.benefits.find(x=>x.name==='Wounds').detail,/Add the character/);
 assert.match(b.benefits.find(x=>x.name==='Toughness').detail,/higher/);
 const impact=b.specialRules.find(x=>x.name.startsWith('Impact Hits'));
 assert.equal(impact.status,'component-specific');
 assert.match(impact.appliesTo,/not copied to rider/);
 assert.equal(b.specialRules.find(x=>x.name==='Regeneration (5+)').status,'not-selected');
 assert.match(b.weaponRuleExclusion.detail,/not automatically/);
});
test('ridden monsters may alter wounds/toughness only when mount profile states it',()=>{
 const b=publishedMountBenefits(record,'riddenMonster');
 assert.match(b.benefits.find(x=>x.name==='Toughness and Wounds').detail,/No generic addition/);
 assert.ok(!b.benefits.some(x=>x.name==='Wounds'));
});
test('cavalry never gains chariot wound-addition rules',()=>{
 const b=publishedMountBenefits(record,'cavalry');
 assert.ok(!b.benefits.some(x=>['Wounds','Toughness'].includes(x.name)));
 assert.match(b.benefits.find(x=>x.name==='Rider armour').detail,/rider/);
});
test('invalid origin, missing verification and unknown mount type grant no benefits',()=>{
 assert.equal(publishedMountBenefits({...record,source:{sourceUrl:'https://evil.example/unit/a',verificationStatus:'source-extracted'}},'chariot'),null);
 assert.equal(publishedMountBenefits({...record,source:{sourceUrl:url,verificationStatus:'unverified'}},'chariot'),null);
 assert.equal(publishedMountBenefits(record,'unknown'),null);
});
test('exact selected mount source attaches its benefit register with unresolved rider association',()=>{
 const u={reference:{url:character},selections:[{name:'Example Chariot',reference:{url}}]};
 const matches=resolveSelectedMountProfiles(u,{[url]:record},{},5);
 assert.equal(matches.length,1);
 assert.equal(matches[0].publishedBenefits.specialRules.length,2,
  'Unselected optional mount rule must not clutter the imported model');
 assert.match(matches[0].status,/unverified/);
 assert.equal(matches[0].comparison.status,'unresolved');
 const selected={...u,selections:[...u.selections,{name:'Regeneration (5+)'}]};
 const added=resolveSelectedMountProfiles(selected,{[url]:record},{},5);
 assert.equal(added[0].publishedBenefits.specialRules.length,3);
 assert.ok(added[0].publishedBenefits.specialRules.some(x=>x.name==='Regeneration (5+)'));
});
test('UI and offline cache include mount benefits while defence engine remains unchanged',()=>{
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../docs/defence-engine.js',import.meta.url),'utf8');
 assert.match(sw,/\.\/published-mount-benefits\.js/);
 assert.match(ui,/Mount effects and possible rider benefits/);
 assert.match(ui,/Not granted to the rider automatically/);
 assert.doesNotMatch(engine,/publishedMountBenefits/);
});

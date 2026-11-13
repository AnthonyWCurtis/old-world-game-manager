import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateModifiers} from '../docs/modifier-contract.js';

const armourBane={
 id:'example:armour-bane-2',source:{url:'https://tow.whfb.app/special-rules/armour-bane',
  verificationStatus:'verified',verifiedOn:'2026-11-12'},
 owner:{unitId:'a',modelId:'m1',componentId:'rider'},
 recipient:{unitId:'a',modelId:'m1',componentId:'rider'},
 target:{kind:'derived',key:'weaponArmourPiercing'},
 operation:{type:'add',value:-2},trigger:{phase:'wound',event:'wound-roll',
  dice:{basis:'natural',equals:6}},
 conditions:[{key:'attackIsWeapon',equals:true}],
 exclusions:[{key:'attackIsSpell',equals:true}],
 duration:{kind:'event'},stacking:{group:'armour-bane',policy:'exclusive'},
 prerequisites:[{key:'attackingModelIdentified',required:true}],
 trace:'Armour Bane (2) applies on natural 6 To Wound to this weapon only.'
};
const context={target:{kind:'derived',key:'weaponArmourPiercing'},
 recipient:{unitId:'a',modelId:'m1',componentId:'rider'},phase:'wound',event:'wound-roll',
 dice:{natural:6,modified:6},facts:{attackIsWeapon:true,attackIsSpell:false,
  attackingModelIdentified:true}};

test('source-verified natural-six modifier adjusts only eligible weapon AP with a trace',()=>{
 const out=evaluateModifiers({base:0,modifiers:[armourBane],context});
 assert.equal(out.value,-2);
 assert.deepEqual(out.applied,['example:armour-bane-2']);
 assert.match(out.trace.join(' '),/Armour Bane/);
 assert.equal(out.unresolved.length,0);
 assert.equal(evaluateModifiers({base:0,modifiers:[armourBane],context:{...context,
  dice:{natural:5,modified:6}}}).value,0,'modified 6 cannot satisfy natural-six trigger');
});

test('wrong model, weapon component, phase or spell exclusion blocks modifier',()=>{
 for(const ctx of [
  {...context,recipient:{...context.recipient,componentId:'mount'}},
  {...context,recipient:{...context.recipient,modelId:'m2'}},
  {...context,phase:'hit'},
  {...context,facts:{...context.facts,attackIsSpell:true}}]){
  const out=evaluateModifiers({base:0,modifiers:[armourBane],context:ctx});
  assert.equal(out.value,0);
  assert.deepEqual(out.applied,[]);
 }
});

test('unresolved evidence, missing prerequisites or expiry never silently change numeric output',()=>{
 const copies=[
  {...armourBane,source:{...armourBane.source,verificationStatus:'unverified'}},
  {...armourBane,prerequisites:[{key:'unknownLegalJoin',required:true}]},
  {...armourBane,duration:{kind:'through-turn',expiresAfter:2}}
 ];
 const ctx={...context,turn:3};
 for(const mod of copies){
  const out=evaluateModifiers({base:0,modifiers:[mod],context:ctx});
  assert.equal(out.value,0);
  assert.deepEqual(out.applied,[]);
  assert.ok(out.trace.length>0);
 }
 assert.ok(evaluateModifiers({base:0,modifiers:[copies[1]],context:ctx}).unresolved.length>0);
});

test('replacement operation honours explicit one-use readiness and stacking contract',()=>{
 const ward={...armourBane,id:'example:charmed-shield',
  source:{url:'https://tow.whfb.app/magic-item/charmed-shield',verificationStatus:'verified',verifiedOn:'2026-11-12'},
  target:{kind:'save',key:'wardTarget'},operation:{type:'replace',value:5},
  trigger:{phase:'save',event:'ward-save'},conditions:[{key:'charmedShieldReady',equals:true}],
  exclusions:[],prerequisites:[{key:'bearerHasWound',required:true}],
  stacking:{group:'single-ward-target',policy:'exclusive'},trace:'Charmed Shield 5+ once per game for its bearer.'};
 const ctx={...context,target:ward.target,phase:'save',event:'ward-save',
  facts:{charmedShieldReady:true,bearerHasWound:true}};
 assert.equal(evaluateModifiers({base:7,modifiers:[ward],context:ctx}).value,5);
 assert.equal(evaluateModifiers({base:7,modifiers:[ward],context:{...ctx,
  facts:{...ctx.facts,charmedShieldReady:false}}}).value,7);
 assert.equal(evaluateModifiers({base:7,modifiers:[ward,ward],context:ctx}).applied.length,1);
});

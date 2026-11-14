import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {magicWeaponAttackLabel,unitAttackSummary} from '../docs/unit-attack-panel.js';
import {ITEM_EFFECT_RULES,projectArmyEffects} from '../docs/effects-engine.js';
import {parseArmy} from '../docs/parser.js';

const reaver=ITEM_EFFECT_RULES['reaver-bow'];
const asRow=(overrides={})=>({
 name:reaver.name,attackPhase:reaver.attackPhase,sourceUrl:reaver.sourceUrl,
 attackProfile:reaver.attackProfile,shotsMode:reaver.attackProfile.shotsMode,...overrides
});

test('Reaver Bow reviewed formula is the bearer A, not a fixed global number',()=>{
 assert.equal(reaver.attackProfile.shotsMode,'attacks-characteristic');
 assert.equal(magicWeaponAttackLabel(asRow(),[{name:'Commander',attacks:'3'}]),'3 shots');
 assert.equal(magicWeaponAttackLabel(asRow(),[{name:'Commander',attacks:'4'}]),'4 shots');
});
test('Ambiguous and missing bearer characteristics must never invent counts',()=>{
 const row=asRow();
 assert.equal(magicWeaponAttackLabel(row,[]),'A-based · verify bearer');
 assert.equal(magicWeaponAttackLabel(row,[{name:'Rider',attacks:'3'},{name:'Dragon',attacks:'6'}]),
  'A-based · verify bearer');
 assert.equal(magicWeaponAttackLabel(asRow({ownerModel:'Rider'}),[
  {name:'Rider',attacks:'3'},{name:'Dragon',attacks:'6'}]),'3 shots');
 assert.equal(magicWeaponAttackLabel(asRow({ownerModel:'Unknown'}),[
  {name:'Rider',attacks:'3'}]),'A-based · verify bearer');
 assert.equal(magicWeaponAttackLabel(asRow({attackProfile:{...row.attackProfile,sourceUrl:'https://example.com'}}),
  [{name:'Commander',attacks:'3'}]),'See rules');
});
test('A regular reviewed magic bow does not borrow attacks-characteristic formula',()=>{
 assert.equal(magicWeaponAttackLabel({name:'Hunters Scorn',attackPhase:'Shooting',sourceUrl:'x'},[
  {name:'Commander',attacks:'3'}]),'See rules');
});
test('Projection carries reviewed formula through the attack summary',()=>{
 const text=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
 const army=parseArmy(text),fx=projectArmyEffects(army,null);
 const owner=army.units.find(u=>(u.selections||[]).some(s=>s.name==='Reaver Bow'));
 assert.ok(owner);
 const entry=unitAttackSummary(owner,null,null,fx.byUnit[owner.id])
  .magicWeapons.find(w=>w.name==='Reaver Bow');
 assert.equal(entry.shotsMode,'attacks-characteristic');
});

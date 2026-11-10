import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {createGameScreenModel} from '../docs/game-screen-model.js';

const fixture=name=>readFileSync(new URL('../docs/examples/'+name+'.txt',import.meta.url),'utf8');

test('v1 game model keeps imported units distinct and never modifies source text or costs',()=>{
 const army=parseArmy(fixture('owb-regular'));
 const original=JSON.stringify(army);
 const model=createGameScreenModel(army);
 assert.equal(JSON.stringify(army),original);
 assert.equal(model.totals.unitInstances,army.units.length);
 assert.equal(model.units.length,army.units.length);
 assert.deepEqual(model.units.map(u=>u.id),army.units.map(u=>u.id));
 assert.deepEqual(model.units.map(u=>u.points),army.units.map(u=>u.reportedPoints.value));
 assert.deepEqual(model.units.map(u=>u.count),army.units.map(u=>u.quantity.value));
 assert.ok(model.characters.length>0,'Characters section should be recognised');
 assert.ok(model.regiments.length>0,'Core/Special sections should stay as regiments');
 assert.ok(model.units.every(u=>Array.isArray(u.selections)));
});

test('unavailable reference data is explicit, not fabricated',()=>{
 const army=parseArmy(fixture('single-sea-guard'));
 const u=army.units[0];
 u.quantity={value:null,origin:'unknown'};
 const model=createGameScreenModel(army);
 assert.equal(model.units[0].count,null);
 assert.equal(model.units[0].referenceState,'unavailable');
 assert.deepEqual(model.units[0].profiles,[]);
 assert.equal(model.units[0].hasRulesEffects,false);
 assert.equal(model.totals.unknownModelUnitCount,1);
});

test('published base stats do not become selected equipment or effective stats',()=>{
 const army=parseArmy(fixture('single-sea-guard'));
 const id=army.units[0].id;
 const data={
  modelProfiles:[{name:'Sea Guard',characteristics:{WS:4,A:1}}],
  startingEquipment:[{name:'Warbow',sourceUrl:'https://tow.whfb.app/weapons-of-war/warbow'}],
  optionalRules:[{name:'Optional rule',sourceUrl:'https://tow.whfb.app/special-rules/optional-rule'}],
  source:{sourceUrl:'https://tow.whfb.app/unit/lothern-sea-guard',verificationStatus:'source-extracted'},
  extractionWarnings:['not reviewed']
 };
 const before=JSON.stringify(army);
 const model=createGameScreenModel(army,{[id]:data});
 const unit=model.units[0];
 assert.equal(unit.referenceState,'review-needed');
 assert.equal(unit.profiles[0].characteristics.WS,4);
 assert.equal(unit.hasRulesEffects,false);
 assert.equal(unit.published.startingEquipment[0].name,'Warbow');
 assert.ok(unit.selections.every(s=>s.name!=='Optional rule'));
 assert.equal(JSON.stringify(army),before);
});

test('unit without category stays uncategorised, never guessed as a character',()=>{
 const army=parseArmy(fixture('single-sea-guard'));
 army.units[0].sectionId=null;
 const model=createGameScreenModel(army);
 assert.equal(model.characters.length,0);
 assert.equal(model.units[0].section,'Uncategorised');
 assert.equal(model.units[0].isCharacter,false);
});

test('duplicate same-name units remain separate instances',()=>{
 const army=parseArmy(fixture('single-sea-guard'));
 const duplicate=structuredClone(army.units[0]);
 duplicate.id=duplicate.id+':second';
 duplicate.quantity={value:15,origin:'explicit'};
 army.units.push(duplicate);
 const model=createGameScreenModel(army);
 assert.equal(model.units.length,2);
 assert.equal(model.units[0].name,model.units[1].name);
 assert.notEqual(model.units[0].id,model.units[1].id);
 assert.deepEqual(model.units.map(u=>u.count),[33,15]);
});

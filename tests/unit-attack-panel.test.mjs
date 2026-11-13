import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {ownedItemEffects,ITEM_EFFECT_RULES,projectArmyEffects} from '../docs/effects-engine.js';
import {unitAttackSummary,renderUnitAttackPanel} from '../docs/unit-attack-panel.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const army=parseArmy(read('docs/examples/owb-regular.txt'));
const proj=projectArmyEffects(army,null);
const ruby=army.units.find(u=>(u.selections||[]).some(s=>s.name==='Ruby Ring of Ruin'));
const sea=army.units.find(u=>u.name==='Lothern Sea Guard');
const source=path=>JSON.parse(read(path)).records;
const seaRecord=source('docs/unit-data/shards/0f.json')['unit:lothern-sea-guard'];
const recordFor=unit=>Object.values(source('docs/unit-data/shards/0f.json'))
 .find(x=>x.source?.sourceUrl===unit.reference?.url)||null;
test('Ruby Ring attack reads verified Fireball fields and is not a normal weapon attack',()=>{
 assert.ok(ruby,'Fixture must have a selected Ruby Ring');
 const row=ownedItemEffects(army,null).find(x=>x.id==='ruby-ring-of-ruin');
 assert.equal(row.ownerId,ruby.id);
 const data=unitAttackSummary(ruby,recordFor(ruby),null,proj.byUnit[ruby.id]);
 assert.equal(data.boundSpells.length,1);
 assert.equal(data.boundSpells[0].name,'Ruby Ring of Ruin');
 assert.deepEqual(data.boundSpells[0].spell,{
  name:'Fireball',url:'https://tow.whfb.app/spell/fireball',
  powerLevel:1,phase:'Shooting',type:'Magic Missile',
  castingValue:'8+',range:'24"',hits:'2D6',strength:'4',
  armourPiercing:'–',specialRules:['Flaming Attacks']
 });
 assert.ok(data.magicWeapons.every(e=>e.name!=='Ruby Ring of Ruin'));
 assert.equal(ITEM_EFFECT_RULES['ruby-ring-of-ruin'].boundSpell.hits,'2D6');
});
test('joining a character does not give the regiment the character\'s bound-spell attack',()=>{
 assert.ok(!unitAttackSummary(sea,seaRecord,null,proj.byUnit[sea.id])
  .boundSpells.some(x=>x.name==='Ruby Ring of Ruin'));
 const inherited=[...proj.byUnit[sea.id],{
  ...proj.byUnit[ruby.id].find(x=>x.id==='ruby-ring-of-ruin'),
  shared:true,beneficiaryId:sea.id
 }];
 assert.equal(unitAttackSummary(sea,seaRecord,null,inherited).boundSpells.length,0);
});
test('source base melee characteristics stay separate from selected spell hits',()=>{
 const data=unitAttackSummary(sea,seaRecord,null,proj.byUnit[sea.id]);
 assert.deepEqual(data.melee.map(x=>x.name),['Sea Guard','Sea Master']);
 const base=data.melee[0];
 assert.equal(base.weaponSkill,'4');
 assert.equal(base.strength,'3');
 assert.equal(base.attacks,'1');
 assert.ok(!data.melee.some(x=>x.attacks==='2D6'));
});
test('selected offensive effects remain visible including regiment-shared rules',()=>{
 const original=unitAttackSummary(sea,seaRecord,null,proj.byUnit[sea.id]);
 assert.ok(original.offensiveEffects.some(x=>x.id==='razor-standard'));
 const shared={...proj.byUnit[sea.id].find(x=>x.id==='razor-standard'),shared:true,
  ownerId:'other',beneficiaryId:sea.id};
 const withShared=unitAttackSummary(sea,seaRecord,null,[shared]);
 assert.equal(withShared.offensiveEffects.length,1);
});
test('source-unsupported magic missiles and unrelated items never gain attack profiles',()=>{
 const noRing=army.units.find(u=>u.name==="Ship's Company");
 const data=unitAttackSummary(noRing,null,null,[]);
 assert.equal(data.boundSpells.length,0);
 assert.equal(data.magicWeapons.length,0);
 const forged={id:'unknown',ownerId:noRing.id,kind:'Enchanted item',status:'equipped',
  boundSpell:null};
 assert.deepEqual(unitAttackSummary(noRing,null,null,[forged]).boundSpells,[]);
});
test('attack rendering and offline support are present for every roster scope',()=>{
 const ui=read('docs/army-roster-page.js');
 const attack=read('docs/unit-attack-panel.js');
 const sw=read('docs/sw.js');
 assert.match(ui,/body\.append\(renderUnitAttackPanel\(doc,imported,record,fallback,effects,mountProfileGroups,selectedUnitRecords\)\)/);
 assert.match(ui,/content\.append\(renderUnitAttackPanel\(doc,imported,records\[entry\.id\]/);
 assert.match(ui,/heading\.append\(el\(doc,'strong','','Defence'\)\)/);
 assert.match(attack,/Not a normal weapon attack|not a normal weapon attack/);
 assert.match(attack,/renderUnitOffensiveEffects/);
 assert.match(sw,/'\.\/unit-attack-panel\.js'/);
 assert.equal(typeof renderUnitAttackPanel,'function');
});

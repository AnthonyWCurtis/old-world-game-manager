import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {applyUnitDataReferences} from '../docs/unit-data.js';
import {projectArmyEffects} from '../docs/effects-engine.js';
import {unitAttackSummary} from '../docs/unit-attack-panel.js';
import {unitEquipmentAndRules} from '../docs/unit-equipment-and-rules.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('docs/unit-data/index.json'));
const army=parseArmy(read('docs/examples/owb-regular.txt'));
applyUnitDataReferences(army,manifest);
const projection=projectArmyEffects(army,null);
const records=shard=>JSON.parse(read('docs/unit-data/shards/'+shard+'.json')).records;
const commander=records('0b')['unit:sea-guard-garrison-commander'];
const sea=records('0f')['unit:lothern-sea-guard'];
const findSelection=(unit,name)=>{
 const visit=list=>(list||[]).some(s=>s.name===name||visit(s.children));
 return visit(unit.selections);
};
const character=item=>army.units.find(u=>findSelection(u,item));
const summary=unit=>unitAttackSummary(unit,commander,null,projection.byUnit[unit.id]);

test('BSB with Hunter\'s Scorn does not offer its Longbow as a second attack',()=>{
 const bsb=character("Hunter's Scorn");
 assert.ok(bsb,'BSB fixture should import Hunter\'s Scorn');
 const result=summary(bsb);
 assert.ok(result.magicWeapons.some(x=>x.name==="Hunter's Scorn"&&x.attackPhase==='Shooting'&&x.weaponFamily==='bow'));
 assert.ok(!result.shootingWeapons.some(x=>/longbow/i.test(x.name)),'Longbow must be hidden from active attacks');
 assert.ok(result.supersededShootingWeapons.some(x=>x.name==='Longbow'));
 assert.ok(result.supersededShootingWeapons.every(x=>x.weaponFamily==='bow'));
 assert.equal(result.boundSpells.length,1,'Fireball remains a separate bound-spell attack');
 assert.equal(result.boundSpells[0].name,'Ruby Ring of Ruin');
 const equipment=unitEquipmentAndRules(bsb,commander);
 assert.ok(equipment.groups.equipment.some(x=>x.name==='Longbow'),
  'The imported Longbow must remain in equipment; attack-display filtering is read-only');
});

test('Reaver Bow and Bow of the Seafarer suppress the bearer\'s ordinary Warbow',()=>{
 for(const item of ['Reaver Bow','Bow of the Seafarer']){
  const model=character(item);
  assert.ok(model);
  const result=summary(model);
  assert.ok(result.magicWeapons.some(x=>x.name===item&&x.weaponFamily==='bow'));
  assert.equal(result.shootingWeapons.some(x=>/warbow/i.test(x.name)),false);
  assert.ok(result.supersededShootingWeapons.some(x=>/warbow/i.test(x.name)));
 }
});

test('An ordinary regiment retains its own warbows without a magic bow',()=>{
 const troop=army.units.find(u=>u.name==='Lothern Sea Guard');
 const data=unitAttackSummary(troop,sea,null,projection.byUnit[troop.id]);
 assert.equal(data.supersededShootingWeapons.length,0);
 assert.ok(data.shootingWeapons.some(x=>/warbow/i.test(x.name)));
});

test('A champion\'s magic bow must not remove the ordinary models\' missile attacks',()=>{
 const unit=army.units.find(u=>u.name==='Lothern Sea Guard');
 const championEffect={id:'test-magic-bow',ownerId:unit.id,ownerIsCharacter:false,
  kind:'Magic weapon',attackPhase:'Shooting',weaponFamily:'bow',name:'Source-backed champion bow',
  sourceUrl:'https://tow.whfb.app/magic-item/example',status:'conditional'};
 const result=unitAttackSummary(unit,sea,null,[championEffect]);
 assert.ok(result.shootingWeapons.some(x=>/warbow/i.test(x.name)),
  'Magic bow on one model cannot suppress other models\' warbows');
 assert.equal(result.supersededShootingWeapons.length,0);
});

test('Magic combat weapons, unrelated weapon classes, and foreign item effects do not suppress bows',()=>{
 const unit=character("Hunter's Scorn");
 const defaults=[{id:'combat',ownerId:unit.id,ownerIsCharacter:true,
  kind:'Magic weapon',attackPhase:'Combat',weaponFamily:'sword',name:'Magic sword',status:'conditional'}];
 const combatOnly=unitAttackSummary(unit,commander,null,defaults);
 assert.ok(combatOnly.shootingWeapons.some(x=>x.name==='Longbow'));
 const otherClass=unitAttackSummary(unit,commander,null,[{...defaults[0],
  id:'crossbow',attackPhase:'Shooting',weaponFamily:'crossbow',name:'Magic crossbow'}]);
 assert.ok(otherClass.shootingWeapons.some(x=>x.name==='Longbow'));
 const shared=unitAttackSummary(unit,commander,null,[{...defaults[0],
  id:'shared',attackPhase:'Shooting',weaponFamily:'bow',ownerId:'someone-else',shared:true}]);
 assert.ok(shared.shootingWeapons.some(x=>x.name==='Longbow'));
});

test('Shooting uses compact verified weapon profiles without a Longbow notice',()=>{
 const attack=read('docs/unit-attack-panel.js');
 const roster=read('docs/army-roster-page.js');
 assert.match(attack,/supersededShootingWeapons/);
 assert.doesNotMatch(attack,/retained in equipment, but not shown as a separate shooting attack/);
 assert.match(attack,/game-attack-magic-weapon-stats/);
 assert.match(attack,/game-attack-weapon-conditions/);
 assert.match(attack,/stat\(doc,'Range',profile\.range\)/);
 assert.match(attack,/stat\(doc,'Strength',profile\.strength\)/);
 assert.match(attack,/stat\(doc,'AP',profile\.armourPiercing\)/);
 assert.match(roster,/shownEquipment=loadout\.groups\.equipment\.filter/);
 assert.match(roster,/!inactiveWeaponUrls\.has\(item\.sourceUrl\)/);
 assert.match(roster,/mountRows,effects\)/);
 assert.match(attack,/ownerIsCharacter/);
 assert.match(attack,/section\.append\(shooting,combat\)/);
});
test('All reviewed magic weapons have faithful, source-matched attack profiles',()=>{
 const expected={
  'mathlanns-ire':['Combat','S+1','-2'],
  'hunters-scorn':['30"','5','-1'],
  'bow-of-the-seafarer':['30"','5','-3'],
  'reaver-bow':['30"','S+1','–']
 };
 const rows=projection.owned;
 for(const [id,[range,strength,ap]] of Object.entries(expected)){
  const row=rows.find(x=>x.id===id);
  assert.ok(row,'Missing source-reviewed item '+id);
  assert.deepEqual(
   [row.attackProfile.range,row.attackProfile.strength,row.attackProfile.armourPiercing],
   [range,strength,ap]
  );
  assert.equal(row.attackProfile.sourceUrl,row.sourceUrl);
  assert.equal(row.attackProfile.verifiedOn,'2026-11-12');
 }
 const bsb=summary(character("Hunter's Scorn"));
 const hunter=bsb.magicWeapons.find(x=>x.name==="Hunter's Scorn");
 assert.equal(hunter.attackProfile.range,'30"');
 assert.equal(hunter.attackProfile.strength,'5');
 assert.equal(hunter.attackProfile.armourPiercing,'-1');
});

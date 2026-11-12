import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {unitAttackSummary,renderUnitAttackPanel} from '../docs/unit-attack-panel.js';
import {selectedMissileWeapons,REVIEWED_MISSILE_WEAPONS} from '../docs/source-missile-profiles.js';
import {projectArmyEffects,ITEM_EFFECT_RULES} from '../docs/effects-engine.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const army=parseArmy(read('docs/examples/owb-regular.txt'));
const projection=projectArmyEffects(army,null);
const records=path=>JSON.parse(read(path)).records;
const seaSource=records('docs/unit-data/shards/0f.json')['unit:lothern-sea-guard'];
const sea=army.units.find(u=>u.name==='Lothern Sea Guard');
const withSource=(unit,url)=>({...unit,reference:{url}});
const ruby=army.units.find(u=>u.selections.some(s=>s.name==='Ruby Ring of Ruin'));
test('selected source-reviewed warbows belong in Shooting with published stats',()=>{
 const unit=withSource(sea,seaSource.source.sourceUrl);
 const result=selectedMissileWeapons(unit,seaSource);
 assert.equal(result.length,1);
 assert.equal(result[0].sourceUrl,'https://tow.whfb.app/weapons-of-war/warbow');
 assert.equal(result[0].range,'24"');
 assert.equal(result[0].strength,'S');
 assert.equal(result[0].armourPiercing,'–');
 const data=unitAttackSummary(unit,seaSource,null,projection.byUnit[unit.id]);
 assert.equal(data.shootingWeapons.length,1);
 assert.equal(data.melee[0].weaponSkill,'4');
 assert.equal(data.melee[0].attacks,'1');
 assert.equal(Object.keys(REVIEWED_MISSILE_WEAPONS).length,4);
});
test('missing or mismatched source reference cannot invent ordinary shooting attacks',()=>{
 const mismatch={...sea,reference:{url:'https://tow.whfb.app/unit/not-lothern-sea-guard'}};
 assert.deepEqual(selectedMissileWeapons(mismatch,seaSource),[]);
 assert.deepEqual(selectedMissileWeapons(sea,null),[]);
 const edited={...sea,selections:sea.selections.filter(x=>!/^Warbows$/i.test(x.name))};
 // Sea Guard still receives the default warbow from its verified unit profile.
 const fromDefault=selectedMissileWeapons(withSource(edited,seaSource.source.sourceUrl),seaSource);
 assert.equal(fromDefault.length,1);
 assert.ok(REVIEWED_MISSILE_WEAPONS['https://tow.whfb.app/weapons-of-war/crossbow']);
});
test('source-reviewed magic weapons have generic Shooting or Combat phase metadata',()=>{
 const phases={
  'mathlanns-ire':'Combat',
  'hunters-scorn':'Shooting',
  'bow-of-the-seafarer':'Shooting',
  'reaver-bow':'Shooting'
 };
 for(const [id,phase] of Object.entries(phases))
  assert.equal(ITEM_EFFECT_RULES[id].attackPhase,phase);
 const owned=Object.values(projection.byUnit).flat();
 for(const [id,phase] of Object.entries(phases))
  assert.ok(owned.some(x=>x.id===id&&x.attackPhase===phase),'missing '+id);
});
test('Ring Fireball remains Shooting only and never changes Combat Attacks',()=>{
 assert.ok(ruby);
 const result=unitAttackSummary(ruby,null,null,projection.byUnit[ruby.id]);
 assert.equal(result.boundSpells.length,1);
 assert.equal(result.boundSpells[0].spell.phase,'Shooting');
 assert.ok(!result.magicWeapons.some(x=>x.name==='Ruby Ring of Ruin'));
 assert.ok(!result.melee.some(x=>x.attacks==='2D6'));
});
test('unclassified magic weapons preserve reference without a guessed phase',()=>{
 const unit={id:'custom',selections:[]};
 const effect={ownerId:'custom',kind:'Magic weapon',status:'conditional',
  name:'Unknown source item',description:'Source pending',
  sourceUrl:'https://tow.whfb.app/magic-item/unknown'};
 const r=unitAttackSummary(unit,null,null,[effect]);
 assert.equal(r.magicWeapons[0].attackPhase,null);
 assert.equal(r.shootingWeapons.length,0);
});
test('UI and offline cache group Shooting before Combat, retaining shared effect context',()=>{
 const ui=read('docs/unit-attack-panel.js');
 const css=read('docs/styles.css');
 const sw=read('docs/sw.js');
 assert.match(ui,/data\.shootingWeapons/);
 assert.match(ui,/shooting\.dataset\.attackPhase='shooting'/);
 assert.match(ui,/combat\.dataset\.attackPhase='combat'/);
 assert.ok(ui.indexOf('section.append(shooting,combat)')>=0);
 assert.match(ui,/renderUnitOffensiveEffects/);
 assert.match(css,/\.game-attack-phase>/);
 assert.match(sw,/'\.\/source-missile-profiles\.js'/);
 assert.equal(typeof renderUnitAttackPanel,'function');
});

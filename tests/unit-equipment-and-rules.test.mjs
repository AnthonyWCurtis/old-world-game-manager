import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {unitEquipmentAndRules} from '../docs/unit-equipment-and-rules.js';

const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const army=parseArmy(fixture);
const source=shard=>JSON.parse(readFileSync(
 new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records;
const sea=source('0f')['unit:lothern-sea-guard'];
const ship=source('0c')['unit:ships-company'];
const seaUnit=army.units.find(u=>u.name==='Lothern Sea Guard');
const shipUnit=army.units.find(u=>u.name==="Ship's Company");
const names=(data,key)=>data.groups[key].map(x=>x.name);
const match=(items,name)=>items.filter(x=>x.name.toLowerCase()===name.toLowerCase());

test('one Sea Guard panel combines imported gear and default equipment with no duplicates',()=>{
 const data=unitEquipmentAndRules(seaUnit,sea);
 assert.equal(data.sourceVerified,true);
 for(const name of ['Hand weapons','Thrusting spears','Warbows','Light armour','Shields']){
  assert.equal(match(data.groups.equipment,name).length,1,name+' duplicated or missing');
 }
 assert.ok(names(data,'equipment').includes("The Loremaster's Cloak"));
 assert.ok(names(data,'equipment').includes('Razor Standard'));
 for(const name of ['Sea Master','Standard bearer','Musician']){
  assert.ok(names(data,'upgrades').some(x=>x.toLowerCase()===name.toLowerCase()));
 }
 assert.equal(names(data,'rules').filter(x=>x.toLowerCase()==='veteran').length,1);
 assert.equal(names(data,'rules').some(x=>x==='Valour of Ages'),false,
  'Selected Veteran replaces published Valour of Ages');
 for(const name of ['Close Order','Elven Reflexes','Martial Prowess','Naval Discipline']){
  assert.ok(names(data,'rules').includes(name),name+' should remain standard');
 }
 assert.equal(data.count,Object.values(data.groups).flat().length);
});

test('Ship\'s Company retains starting warbows unless source-backed replacements are selected',()=>{
 const base=unitEquipmentAndRules(shipUnit,ship);
 assert.ok(names(base,'equipment').some(x=>x.toLowerCase()==='warbows'));
 assert.ok(names(base,'rules').includes('Open Order'));
 assert.ok(names(base,'rules').includes('Valour of Ages'));
 assert.ok(!names(base,'rules').includes('Skirmishers'));
 const edited={...shipUnit,selections:[...shipUnit.selections,
  {name:'Thrusting spears',kind:'equipment'},
  {name:'Shields',kind:'equipment'},
  {name:'Skirmishers',kind:'option',reference:{url:'https://tow.whfb.app/unusual-formations/skirmish-formation'}}]};
 const selected=unitEquipmentAndRules(edited,ship);
 assert.ok(!names(selected,'equipment').some(x=>x.toLowerCase()==='warbows'));
 assert.ok(!names(selected,'rules').includes('Open Order'));
 assert.ok(names(selected,'rules').includes('Skirmishers'));
});

test('replacement upgrade on characters hides superseded light armour only when selected',()=>{
 const prince=source('06')['unit:prince'];
 const unit={reference:{url:prince.source.sourceUrl},selections:[]};
 const original=unitEquipmentAndRules(unit,prince);
 assert.ok(names(original,'equipment').some(x=>x.toLowerCase()==='light armour'));
 const altered=unitEquipmentAndRules({...unit,selections:[{name:'Heavy armour',kind:'equipment'}]},prince);
 assert.ok(!names(altered,'equipment').some(x=>x.toLowerCase()==='light armour'));
 assert.ok(names(altered,'equipment').includes('Heavy armour'));
});

test('unmatched and nested imported selections are preserved, never silently dropped',()=>{
 const unit={reference:{url:sea.source.sourceUrl},selections:[
  {name:'Unknown custom selection',kind:'option',matchStatus:'unmatched'},
  {name:'Standard bearer',kind:'command',children:[
   {name:'Unverified Banner',kind:'option',matchStatus:'unmatched'}]}
 ],modelGroups:[{name:'One special model',selections:[{name:'Extra weapon',
  kind:'equipment',matchStatus:'unmatched'}]}]};
 const data=unitEquipmentAndRules(unit,sea);
 assert.ok(names(data,'upgrades').includes('Unknown custom selection'));
 assert.ok(names(data,'upgrades').includes('Unverified Banner'));
 assert.ok(data.groups.equipment.some(x=>x.name==='Extra weapon'&&x.scope==='One special model'));
 assert.ok(!names(data,'rules').includes('Veteran'));
});

test('missing or wrong-origin source record never injects unverified defaults',()=>{
 const unit={reference:{url:'https://tow.whfb.app/unit/unrelated'},selections:[{name:'Unknown'}]};
 const result=unitEquipmentAndRules(unit,sea);
 assert.equal(result.sourceVerified,false);
 assert.deepEqual(names(result,'equipment'),[]);
 assert.deepEqual(names(result,'rules'),[]);
 assert.deepEqual(names(result,'upgrades'),['Unknown']);
 assert.equal(unit.selections[0].name,'Unknown');
});

test('same selected equipment and standard source link appear only once',()=>{
 const unit={reference:{url:ship.source.sourceUrl},selections:[
  {name:'Warbows',kind:'equipment',reference:{url:'https://tow.whfb.app/weapons-of-war/warbow'},matchStatus:'matched'},
  {name:'Hand weapons',kind:'equipment',matchStatus:'matched'}]};
 const result=unitEquipmentAndRules(unit,ship);
 assert.equal(names(result,'equipment').length,2);
 assert.ok(result.groups.equipment.every(x=>x.origin==='imported'));
});

test('panel integration and offline resources are present',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(ui,/unitEquipmentAndRules\(unit,record\)/);
 assert.match(ui,/Equipment & special rules/);
 assert.match(ui,/Command & other selections/);
 assert.match(ui,/army-unit-unified-loadout/);
 assert.doesNotMatch(ui,/Imported selections · /);
 assert.doesNotMatch(ui,/Published equipment & rules · /);
 assert.match(sw,/\.\/unit-equipment-and-rules\.js/);
});

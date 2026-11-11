import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {findReference} from '../docs/catalog.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {findIndexedUnit} from '../docs/unit-data.js';
import {applySourceScopedSelectionReferences,findSourceScopedSelectionReference} from '../docs/unit-selection-matcher.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';

const sourceRecord=slug=>{
 const id='unit:'+slug;
 const shard=shardForId(id);
 const data=JSON.parse(readFileSync(new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8'));
 return data.records[id];
};
const index=JSON.parse(readFileSync(new URL('../docs/unit-data/index.json',import.meta.url),'utf8'));
const submitted=readFileSync(new URL('../reports/unmatched/report-20261111T131552339Z-edefe906-ec56-4c92-8f77-0205df47e648.txt',import.meta.url),'utf8');

const example=`===
Woodland March [500 pts]
Warhammer: The Old World, Wood Elf Realms, Battle March
===
++ Characters [405 pts] ++
Orion [405 pts]
- Spear of Kurnous
++ Rare Units [95 pts] ++
Wood Elf Beast Pack [95 pts]
- 2x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
- 2x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
- 1x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
Created with "Old World Builder"`;

test('reported Orion and Spear names resolve to their exact existing tow.whfb.app pages',()=>{
 const orion=findReference('Orion','unit');
 assert.equal(orion.url,'https://tow.whfb.app/unit/orion-the-king-in-the-woods');
 assert.equal(orion.sourceStatus,'verified-on-tow');
 assert.equal(findReference('Orion the Unverified','unit'),null);
 const spear=findReference('Spear of Kurnous','selection','Orion');
 assert.equal(spear.url,'https://tow.whfb.app/magic-item/the-spear-of-kurnous');
 assert.equal(spear.parentUnit,'Orion');
 assert.equal(findReference('Spear of Kurnous','selection','Waystalker'),null);
 assert.equal(findReference('The Spear of Kurnous','selection','Waystalker'),null);
 const army=parseArmy(example);
 assert.equal(army.units[0].name,'Orion','preserve imported title, not canonicalise display text');
 assert.equal(army.units[0].reference.url,orion.url);
 assert.equal(army.units[0].selections[0].reference.url,spear.url);
 assert.equal(findIndexedUnit(army.units[0],index).id,'unit:orion-the-king-in-the-woods');
 assert.equal(sourceRecord('orion-the-king-in-the-woods').basePoints.amount,405);
});

test('three OWB wrapped Deepwood Hound selections remain three choices, not nine fragments',()=>{
 assert.ok(submitted.includes('SELECTION: 2x Deepwood Hound [Hand weapons (Claws + fangs'));
 const original=example;
 const army=parseArmy(original);
 assert.equal(army.format.exporter,'old-world-builder');
 assert.equal(army.format.layout,'regular-text');
 assert.equal(army.originalText,original,'retain exact original input including individual lines');
 assert.equal(army.army.derivedPoints.value,500);
 const pack=army.units.find(u=>u.name==='Wood Elf Beast Pack');
 assert.equal(pack.selections.length,3);
 assert.deepEqual(pack.selections.map(s=>s.name),[
  '2x Deepwood Hound','2x Deepwood Hound','1x Deepwood Hound'
 ]);
 assert.deepEqual(pack.selections.map(s=>s.line),[10,13,16]);
 assert.ok(pack.selections.every(s=>s.raw.endsWith('teeth)]')));
 assert.ok(pack.selections.every(s=>s.children.length===1));
 assert.ok(pack.selections.every(s=>s.children[0].name==='Hand weapons'));
 assert.ok(pack.selections.every(s=>s.children[0].qualifier==='Claws + fangs, tusks, teeth'));
 assert.ok(!pack.selections.some(s=>s.name==='tusks'||s.name==='teeth)]'));
 assert.equal(army.stats.unparsedLines,0);
});

test('Wood Elf Beast Pack count matches only its published Deepwood Hounds option, not generic guesses',()=>{
 const army=parseArmy(example),pack=army.units.find(u=>u.name==='Wood Elf Beast Pack');
 const record=sourceRecord('wood-elf-beast-pack');
 assert.equal(pack.reference.url,record.source.sourceUrl);
 const first=findSourceScopedSelectionReference(pack,record,pack.selections[0]);
 assert.equal(first.url,'https://tow.whfb.app/unit/deepwood-hound');
 assert.equal(first.sourceQuantity,2);
 assert.equal(first.evidence,'published-beast-pack-option');
 assert.match(first.note,/points.*not verified/i);
 const byInstance={[pack.id]:record};
 assert.equal(applySourceScopedSelectionReferences(army,byInstance).added,3);
 assert.ok(pack.selections.every(s=>s.matchStatus==='matched'));
 assert.equal(collectUnmatched(army).length,0);
 assert.equal(army.army.derivedPoints.value,500);
 assert.equal(applySourceScopedSelectionReferences(army,byInstance).added,0);
 for(const name of ['0x Deepwood Hound','4x Deepwood Hound','1x Forest Dragon']){
  assert.equal(findSourceScopedSelectionReference(pack,record,{name,kind:'option'}),null);
 }
 const wrong=sourceRecord('glade-guard');
 assert.equal(findSourceScopedSelectionReference({
  ...pack,reference:{url:wrong.source.sourceUrl}
 },wrong,pack.selections[0]),null);
 const altered=structuredClone(record);
 altered.upgradeGroups=[];
 assert.equal(findSourceScopedSelectionReference(pack,altered,pack.selections[0]),null);
});

test('unclosed or unrelated OWB bullets are not silently consumed',()=>{
 const base=`===\nUnknown [20 pts]\nWood Elf Realms\n===\n++ Core [20 pts] ++\nGlade Guard [20 pts]\n- Broken [Equipment\n- Regular separate item\n- Standard bearer\nCreated with "Old World Builder"`;
 const army=parseArmy(base);
 assert.deepEqual(army.units[0].selections.map(s=>s.name),['Broken [Equipment','Regular separate item','Standard bearer']);
 const closed=`===\nTest [20 pts]\nWood Elf Realms\n===\n++ Core [20 pts] ++\nGlade Guard [20 pts]\n- Enchanted arrows (Moonfire shot, Swiftshiver Shards)\n- Standard bearer\nCreated with "Old World Builder"`;
 const good=parseArmy(closed);
 assert.equal(good.units[0].selections.length,2);
});

test('unsupported Wood Elf choices remain unverified, never assigned invented source links',()=>{
 const army=parseArmy(`===\nUnknown [150 pts]\nWood Elf Realms\n===\n++ Characters [85 pts] ++\nWaystalker [85 pts]\n- The Briar-bow\n++ Core [65 pts] ++\n5 Glade Guard [65 pts]\n- The Kinbands of Modryn\nCreated with "Old World Builder"`);
 assert.deepEqual(collectUnmatched(army).map(s=>s.name),['The Briar-bow','The Kinbands of Modryn']);
 assert.equal(findReference('The Briar-bow','selection','Waystalker'),null);
 assert.equal(findReference('The Kinbands of Modryn','selection','Glade Guard'),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy,detectFormat} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('OWB minimalist recognizes and separates custom leading names without dropping roster entries',()=>{
 const source=read('../docs/examples/owb-minimalist-nicknames.txt');
 const format=detectFormat(source);
 assert.equal(format.exporter,'old-world-builder');
 assert.equal(format.layout,'minimalist-text');
 assert.equal(format.confidence,'high');
 const result=parseArmy(source);
 assert.equal(result.army.name.value,'Chaos Dwarfs FHv1');
 assert.equal(result.army.faction.value,'Chaos Dwarfs');
 assert.equal(result.army.reportedPoints.value,1999);
 assert.equal(result.army.derivedPoints.value,1999);
 assert.equal(result.stats.unitCount,10);
 assert.equal(result.stats.unparsedLines,0);
 assert.deepEqual(result.units.map(u=>u.name),[
  'Sorcerer-Prophet','Black Orc Warboss','Hobgoblin Khan',
  'Infernal Guard','Hobgoblin Cutthroats','Hobgoblin Cutthroats',
  'Black Orc Mob','Iron Daemon','Iron Daemon','Hobgoblin Wolf Riders'
 ]);
 assert.deepEqual(result.units.map(u=>u.nickname),[
  'Żółty Sorcerer','Black Orc Boss','Wolf Khan','Infernal Guard A',
  'ORMO','ORMO','ZOMO','Ursus','Bizon','Janosikowe Zbóje'
 ]);
 assert.deepEqual(result.units.map(u=>u.quantity.value),
  [null,null,null,16,22,22,5,null,null,5]);
 assert.deepEqual(result.units.map(u=>u.reportedPoints.value),
  [455,369,59,281,78,78,63,275,275,66]);
 assert.ok(result.units[0].selections.some(s=>s.raw==="'Bale Taurus"));
 assert.ok(result.units[1].selections.some(s=>s.raw==="'Eadbuttin' 'At"));
 assert.ok(result.units[3].selections.some(s=>s.raw==='Deathmask (champion) [Ring of Doom]'));
 assert.ok(result.units[8].selections.some(s=>s.raw==='Steam Cannonade'));
 assert.equal(result.originalText,source);
 assert.equal(result.units[4].rawHeading.includes("'ORMO'"),true);
});
test('Quoted nickname is not used as the source reference lookup name',()=>{
 const roster=parseArmy(read('../docs/examples/owb-minimalist-nicknames.txt'));
 for(const u of roster.units){
  assert.ok(u.name && !u.name.startsWith("'"));
  assert.ok(!u.selections.some(s=>s.name===u.nickname));
 }
 const debug=collectUnmatched(roster);
 assert.ok(debug.every(r=>r.unit===roster.units[r.unitOccurrence-1].name));
});
test('Quoted unit nicknames work with straight or curly quotes but not apostrophes in selections',()=>{
 const text=[
  'Sample [300 pts]',
  'Warhammer: The Old World, Chaos Dwarfs',
  '‘Polski Żółć’ 5 Hobgoblin Cutthroats, Shields - 78',
  '“Wolf Riders” 5 Hobgoblin Wolf Riders, Musician - 66',
  "'Boss's Raiders' 5 Black Orc Mob, 'Eadbuttin' 'At - 156",
  'Created with "Old World Builder"'
 ].join('\n');
 const army=parseArmy(text);
 assert.equal(army.stats.unitCount,3);
 assert.equal(army.stats.unparsedLines,0);
 assert.deepEqual(army.units.map(u=>u.nickname),['Polski Żółć','Wolf Riders',"Boss's Raiders"]);
 assert.deepEqual(army.units.map(u=>u.name),['Hobgoblin Cutthroats','Hobgoblin Wolf Riders','Black Orc Mob']);
 assert.equal(army.units[2].selections[0].raw,"'Eadbuttin' 'At");
 assert.equal(army.army.derivedPoints.value,300);
});
test('Existing unquoted imports stay unchanged and do not invent nicknames',()=>{
 const newRecruit=parseArmy(read('../docs/examples/nr-tow-footer.txt'));
 const builder=parseArmy(read('../docs/examples/owb-regular.txt'));
 assert.equal(newRecruit.units.length,9);
 assert.ok(newRecruit.units.every(u=>!u.nickname));
 assert.ok(builder.units.every(u=>!u.nickname));
});

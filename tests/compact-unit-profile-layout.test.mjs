import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');

test('model characteristics and optional selected mount profiles remain above the unified panel',()=>{
 assert.match(ui,/Model characteristics/);
 assert.match(ui,/Selected mount: /);
 assert.match(ui,/army-profile-mount-row/);
 assert.match(ui,/Published base profiles/);
});
test('one consolidated panel replaces both overlapping equipment and source disclosures',()=>{
 assert.match(ui,/unitEquipmentAndRules\(unit,record\)/);
 assert.match(ui,/army-unit-unified-loadout/);
 assert.match(ui,/Equipment & special rules/);
 assert.match(ui,/Equipment & items/);
 assert.match(ui,/Special rules/);
 assert.match(ui,/Command & other selections/);
 assert.doesNotMatch(ui,/Imported selections · /);
 assert.doesNotMatch(ui,/Published equipment & rules · /);
 assert.match(css,/\.army-unit-unified-loadout/);
});
test('all known and unknown imports remain represented, while source details stay available',()=>{
 assert.match(ui,/item\.scope\?item\.scope/);
 assert.match(ui,/army-unit-loadout-unmatched/);
 assert.match(ui,/Source details/);
 assert.match(ui,/army-unit-quick-facts/);
 assert.match(ui,/Published base cost:/);
 assert.match(ui,/Published unit\/chassis armour reference/);
});

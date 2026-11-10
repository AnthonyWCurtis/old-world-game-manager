import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArmy } from '../docs/parser.js';
import { CATALOGUE, findReference } from '../docs/catalog.js';

const read = name => readFileSync(new URL('../docs/examples/' + name + '.txt', import.meta.url), 'utf8');
const flatten = army => army.units.flatMap(u => u.selections.flatMap(s => [s, ...(s.children || [])]));

test('Marks Orges retains all 17 unit instances, costs and selections', () => {
  const result = parseArmy(read('bb-compact'));
  assert.equal(result.stats.unitCount, 17);
  assert.equal(result.army.reportedPoints.value, 2599);
  assert.equal(result.army.derivedPoints.value, 2599);
  assert.equal(result.army.limitPoints.value, 2600);
  assert.equal(result.stats.selectionCount, 74);
  assert.equal(result.stats.matchedSelections, 71);
  assert.equal(result.stats.unmatchedSelections, 0);
  assert.equal(result.stats.informationalSelections, 3);
  assert.equal(result.stats.unparsedLines, 0);
  const remaining = flatten(result).filter(s => s.matchStatus === 'unmatched');
  assert.deepEqual(remaining, []);
  const descriptors = flatten(result).filter(s => s.matchStatus === 'informational');
  assert.deepEqual(descriptors.map(s => s.name), ['On foot', 'On foot', 'On foot']);
  assert.ok(descriptors.every(s => s.reference === null));
});

test('Imported units preserve the source roster order and repeat instances', () => {
  const result = parseArmy(read('bb-compact'));
  assert.deepEqual(result.units.map(u => u.name), [
    'Ishaya Vess', 'Storm Weaver',
    'Sea Guard Garrison Commander', 'Sea Guard Garrison Commander',
    'Sea Guard Garrison Commander', 'Mage', 'Mage',
    'Lothern Sea Guard', "Ship's Company", "Ship's Company", "Ship's Company",
    'Eagle-Claw Bolt Thrower', 'Eagle-Claw Bolt Thrower',
    'Eagle-Claw Bolt Thrower', 'Eagle-Claw Bolt Thrower',
    'Lothern Skycutters', 'Lothern Skycutters'
  ]);
  assert.deepEqual(result.units.map(u => result.sections.find(s => s.id === u.sectionId)?.name), [
    ...Array(7).fill('Characters'), ...Array(4).fill('Core'), ...Array(6).fill('Special')
  ]);
  assert.deepEqual(result.units.slice(7, 11).map(u => u.quantity.value), [32, 16, 16, 16]);
  assert.deepEqual(result.units.slice(2, 5).map(u => u.reportedPoints.value), [202, 153, 283]);
  assert.ok(result.units[7].selections.map(s => s.raw).includes('Full Command'));
  assert.equal(result.units[0].selections.at(-1).raw, "Mathlann's Ire");
});

test('Only exact and parent-scoped references are linked', () => {
  assert.equal(findReference('Sea Guard', 'selection', 'Mage')?.url, 'https://tow.whfb.app/magic-item/sea-guard');
  assert.equal(findReference('Sea Guard', 'selection', 'Sea Guard Garrison Commander')?.url, 'https://tow.whfb.app/magic-item/sea-guard');
  assert.equal(findReference('Sea Guard', 'selection', 'Dragon Prince'), null);
  assert.equal(findReference('Lothern Skycutter', 'selection', 'Sea Guard Garrison Commander')?.url, 'https://tow.whfb.app/unit/lothern-skycutter');
  assert.equal(findReference('Lothern Skycutter', 'selection', 'Mage'), null);
  assert.equal(findReference('Full Command', 'selection', 'Lothern Sea Guard')?.url, 'https://tow.whfb.app/command-groups');
  assert.equal(findReference('Full Command', 'selection', 'Forsaken'), null);
  assert.equal(findReference('Repeater Bolt Thrower', 'selection', 'Eagle-Claw Bolt Thrower')?.url, 'https://tow.whfb.app/war-machines/bolt-throwers');
  assert.equal(findReference('On foot', 'selection', 'Mage'), null);
});

test('Audited references have concrete source URLs and scoped proof when needed', () => {
  const additions = CATALOGUE.filter(r => r.verifiedOn === '2026-11-09');
  assert.equal(additions.length, 29);
  for (const r of additions) {
    assert.equal(r.sourceStatus, 'verified-on-tow');
    assert.match(r.url, /^https:\/\/tow\.whfb\.app\//);
    if (r.scopeEvidenceUrl) assert.match(r.scopeEvidenceUrl, /^https:\/\/tow\.whfb\.app\//);
  }
  assert.equal(new Set(CATALOGUE.map(x => x.id)).size, CATALOGUE.length, 'Catalogue IDs must be unique');
});

test('All 24 supplied example fixtures continue to parse', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/examples/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.length, 24);
  for (const {id} of manifest) {
    const result = parseArmy(read(id));
    assert.ok(result.units.length > 0, id + ' should parse units');
    assert.equal(result.stats.unparsedLines, 0, id + ' should have no unparsed lines');
  }
});

test('Headerless TOW points-first entries preserve wrapped upgrades', () => {
  const parsed = parseArmy(read('nr-tow-wrapped'));
  assert.equal(parsed.format.exporter, 'new-recruit');
  assert.equal(parsed.format.layout, 'tow');
  assert.equal(parsed.format.confidence, 'medium');
  assert.equal(parsed.army.player.value, 'Example Player');
  assert.equal(parsed.units.length, 13);
  assert.equal(parsed.army.derivedPoints.value, 2000);
  assert.equal(parsed.army.reportedPoints.value, null);
  assert.equal(parsed.army.limitPoints.value, null);
  assert.equal(parsed.stats.unparsedLines, 0);
  const doombull = parsed.units[1];
  assert.equal(doombull.name, 'Doombull');
  assert.equal(doombull.reportedPoints.value, 360);
  assert.equal(doombull.line, 4);
  assert.ok(doombull.selections.some(s => s.raw === 'Scimitar of Skultar'));
  assert.ok(doombull.selections.some(s => s.raw === 'Full Plate Chaos Armour'));
  assert.ok(doombull.selections.some(s => s.raw === 'Icon Of Fortitude'));
  assert.ok(parsed.units[2].selections.some(s => s.raw === 'Scourge of the Burdened'));
  assert.ok(parsed.units[3].selections.some(s => s.raw === 'Vitriolic Totem'));
  assert.ok(parsed.units[5].selections.some(s => s.raw === 'Standard Bearer'));
  assert.ok(!parsed.units[1].selections.some(s => s.raw === 'Scimitar'));
});

test('Headerless TOW model groups use comma-separated upgrades', () => {
  const parsed = parseArmy(read('nr-tow-model-groups'));
  assert.equal(parsed.format.layout, 'tow');
  assert.equal(parsed.army.player.value, 'Country - Example Player (Roster)');
  assert.equal(parsed.units.length, 15);
  assert.equal(parsed.army.derivedPoints.value, 2000);
  assert.equal(parsed.stats.unparsedLines, 0);
  assert.equal(parsed.stats.modelGroupCount, 2);
  const unit = parsed.units.find(u => u.name === 'Primal Warherds');
  assert.ok(unit);
  assert.equal(unit.quantity.value, 21);
  assert.equal(unit.modelGroups.length, 2);
  assert.deepEqual(unit.modelGroups.map(g => ({name:g.name,quantity:g.quantity})),
    [{name:'Gor',quantity:11},{name:'Ungor',quantity:10}]);
  assert.deepEqual(unit.modelGroups[0].selections.map(s => s.raw),
    ['Additional Hand Weapon']);
  assert.deepEqual(unit.modelGroups[1].selections.map(s => s.raw),
    ['Thrusting Spear', 'Foe-render', 'Great Weapon', 'Standard Bearer', 'Musician']);
  assert.equal(unit.selections[0].name, 'Ambushers');
  assert.equal(parsed.units.filter(u => u.name === 'Harpies').length, 2);
});

test('Attributed New Recruit TOW maintains original duplicate units', () => {
  const parsed = parseArmy(read('nr-tow-footer'));
  assert.equal(parsed.format.exporter, 'new-recruit');
  assert.equal(parsed.format.layout, 'tow');
  assert.equal(parsed.format.confidence, 'high');
  assert.equal(parsed.format.version, '37.17');
  assert.equal(parsed.stats.unitCount, 9);
  assert.equal(parsed.army.derivedPoints.value, 1979);
  assert.equal(parsed.stats.unparsedLines, 0);
  assert.equal(parsed.units.filter(u => u.name === 'Silver Helms').length, 3);
  assert.deepEqual(parsed.units.filter(u => u.name === 'Silver Helms').map(u=>u.quantity.value), [6,6,6]);
  assert.equal(parsed.units.filter(u => u.name === 'Lothern Skycutters').length, 2);
  assert.equal(parsed.units.filter(u => u.name === 'Sisters of Avelorn').length, 2);
});

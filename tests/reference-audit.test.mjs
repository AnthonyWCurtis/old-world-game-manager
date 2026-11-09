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
  assert.equal(result.stats.unmatchedSelections, 3);
  assert.equal(result.stats.unparsedLines, 0);
  const remaining = flatten(result).filter(s => s.matchStatus === 'unmatched');
  assert.deepEqual(remaining.map(s => s.name), ['On foot', 'On foot', 'On foot']);
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
  assert.equal(additions.length, 13);
  for (const r of additions) {
    assert.equal(r.sourceStatus, 'verified-on-tow');
    assert.match(r.url, /^https:\/\/tow\.whfb\.app\//);
    if (r.scopeEvidenceUrl) assert.match(r.scopeEvidenceUrl, /^https:\/\/tow\.whfb\.app\//);
  }
  assert.equal(new Set(CATALOGUE.map(x => x.id)).size, CATALOGUE.length, 'Catalogue IDs must be unique');
});

test('All 19 supplied example fixtures continue to parse', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/examples/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.length, 19);
  for (const {id} of manifest) {
    const result = parseArmy(read(id));
    assert.ok(result.units.length > 0, id + ' should parse units');
    assert.equal(result.stats.unparsedLines, 0, id + ' should have no unparsed lines');
  }
});

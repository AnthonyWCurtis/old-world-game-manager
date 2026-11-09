import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectFormat, parseArmy} from '../docs/parser.js';

const source = readFileSync(new URL('../docs/examples/northside-warriors.txt', import.meta.url), 'utf8');

test('Footerless, sectioned bullet roster is recognised as a compatible layout, not a confirmed builder', () => {
  const detected = detectFormat(source);
  assert.equal(detected.exporter, 'old-world-builder'); // parser family, not exporter attribution
  assert.equal(detected.layout, 'regular-text');
  assert.equal(detected.confidence, 'medium');
  assert.equal(detected.evidence.includes('exporter attribution'), false);
  assert.ok(detected.evidence.some(e => e.includes('exporter not confirmed')));

  const attributed = detectFormat(source + '\nCreated with "Old World Builder"\n');
  assert.equal(attributed.exporter, 'old-world-builder');
  assert.equal(attributed.layout, 'regular-text');
  assert.equal(attributed.confidence, 'high');

  const unrelated = detectFormat('++ Characters [100 pts] ++\nThis is not a roster');
  assert.equal(unrelated.exporter, 'unknown');
  assert.equal(unrelated.layout, 'unknown');
});

test('Northside Warriors imports all original units and reconciles section and army totals', () => {
  const army = parseArmy(source);
  assert.equal(army.originalText, source);
  assert.equal(army.format.confidence, 'medium');
  assert.equal(army.army.name.value, 'Northside Warriors');
  assert.equal(army.army.faction.value, 'Chaos Dwarfs');
  assert.equal(army.army.composition.value, 'Renegade (v1.5.2.2)');
  assert.equal(army.army.gameFormat.value, 'Grand Melee + Combined Arms');
  assert.equal(army.army.reportedPoints.value, 2099);
  assert.equal(army.army.derivedPoints.value, 2099);
  assert.equal(army.stats.unitCount, 12);
  assert.equal(army.stats.selectionCount, 57); // 54 options and 3 nested upgrades
  assert.equal(army.stats.unparsedLines, 0);
  assert.deepEqual(army.sections.map(s => [s.name, s.reportedPoints.value, s.unitIds.length]), [
    ['Characters', 815, 3],
    ['Core Units', 534, 4],
    ['Special Units', 750, 5]
  ]);
  assert.deepEqual(army.units.map(u => [u.name, u.quantity.value, u.reportedPoints.value]), [
    ['Black Orc Warboss', null, 339],
    ['Despot', null, 391],
    ['Daemonsmith Sorcerer', null, 85],
    ['Black Orc Mob', 15, 310],
    ['Infernal Guard', 10, 146],
    ['Hobgoblin Cutthroats', 13, 39],
    ['Hobgoblin Cutthroats', 13, 39],
    ['Iron Daemon', null, 275],
    ['Deathshrieker Rocket Launcher', null, 110],
    ['Deathshrieker Rocket Launcher', null, 110],
    ['Bull Centaur Renders', 3, 195],
    ['Sneaky Gits', 10, 60]
  ]);
  assert.equal(new Set(army.units.map(u => u.id)).size, 12);
  assert.ok(!army.diagnostics.some(d => ['UNDETECTED_FORMAT', 'NO_UNITS', 'UNPARSED_LINE', 'ARMY_SUM_MISMATCH', 'SECTION_SUM_MISMATCH'].includes(d.code)));
});

test('Northside Warriors retains equipment quantities, character mounts and nested options', () => {
  const army = parseArmy(source);
  const warboss = army.units[0], despot = army.units[1], sorcerer = army.units[2];
  const orcs = army.units[3], guard = army.units[4];
  const hasSelection = (unit, raw) => unit.selections.some(s => s.raw === raw);
  assert.equal(warboss.selections.find(s => s.name === 'Wyvern')?.kind, 'mount-or-component');
  assert.equal(despot.selections.find(s => s.name === 'Bale Taurus')?.kind, 'mount-or-component');
  assert.ok(hasSelection(despot, 'General'));
  assert.ok(hasSelection(orcs, '15x Shields'));
  assert.ok(hasSelection(orcs, '11x Great weapon'));
  assert.equal(orcs.selections.find(s => s.name === 'Boss')?.children[0]?.name, 'Obsidian Lodestone');
  assert.equal(orcs.selections.find(s => s.name === 'Standard bearer')?.children[0]?.name, "Monster Hunter's Tapestry");
  assert.equal(sorcerer.selections.find(s => s.name === 'Wizard')?.children[0]?.name, 'Level 1 Wizard');
  assert.equal(guard.selections.find(s => s.name === 'Deathmask')?.qualifier, 'champion');
  const cutthroats = army.units.filter(u => u.name === 'Hobgoblin Cutthroats');
  const rocketLaunchers = army.units.filter(u => u.name === 'Deathshrieker Rocket Launcher');
  assert.equal(cutthroats.length, 2);
  assert.equal(rocketLaunchers.length, 2);
  assert.notEqual(cutthroats[0].id, cutthroats[1].id);
  assert.notEqual(rocketLaunchers[0].id, rocketLaunchers[1].id);
  assert.deepEqual(rocketLaunchers.map(u => u.selections.map(s => s.raw)), [
    ['Demolition Rockets', 'Infernal Incendiaries', 'Hand weapons', 'Light armour'],
    ['Demolition Rockets', 'Infernal Incendiaries', 'Hand weapons', 'Light armour']
  ]);
});

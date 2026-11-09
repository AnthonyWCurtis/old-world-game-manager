import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';

const record = JSON.parse(readFileSync(
  new URL('../docs/reference-records/high-elf-realms/ishaya-vess.json', import.meta.url), 'utf8'
));
const source = 'https://tow.whfb.app';

test('Ishaya Vess reference record preserves directly sourced identity, characteristics and fixed cost', () => {
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.recordType, 'unit');
  assert.equal(record.id, 'unit:ishaya-vess');
  assert.equal(record.name, 'Ishaya Vess');
  assert.equal(record.faction, 'High Elf Realms');
  assert.equal(record.category, 'Named Character');
  assert.deepEqual(record.troopTypes, ['Named Character', 'Regular Infantry']);
  assert.deepEqual(record.characteristics, {M:5, WS:7, BS:7, S:4, T:3, W:3, I:7, A:3, Ld:9});
  assert.deepEqual(record.baseSizeMm, {width:25, depth:25});
  assert.equal(record.unitSize, 1);
  assert.equal(record.points, 170);
  assert.equal(record.configuration.fixed, true);
  assert.deepEqual(record.configuration.availableOptions, []);
  assert.match(record.configuration.availabilitySummary, /Lothern Sea Guard/);
  assert.equal(record.source.url, source + '/unit/ishaya-vess');
  assert.equal(record.source.verificationStatus, 'verified-on-tow');
  assert.equal(record.source.verifiedOn, '2026-11-09');
  assert.equal(record.source.sourceVersion, null);
  assert.equal(record.legalityVerified, false);
  assert.equal(record.engineImplemented, false);
});

test('Every named equipment and special-rule reference uses an individually checked TOW page', () => {
  assert.deepEqual(record.equipment.map(x => x.name), [
    'Hand weapon', 'Heavy armour', 'Shield', "Mathlann's Ire", 'Warbow'
  ]);
  assert.deepEqual(record.specialRules.map(x => x.name), [
    'Commanding Voice', 'Ithilmar Weapons', 'Naval Discipline', 'Rallying Cry',
    'Strike First', 'Precision Strikes', 'Valour of Ages'
  ]);
  for (const entry of [...record.equipment, ...record.specialRules]) {
    const url = new URL(entry.url);
    assert.equal(url.origin, source);
    assert.ok(url.pathname.startsWith('/'));
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.ok(entry.summary || entry.profile, entry.name + ' requires machine-readable detail or concise interpretation');
  }
  const ire = record.equipment.find(e => e.name === "Mathlann's Ire");
  assert.equal(ire.kind, 'magic-weapon');
  assert.deepEqual(ire.profile, {range:'Combat', strength:'S+1', armourPiercing:-2});
  assert.equal(record.equipment.find(e => e.name === 'Warbow').profile.rangeInches, 24);
  assert.equal(record.equipment.find(e => e.name === 'Heavy armour').profile.armourValue, '5+');
});

test('Referenced roster fields are linked without treating source reference as legality proof', () => {
  const pasted = readFileSync(new URL('../docs/examples/owb-regular.txt', import.meta.url), 'utf8');
  const army = parseArmy(pasted);
  const ishaya = army.units.find(u => u.name === 'Ishaya Vess');
  assert.ok(ishaya);
  assert.equal(ishaya.reportedPoints.value, record.points);
  const exportedSelectionNames = ishaya.selections.map(s => s.name);
  for (const equipment of record.equipment) {
    assert.ok(exportedSelectionNames.includes(equipment.name), equipment.name);
  }
  assert.ok(record.interpretationChecks.some(x => x.topic === 'Precision Strikes' && /not automatically/.test(x.summary)));
  assert.ok(record.interpretationChecks.some(x => x.topic === "Mathlann's Ire" && /does not apply/.test(x.summary)));
  for (const check of record.interpretationChecks) {
    assert.ok(['derived', 'source-derived'].includes(check.status));
    for (const sourceUrl of check.sourceUrls) assert.equal(new URL(sourceUrl).origin, source);
  }
});

test('Published reference-record manifest discovers the Ishaya record without guessing paths', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('../docs/reference-records/manifest.json', import.meta.url), 'utf8'
  ));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceOrigin, source);
  assert.equal(manifest.records.length, 45);
  const item = manifest.records.find(entry => entry.id === record.id);
  assert.ok(item, 'Ishaya must remain discoverable as additional records are added');
  assert.equal(item.id, record.id);
  assert.equal(item.name, record.name);
  assert.equal(item.faction, record.faction);
  assert.equal(item.sourceUrl, record.source.url);
  assert.equal(item.verificationStatus, record.source.verificationStatus);
  assert.equal(item.verifiedOn, record.source.verifiedOn);
  const file = JSON.parse(readFileSync(
    new URL('../docs/reference-records/' + item.path, import.meta.url), 'utf8'
  ));
  assert.deepEqual(file, record);
});

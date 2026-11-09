import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = 'https://tow.whfb.app';
const record = JSON.parse(readFileSync(
  new URL('../docs/reference-records/high-elf-realms/korhil-lionmane.json', import.meta.url), 'utf8'
));
const manifest = JSON.parse(readFileSync(
  new URL('../docs/reference-records/manifest.json', import.meta.url), 'utf8'
));

test('Korhil Lionmane record captures his source-backed character profile and fixed equipment', () => {
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.recordType, 'unit');
  assert.equal(record.id, 'unit:korhil-lionmane');
  assert.equal(record.name, 'Korhil Lionmane');
  assert.equal(record.faction, 'High Elf Realms');
  assert.equal(record.source.url, source + '/unit/korhil-lionmane');
  assert.equal(record.source.verificationStatus, 'verified-on-tow');
  assert.equal(record.source.sourceVersion, null);
  assert.ok(record.source.verifiedOn);
  assert.equal(record.category, 'Named Character');
  assert.deepEqual(record.troopTypes, ['Named Character', 'Heavy Infantry']);
  assert.deepEqual(record.characteristics, {M:5, WS:7, BS:5, S:4, T:3, W:3, I:6, A:4, Ld:9});
  assert.deepEqual(record.baseSizeMm, {width:25, depth:25});
  assert.equal(record.unitSize, 1);
  assert.equal(record.points, 175);
  assert.equal(record.configuration.fixed, false);
  assert.equal(record.configuration.equipmentFixed, true);
  assert.equal(record.configuration.availableOptions.length, 1);
  assert.match(record.configuration.availabilitySummary, /White Lions of Chrace/);
  assert.deepEqual(record.equipment.map(e => e.name),
    ['Hand weapon', 'Chayal', 'The Pelt of Charandis', 'Heavy armour']);
  assert.equal(record.legalityVerified, false);
  assert.equal(record.engineImplemented, false);
});

test('Chayal and the Pelt retain separate verified, context-dependent effects', () => {
  const chayal = record.equipment.find(e => e.name === 'Chayal');
  assert.equal(chayal.kind, 'magic-weapon');
  assert.equal(chayal.url, source + '/magic-item/chayal');
  assert.deepEqual(chayal.profile, {range:'Combat', strength:'S+2', armourPiercing:-3});
  assert.match(chayal.summary, /re-roll natural rolls of 1 To Hit/);
  const pelt = record.equipment.find(e => e.name === 'The Pelt of Charandis');
  assert.equal(pelt.kind, 'enchanted-item');
  assert.equal(pelt.url, source + '/magic-item/the-pelt-of-charandis');
  assert.deepEqual(pelt.effects, {
    armourValueImprovementInCombat:1,
    armourValueImprovementAgainstNonMagicalShooting:2,
    armourValueMinimum:'2+',
    regeneration:'5+'
  });
  assert.equal(record.equipment.find(e => e.name === 'Heavy armour').profile.armourValue, '5+');
  assert.ok(record.interpretationChecks.some(x => x.topic === 'Chayal on charge' && /Strength 7/.test(x.summary)));
  assert.ok(record.interpretationChecks.some(x => x.topic === 'Foot armour and pelt' && /3\+/.test(x.summary)));
});

test('Character special rules and mount-only exceptions remain scoped to the correct component', () => {
  assert.deepEqual(record.specialRules.map(e => e.name), [
    'Elven Reflexes', 'Furious Charge', 'Mighty Constitution',
    'Move Through Cover', 'Stubborn', 'Valour of Ages'
  ]);
  assert.equal(record.specialRules.find(e => e.name === 'Furious Charge').appliesTo, 'Korhil, not mount');
  assert.equal(record.specialRules.find(e => e.name === 'Move Through Cover').appliesTo, 'Korhil, not mount');
  assert.ok(record.interpretationChecks.some(x => x.topic === 'Korhil-only charging rules' && x.status === 'source-derived'));
  const mount = record.mountProfiles[0];
  assert.equal(mount.id, 'mount:chieftains-chariot');
  assert.equal(mount.name, "Chieftain's Chariot");
  assert.equal(mount.sourceUrl, source + '/unit/chieftains-chariot');
  assert.equal(mount.points, 105);
  assert.equal(mount.category, 'Chariot');
  assert.equal(mount.troopType, 'Heavy Chariot');
  assert.deepEqual(mount.baseSizeMm, {width:50, depth:100});
  assert.equal(mount.armourValue, '4+');
  assert.deepEqual(mount.components, [
    {name:"Chieftain's Chariot", quantity:1, characteristics:{S:5,T:4,W:3}},
    {name:'Charioteer', quantity:1, characteristics:{WS:5,BS:4,S:4,I:4,A:1}},
    {name:'Chracian Lion', quantity:2, characteristics:{M:8,WS:5,S:4,I:4,A:2}}
  ]);
  assert.deepEqual(mount.equipment.map(e => e.appliesTo), ['Charioteer', 'Charioteer', 'Chracian Lion']);
  assert.equal(mount.specialRules.length, 8);
  assert.equal(mount.specialRules.find(e => e.name.startsWith('Armour Bane')).appliesTo, 'Chracian Lions');
  assert.equal(mount.specialRules.find(e => e.name.startsWith('Impact Hits')).appliesTo, "Chieftain's Chariot");
  const option = record.configuration.availableOptions[0];
  assert.deepEqual(option, {
    name:"Chieftain's Chariot", kind:'mount', pointsDelta:105,
    sourceUrl:mount.sourceUrl, mountProfileId:mount.id
  });
  assert.equal(record.points + option.pointsDelta, 280);
});

test('Korhil is discoverable in the static reference manifest alongside Ishaya', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceOrigin, source);
  assert.equal(manifest.records.length, 45);
  const ids = manifest.records.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(0, 2), ['unit:ishaya-vess', 'unit:korhil-lionmane']);
  const entry = manifest.records.find(item => item.id === record.id);
  assert.equal(entry.path, 'high-elf-realms/korhil-lionmane.json');
  assert.equal(entry.sourceUrl, record.source.url);
  assert.equal(entry.verificationStatus, record.source.verificationStatus);
  const loaded = JSON.parse(readFileSync(
    new URL('../docs/reference-records/' + entry.path, import.meta.url), 'utf8'));
  assert.deepEqual(loaded, record);
});

test('Korhil and the mounted profile point only to recorded TOW source URLs', () => {
  const pages = [
    record.source.url, record.configuration.sourceUrl,
    ...record.configuration.availableOptions.map(x=>x.sourceUrl),
    ...record.equipment.map(x=>x.url),
    ...record.specialRules.map(x=>x.url),
    ...record.mountProfiles.flatMap(x=>[
      x.sourceUrl,...x.equipment.map(y=>y.url),...x.specialRules.map(y=>y.url)
    ]),
    ...record.interpretationChecks.flatMap(x=>x.sourceUrls)
  ];
  for (const page of pages) {
    const u = new URL(page);
    assert.equal(u.origin, source);
    assert.match(u.pathname, /^\/(unit|magic-item|weapons-of-war|special-rules)\//);
    assert.equal(u.search, '');
    assert.equal(u.hash, '');
  }
  assert.ok(record.interpretationChecks.every(x=>['derived','source-derived'].includes(x.status)));
  assert.ok(record.mountProfiles[0].specialRules.every(x=>typeof x.summary === 'string'));
});

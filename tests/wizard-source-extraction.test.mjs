import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWizardMagic} from '../scripts/extract-wizard-magic.mjs';
import {readFileSync} from 'node:fs';

const magic=JSON.parse(readFileSync(new URL('../docs/reference-records/magic-index.json',import.meta.url),'utf8'));
const source='https://tow.whfb.app/unit/archmage';
const html=(name,base,lores,options='')=>`
 <main><h1>${name}</h1><p>Magic: ${name} is a Level ${base} Wizard who uses spells from ${lores}.</p>
 <ul>${options}</ul></main>`;

test('source-only base level, alternatives, upgrade level and points stay separate',()=>{
 const found=extractWizardMagic(html('Archmage',3,'Battle Magic, Elementalism, High Magic, or Illusion',
  '<li>Be a Level 4 Wizard +30 points</li>'),source,magic);
 assert.equal(found.baseLevel,3);
 assert.deepEqual(found.availableLores.map(x=>x.name),['Battle Magic','Elementalism','High Magic','Illusion']);
 assert.deepEqual(found.levelUpgrades,[{level:4,additionalPoints:30}]);
 assert.equal(found.availableLores[2].url,'https://tow.whfb.app/the-lores-of-magic/high-magic');
 assert.equal(found.verificationStatus,'source-page-extracted');
});

test('works for another source-backed wizard with two different upgrades',()=>{
 const found=extractWizardMagic(html('Storm Weaver',1,'Dark Magic, Elementalism, or Illusion',
 '<li>Be a Level 2 Wizard (+30 points)</li><li>Be a Level 3 Wizard (+60 points)</li>'),
 'https://tow.whfb.app/unit/storm-weaver',magic);
 assert.equal(found.baseLevel,1);
 assert.deepEqual(found.levelUpgrades,[{level:2,additionalPoints:30},{level:3,additionalPoints:60}]);
 assert.equal(found.availableLores.length,3);
});

test('does not fabricate wizard facts for absent Magic section or unknown lore',()=>{
 assert.equal(extractWizardMagic('<p>May purchase magic items</p>',source,magic),null);
 assert.equal(extractWizardMagic(html('Mage',1,'Made Up Lore'),'https://tow.whfb.app/unit/mage',magic),null);
 assert.equal(extractWizardMagic(html('Mage',1,'High Magic'),'https://example.com/unit/mage',magic),null);
 assert.equal(extractWizardMagic(html('Mage',1,'High Magic'),source,{entries:[]}),null);
});

test('does not mistake spell selection or wizard upgrades for the source base level',()=>{
 const value=extractWizardMagic(html('Mage',1,'High Magic',
 '<li>Be a Level 2 Wizard +30 points</li><li>Purchase magic items up to 50 points</li>'),
 'https://tow.whfb.app/unit/mage',magic);
 assert.equal(value.baseLevel,1);
 assert.equal(value.levelUpgrades[0].level,2);
 assert.equal(value.levelUpgrades[0].additionalPoints,30);
});

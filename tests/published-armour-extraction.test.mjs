import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractPublishedArmourValue} from '../scripts/extract-published-armour.mjs';
const sky='https://tow.whfb.app/unit/lothern-skycutter';
const bast='https://tow.whfb.app/unit/bastiladon';
const page=(name,armour)=>'<main><h1>'+name+'</h1><p>Cost: 90 points</p>'+
 '<div>Unit Size: 1</div><p>Armour Value: '+armour+'</p>'+
 '<div>Starting Equipment: shields and hand weapons</div></main>';

test('reads an explicitly published 4+ chassis armour value without computing a save',()=>{
 const value=extractPublishedArmourValue(page('Lothern Skycutter','4+'),sky);
 assert.equal(value.value,4);
 assert.equal(value.label,'4+');
 assert.equal(value.appliesTo,'published unit/chassis (model scope unverified)');
 assert.equal(value.sourceUrl,sky);
 assert.equal(value.verificationStatus,'source-page-extracted');
});
test('reads a different printed 3+ value without inferring model-specific application',()=>{
 assert.equal(extractPublishedArmourValue(page('Bastiladon','3+'),bast).value,3);
});
test('does not treat equipment, ward saves or regeneration as printed armour',()=>{
 const equipment='<div>Heavy armour grants 5+. Ward Save: 5+. Regeneration (5+).</div>';
 assert.equal(extractPublishedArmourValue(equipment,sky),null);
 assert.equal(extractPublishedArmourValue('<div>Armour Value: unknown</div>',sky),null);
 assert.equal(extractPublishedArmourValue('<div>Armour Value: 4+ Armour Value: 5+</div>',sky),null);
});
test('does not trust external, modified, or missing source URLs',()=>{
 const html=page('Chariot','4+');
 assert.equal(extractPublishedArmourValue(html,'https://evil.invalid/unit/lothern-skycutter'),null);
 assert.equal(extractPublishedArmourValue(html,sky+'?edit=1'),null);
 assert.equal(extractPublishedArmourValue(html,sky+'#top'),null);
 assert.equal(extractPublishedArmourValue(null,sky),null);
});
test('printed armour remains a display-only source fact, not an automatic defence engine input',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const defence=readFileSync(new URL('../docs/defence-engine.js',import.meta.url),'utf8');
 const refresh=readFileSync(new URL('../scripts/refresh-source-profiles.mjs',import.meta.url),'utf8');
 assert.match(ui,/Published unit\/chassis armour reference/);
 assert.match(ui,/sourcePrintedArmour\(record,fallback\)/);
 assert.match(refresh,/armourReview/);
 assert.match(refresh,/extractPublishedArmourValue\(html,job\.url\)/);
 assert.doesNotMatch(defence,/publishedArmour/);
});

test('accepts a labelled source value split across HTML elements',()=>{
 const html='<section><div><strong>Armour Value:</strong><span>4+</span></div></section>';
 assert.equal(extractPublishedArmourValue(html,sky)?.value,4);
});
test('ignores script-injected armour values and refuses ambiguous published text',()=>{
 const script='<script>const hint="Armour Value: 4+";</script><div>Ward Save: 5+</div>';
 assert.equal(extractPublishedArmourValue(script,sky),null);
 const ambiguous='<p>Armour Value: 4+</p><p>Armour Value: 3+</p>';
 assert.equal(extractPublishedArmourValue(ambiguous,sky),null);
});

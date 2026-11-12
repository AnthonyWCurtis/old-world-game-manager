import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');

test('the characteristics table remains the primary model data, with optional mount rows',()=>{
 assert.match(ui,/Model characteristics/);
 assert.match(ui,/Selected mount: /);
 assert.match(ui,/army-profile-mount-row/);
 assert.match(ui,/Published base profiles/);
});
test('imported selections and published source rules are native collapsible sections',()=>{
 assert.match(ui,/el\(doc,'details','army-import-selections army-unit-compact-details'\)/);
 assert.match(ui,/Imported selections · /);
 assert.match(ui,/el\(doc,'details','army-unit-source-details army-unit-compact-details'\)/);
 assert.match(ui,/Published equipment & rules · /);
 assert.match(ui,/el\(doc,'details','army-unit-compact-details army-source-meta-details'\)/);
 assert.match(ui,/Unit source details/);
 assert.match(css,/\.army-unit-compact-details>summary/);
});
test('source-backed default rules and selected upgrades remain inside disclosures',()=>{
 assert.match(ui,/chosenBody\.append\(list\)/);
 assert.match(ui,/chosenBody\.append\(groupArea\)/);
 assert.match(ui,/chosen\.append\(chosenBody\)/);
 assert.match(ui,/\['Standard special rules',record\.startingRules\]/);
 assert.match(ui,/\['Selected optional special rules — review conditions',selectedOptionalRules\]/);
 assert.match(ui,/sourceRefRow\(doc,heading,refs\)/);
 assert.match(ui,/if\(wasOpen\)extra\.open=true/);
});

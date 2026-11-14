import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const roster=source('docs/army-roster-page.js');
const html=source('docs/index.html');
const css=source('docs/styles.css');

test('single-page roster avoids redundant unit navigation guidance',()=>{
 assert.doesNotMatch(roster,/Swipe the table sideways to see all characteristics/);
 assert.doesNotMatch(roster,/army-profile-swipe/);
 assert.doesNotMatch(html,/Select a unit to view its complete profile, attacks, defence and effects/);
 assert.equal((html.match(/Select a unit to view its complete profile, attacks, defence and effects/g)||[]).length,0);
 assert.match(roster,/scroller\.setAttribute\('role','region'\)/);
 assert.match(roster,/scroller\.tabIndex=0/);
});

test('troop type and base size remain directly beneath characteristics table',()=>{
 const table=roster.indexOf('table.append(tbody);scroller.append(table);details.append(scroller);');
 const facts=roster.indexOf("details.append(el(doc,'p','army-unit-quick-facts'");
 assert.ok(table>=0&&facts>table);
 assert.match(roster,/record\.classification\?\.troopType\?\.length/);
 assert.match(roster,/record\.classification\?\.baseSize/);
 assert.match(css,/\.army-unit-quick-facts/);
});

test('no redundant source-details panel, published base cost or routine extraction note',()=>{
 assert.doesNotMatch(roster,/sourceNotes/);
 assert.doesNotMatch(roster,/Published base cost:/);
 assert.doesNotMatch(roster,/Source-extracted; selected upgrades and army legality not verified/);
 assert.doesNotMatch(roster,/army-source-meta-details/);
 assert.doesNotMatch(roster,/source\.basePoints/);
 assert.match(roster,/if\(record\?\.extractionWarnings\?\.length\)/);
 assert.match(roster,/Published profile may be incomplete/);
 assert.match(roster,/army-unit-source-warning/);
 assert.match(css,/\.army-unit-source-warning/);
});

test('published source data and its base points remain intact for debugging',()=>{
 const record=JSON.parse(source('docs/unit-data/shards/0f.json')).records['unit:lothern-sea-guard'];
 assert.equal(record.basePoints.sourceText,'10 points per model');
 assert.equal(record.source.verificationStatus,'source-extracted');
 assert.equal(record.source.sourceUrl,'https://tow.whfb.app/unit/lothern-sea-guard');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const roster=source('docs/army-roster-page.js');
const html=source('docs/index.html');
const css=source('docs/styles.css');

test('table guidance is only at the Units screen level',()=>{
 assert.doesNotMatch(roster,/Swipe the table sideways to see all characteristics/);
 assert.doesNotMatch(roster,/army-profile-swipe/);
 assert.match(html,/Wide characteristics tables can be swiped sideways/);
 assert.equal((html.match(/Wide characteristics tables can be swiped sideways/g)||[]).length,1);
 assert.match(roster,/scroller\.setAttribute\('role','region'\)/);
 assert.match(roster,/scroller\.tabIndex=0/);
});

test('troop type and base size are concise, present after model stats, and never repeated in source disclosure',()=>{
 const posTable=roster.indexOf('table.append(tbody);scroller.append(table);details.append(scroller);');
 const posQuick=roster.indexOf("details.append(el(doc,'p','army-unit-quick-facts'");
 const posSource=roster.indexOf("const sourceNotes=el(doc,'details','army-unit-compact-details army-source-meta-details')");
 assert.ok(posTable>=0&&posQuick>posTable&&posSource>posQuick);
 assert.match(roster,/record\.classification\?\.troopType\?\.length/);
 assert.match(roster,/record\.classification\?\.baseSize/);
 assert.match(css,/\.army-unit-quick-facts/);
});

test('published base cost and source review details stay available but collapsed by default',()=>{
 assert.match(roster,/record\.basePoints\?\.sourceText/);
 assert.match(roster,/Published base cost:/);
 assert.match(roster,/Source-extracted; selected upgrades and army legality not verified/);
 assert.match(roster,/Source details · '\+warnings\+' review flag\(s\)'/);
 assert.match(roster,/sourceNotes\.append\(sourceNotesBody\)/);
 assert.doesNotMatch(roster,/sourceNotes\.open=true/);
});

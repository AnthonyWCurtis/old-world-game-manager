import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {
 buildRosterSnapshot,validateRosterSnapshot,ROSTER_SESSION_KEY,IMPORT_RESTORE_KEY
} from '../docs/army-roster-snapshot.js';
const example=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');

test('Single Sea Guard becomes a self-contained roster entry with exact model count, points and selections',()=>{
 const army=parseArmy(example('single-sea-guard'));
 const source=buildRosterSnapshot(army);
 validateRosterSnapshot(source);
 assert.equal(source.kind,'game-manager-army-roster');
 assert.equal(source.schemaVersion,1);
 assert.equal(source.units.length,1);
 assert.equal(source.units[0].name,'Lothern Sea Guard');
 assert.equal(source.units[0].quantity,33);
 assert.equal(source.units[0].points,387);
 assert.equal(source.army.calculatedPoints,387);
 assert.equal(source.units[0].ordinal,1);
 assert.equal(source.units[0].sectionName,'Core Units');
 assert.equal(typeof source.units[0].id,'string');
 assert.ok(source.units[0].selections.length);
 assert.equal(Object.hasOwn(source,'originalText'),false);
 assert.equal(Object.hasOwn(source.army,'player'),false);
});
test('Versioned handoff preserves imported unit order, duplicate unit instances, and actual model groups',()=>{
 const army=parseArmy(example('nr-tow-model-groups'));
 const source=validateRosterSnapshot(buildRosterSnapshot(army));
 assert.equal(source.units.length,army.units.length);
 assert.deepEqual(source.units.map(x=>x.name),army.units.map(x=>x.name));
 assert.deepEqual(source.units.map(x=>x.quantity),army.units.map(x=>x.quantity.value));
 assert.deepEqual(source.units.map(x=>x.points),army.units.map(x=>x.reportedPoints.value));
 assert.deepEqual(source.units.map(x=>x.reference?.url??null),
  army.units.map(x=>x.reference?.url??null));
 assert.deepEqual(source.units.map(x=>x.modelGroups.length),army.units.map(x=>x.modelGroups.length));
 assert.ok(source.units.some(x=>x.modelGroups.length>0));
 assert.equal(new Set(source.units.map(u=>u.id)).size,source.units.length);
 assert.deepEqual(source.units.map(x=>x.ordinal),source.units.map((x,i)=>i+1));
});
test('Unheaded New Recruit TOW source uses actual calculated points without inventing unknown model counts',()=>{
 const army=parseArmy(example('nr-tow'));
 const source=validateRosterSnapshot(buildRosterSnapshot(army));
 assert.equal(source.army.calculatedPoints,1999);
 assert.equal(source.units.length,8);
 assert.equal(source.army.faction,'Faction not specified');
 const character=source.units.find(x=>x.name==='Archmage');
 assert.ok(character);
 assert.equal(character.quantity,null);
 assert.equal(character.points,500);
 assert.equal(source.units.filter(x=>x.quantity===null).length>0,true);
 assert.ok(source.units.every(x=>x.sectionName));
});
test('Unknown model quantities remain null, not a made-up 1, while sections retain original order',()=>{
 const army=parseArmy(example('owb-regular'));
 const source=buildRosterSnapshot(army);
 const unknown=source.units.find(x=>x.quantity===null);
 assert.ok(unknown,'Test list should have at least one uncounted character');
 assert.equal(unknown.points,army.units.find(u=>u.id===unknown.id).reportedPoints.value);
 assert.deepEqual(source.units.map(x=>x.sectionId),army.units.map(u=>u.sectionId));
 assert.deepEqual(source.units.map(x=>x.sectionName),
  army.units.map(u=>army.sections.find(s=>s.id===u.sectionId)?.name||'Army units'));
});
test('Transfer stays in same-tab session keys; invalid, missing, or duplicate entries fail closed',()=>{
 assert.notEqual(ROSTER_SESSION_KEY,IMPORT_RESTORE_KEY);
 assert.match(ROSTER_SESSION_KEY,/roster-view/);
 assert.match(IMPORT_RESTORE_KEY,/import-return/);
 assert.throws(()=>buildRosterSnapshot({units:[]}),/Import an army/);
 assert.throws(()=>validateRosterSnapshot(null),/valid army roster/);
 const snapshot=buildRosterSnapshot(parseArmy(example('single-sea-guard')));
 assert.throws(()=>validateRosterSnapshot({...snapshot,schemaVersion:2}),/valid army roster/);
 assert.throws(()=>validateRosterSnapshot({...snapshot,units:[snapshot.units[0],snapshot.units[0]]}),/incomplete/);
 assert.throws(()=>validateRosterSnapshot({...snapshot,units:[{...snapshot.units[0],quantity:-1}]}),/incomplete/);
});
test('Dedicated roster has real navigation, profile stats, source caveat, and mobile-safe styles',()=>{
 const html=readFileSync(new URL('../docs/army-roster.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../docs/army-roster.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/army-roster.js',import.meta.url),'utf8');
 const importHtml=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const importJs=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 assert.match(importHtml,/id="viewRosterBtn"/);
 assert.match(importHtml,/View Army Roster/);
 assert.match(importHtml,/Browser Edition v0\.4\.7/);
 assert.match(importHtml,/app\.js\?v=0\.4\.7/);
 assert.match(importJs,/buildRosterSnapshot\(current\)/);
 assert.match(importJs,/window\.location\.assign\('\.\/army-roster\.html'\)/);
 assert.match(importJs,/restoreFromRoster\(\)/);
 assert.match(html,/army-roster\.js\?v=0\.4\.7/);
 assert.match(html,/id="rosterUnits"/);
 assert.match(html,/id="totalPoints"/);
 assert.match(html,/id="knownModels"/);
 assert.match(html,/id="unitSearch"/);
 assert.match(html,/index\.html\?restore=roster/);
 assert.match(html,/base characteristics/);
 assert.match(js,/getUnitDetails\(army,index\)/);
 assert.match(js,/applyUnitDataReferences\(army,index\)/);
 assert.match(js,/window\.print\(\)/);
 assert.match(js,/const STAT_NAMES=\['M','WS','BS','S','T','W','I','A','Ld'\]/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/\.stat-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.ok(!js.includes('innerHTML'),'Avoid rendering untrusted roster selections as HTML');
});

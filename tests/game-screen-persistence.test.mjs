import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreStoredImport} from '../docs/army-state.js';

const fixture=readFileSync(new URL('../docs/examples/single-sea-guard.txt',import.meta.url),'utf8');

test('restore version 0.5 saved data without mutating imported selections or points',()=>{
 const parsed=parseArmy(fixture);
 const row={id:'legacy-1',original_text:fixture,result:parsed};
 const original=JSON.stringify(row);
 const restored=restoreStoredImport(row);
 assert.notEqual(restored,parsed);
 assert.equal(restored.originalText,fixture);
 assert.equal(restored.units.length,1);
 assert.deepEqual(restored.units[0].selections,parsed.units[0].selections);
 assert.equal(restored.units[0].reportedPoints.value,parsed.units[0].reportedPoints.value);
 assert.equal(JSON.stringify(row),original);
});

test('old snapshot with original_text but no result.originalText has a safe in-memory fallback',()=>{
 const result=parseArmy(fixture);
 delete result.originalText;
 const row={id:'old',original_text:fixture,result};
 const restored=restoreStoredImport(row);
 assert.equal(restored.originalText,fixture);
 assert.equal(row.result.originalText,undefined);
});

test('corrupted or empty saved rows fail clearly without guessing missing units',()=>{
 assert.throws(()=>restoreStoredImport({}),/Saved army/);
 assert.throws(()=>restoreStoredImport({result:{army:{}}}),/Saved army/);
});

test('saved-army open action enters Game Screen, and Game Screen has save control',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 assert.match(html,/id="gameScreenSaveBtn"/);
 assert.match(app,/restoreStoredImport/);
 assert.match(app,/gameScreenSaveBtn/);
 assert.match(app,/openArmyRoster\(\)/);
});

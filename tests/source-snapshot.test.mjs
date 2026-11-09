import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {applyProfileReferences,selectPublishedUnitProfiles,mergeUnitProfiles} from '../docs/live-source.js';
import {parseModelNames} from '../scripts/refresh-source-profiles.mjs';

const fixture=readFileSync(new URL('../docs/examples/nr-tow-footer.txt',import.meta.url),'utf8');
const url='https://tow.whfb.app/unit/silver-helms';
const models=['Silver Helm','High Helm','Barded Elven Steed'].map(name=>({name}));
test('Actual public table class and structure yields champion alongside base model',()=>{
 const sample='<table class="generic-table unit-profile-table css-1hz7skb" data-test-id="cf-ui-table">'+
 '<thead><tr><th></th><th>M</th><th>WS</th></tr></thead><tbody>'+
 '<tr><td>Silver Helm</td><td>-</td><td>4</td></tr>'+
 '<tr><td>High Helm</td><td>-</td><td>4</td></tr>'+
 '<tr><td>Barded Elven Steed</td><td>8</td><td>3</td></tr></tbody></table>';
 assert.deepEqual(parseModelNames(sample),models.map(m=>m.name));
});
test('Published names from the real unit URL match High Helm in all three units',()=>{
 const army=parseArmy(fixture);
 const before=army.units.map(u=>[u.name,u.reportedPoints.value]);
 const report={schemaVersion:2,sourceOrigin:'https://tow.whfb.app',profiles:{
  [url]:{url,source:'tow.whfb.app',schemaVersion:2,
   verificationStatus:'source-extracted',sourceCheckedAt:'2026-11-09T18:01:00Z',models}
 }};
 const filtered=selectPublishedUnitProfiles(army,report);
 assert.deepEqual(Object.keys(filtered),[url]);
 const oldWeak={[url]:{url,schemaVersion:1,models:[]}};
 const combined=mergeUnitProfiles(filtered,oldWeak);
 assert.equal(combined[url].models.length,3);
 const initialUnmatched=army.stats.unmatchedSelections;
 const change=applyProfileReferences(army,combined);
 assert.equal(change.added,3);
 for(const helm of army.units.filter(u=>u.name==='Silver Helms')){
  const high=helm.selections.find(s=>s.name==='High Helm');
  assert.equal(high.matchStatus,'matched');
  assert.equal(high.reference.url,url);
  assert.equal(high.reference.source,'unit-profile');
 }
 assert.deepEqual(army.units.map(u=>[u.name,u.reportedPoints.value]),before);
 assert.equal(army.stats.unmatchedSelections,initialUnmatched-3); // only these three were resolved
});
test('Only source-extracted, URL-matching records can mark a selection as matched',()=>{
 const army=parseArmy(fixture);
 const base={schemaVersion:2,sourceOrigin:'https://tow.whfb.app'};
 const fake={url,source:'unverified',verificationStatus:'source-extracted',models};
 const wrong={url:'https://example.com/other',source:'tow.whfb.app',verificationStatus:'source-extracted',models};
 assert.deepEqual(selectPublishedUnitProfiles(army,{...base,profiles:{[url]:fake}}),{});
 assert.deepEqual(selectPublishedUnitProfiles(army,{...base,profiles:{[url]:wrong}}),{});
});

test('Published snapshot contains the actual Silver Helms champion sourced from TOW',()=>{
 const snapshot=JSON.parse(readFileSync(new URL('../docs/source-profiles.json',import.meta.url),'utf8'));
 assert.equal(snapshot.sourceOrigin,'https://tow.whfb.app');
 const profile=snapshot.profiles[url];
 assert.ok(profile,'Silver Helms data must be present in the generated source snapshot');
 assert.equal(profile.verificationStatus,'source-extracted');
 assert.ok(profile.sourceCheckedAt);
 assert.deepEqual(profile.models.map(m=>m.name),[
  'Silver Helm','High Helm','Barded Elven Steed'
 ]);
});

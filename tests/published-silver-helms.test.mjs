import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {selectPublishedUnitProfiles,mergeUnitProfiles,applyProfileReferences} from '../docs/live-source.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Published TOW Silver Helms source links every High Helm in the actual points-first import',()=>{
 const army=parseArmy(read('../docs/examples/nr-tow-footer.txt'));
 assert.equal(army.format.layout,'tow');
 assert.equal(army.units.filter(u=>u.name==='Silver Helms').length,3);
 const snapshot=JSON.parse(read('../docs/source-profiles.json'));
 const profiles=selectPublishedUnitProfiles(army,snapshot);
 const unitUrl='https://tow.whfb.app/unit/silver-helms';
 assert.equal(profiles[unitUrl]?.url,unitUrl);
 assert.ok(profiles[unitUrl].models.some(m=>m.name==='High Helm'));
 const originalNames=army.units.map(u=>u.name);
 const originalPoints=army.army.derivedPoints.value;
 const result=applyProfileReferences(army,mergeUnitProfiles(profiles,{}));
 assert.ok(result.added>=3);
 for(const u of army.units.filter(u=>u.name==='Silver Helms')){
  const highHelm=u.selections.find(s=>s.name==='High Helm');
  assert.equal(highHelm.matchStatus,'matched');
  assert.equal(highHelm.reference?.url,unitUrl);
  assert.equal(highHelm.reference?.source,'unit-profile');
 }
 assert.deepEqual(army.units.map(u=>u.name),originalNames);
 assert.equal(army.army.derivedPoints.value,originalPoints);
});
test('Versioned browser app loads the published source profile fallback on imports',()=>{
 const html=read('../docs/index.html');
 const app=read('../docs/app.js');
 const live=read('../docs/live-source.js');
 assert.match(html,/Browser Edition v0\.3\.2/);
 assert.match(html,/app\.js\?v=0\.3\.2/);
 assert.match(app,/live-source\.js\?v=0\.2\.9/);
 assert.match(app,/getPublishedUnitProfiles\(army\)/);
 assert.match(app,/applyProfileReferences\(army,sourceProfiles\)/);
 assert.match(live,/source-profiles\.json\?v=0\.2\.9/);
});

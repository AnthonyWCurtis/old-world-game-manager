import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {modelCountLabel,rosterOverview,PROFILE_COLUMNS,renderArmyRosterPage} from '../docs/army-roster-page.js';
import {applyUnitDataReferences} from '../docs/unit-data.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';
const base=new URL('../docs/',import.meta.url);
const text=id=>readFileSync(new URL('examples/'+id+'.txt',base),'utf8');
const manifest=JSON.parse(readFileSync(new URL('unit-data/index.json',base),'utf8'));
const source=slug=>{
 const id='unit:'+slug;
 const shard=shardForId(id);
 return JSON.parse(readFileSync(new URL('unit-data/shards/'+shard+'.json',base),'utf8')).records[id];
};
test('Published characteristic columns have complete nine-value Warhammer profiles',()=>{
 assert.deepEqual(PROFILE_COLUMNS,['M','WS','BS','S','T','W','I','A','Ld']);
 const sea=source('lothern-sea-guard');
 assert.equal(sea.modelProfiles.length,2);
 assert.equal(sea.modelProfiles[0].name,'Sea Guard');
 assert.equal(sea.modelProfiles[1].name,'Sea Master');
 assert.deepEqual(PROFILE_COLUMNS.map(k=>sea.modelProfiles[0].characteristics[k]),[5,4,4,3,3,1,4,1,8]);
 assert.deepEqual(PROFILE_COLUMNS.map(k=>sea.modelProfiles[1].characteristics[k]),[5,4,5,3,3,1,4,2,8]);
});
test('Single Sea Guard import is a 33-model, 387-point card with two source model profiles',()=>{
 const army=parseArmy(text('single-sea-guard'));
 applyUnitDataReferences(army,manifest);
 assert.equal(army.units.length,1);
 const unit=army.units[0];
 assert.equal(unit.name,'Lothern Sea Guard');
 assert.equal(unit.reference?.url,'https://tow.whfb.app/unit/lothern-sea-guard');
 assert.equal(modelCountLabel(unit),'33 models');
 const overview=rosterOverview(army,{[unit.id]:source('lothern-sea-guard')});
 assert.deepEqual(overview,{
  unitInstances:1,knownModelCount:33,unknownModelUnitCount:0,
  availableProfiles:1,displayedTotal:387,declaredTotal:387
 });
});
test('Original army list order, duplicate entries, imported prices and section totals remain source-driven',()=>{
 const army=parseArmy(text('owb-regular'));
 applyUnitDataReferences(army,manifest);
 const before=JSON.stringify(army);
 const overview=rosterOverview(army);
 assert.equal(overview.unitInstances,army.units.length);
 assert.equal(overview.knownModelCount,
  army.units.filter(u=>Number.isInteger(u.quantity.value)).reduce((sum,u)=>sum+u.quantity.value,0));
 assert.equal(overview.unknownModelUnitCount,
  army.units.filter(u=>u.quantity.value===null).length);
 assert.equal(overview.availableProfiles,0);
 assert.equal(JSON.stringify(army),before);
 assert.ok(army.units.some(u=>u.sectionId!=null));
});
test('Explicit zero/one counts work and unknown model numbers remain unknown',()=>{
 assert.equal(modelCountLabel({quantity:{value:1,origin:'explicit'}}),'1 model');
 assert.equal(modelCountLabel({quantity:{value:12,origin:'explicit'}}),'12 models');
 assert.equal(modelCountLabel({quantity:{value:0,origin:'explicit'}}),'0 models');
 assert.equal(modelCountLabel({quantity:{value:null,origin:'unknown'}}),'Count not stated');
 assert.equal(modelCountLabel({quantity:{value:'10',origin:'unknown'}}),'Count not stated');
 assert.equal(modelCountLabel({quantity:{value:-1,origin:'unknown'}}),'Count not stated');
 assert.equal(modelCountLabel({}),'Count not stated');
});
test('New Recruit model group quantities are preserved and counted only from importer evidence',()=>{
 const army=parseArmy(text('nr-tow-model-groups'));
 const grouped=army.units.filter(u=>u.modelGroups?.length);
 assert.ok(grouped.length,'Fixture must contain model groups');
 for(const u of grouped){
  const n=u.modelGroups.reduce((sum,g)=>sum+g.quantity,0);
  if(u.quantity.value===n)assert.equal(modelCountLabel(u),n+(n===1?' model':' models'));
  else assert.equal(modelCountLabel(u),String(u.quantity.value)+' models');
 }
 const before=JSON.stringify(army);
 const total=rosterOverview(army).displayedTotal;
 assert.equal(total,army.army.derivedPoints.value);
 assert.equal(JSON.stringify(army),before);
});
test('No populated source records means no fabricated stats, quantities or costs',()=>{
 const army=parseArmy(text('nr-tow'));
 const u=army.units[0];
 u.quantity={value:null,origin:'unknown',line:null};
 u.reportedPoints={value:null,origin:'unknown',line:null};
 const overview=rosterOverview(army,{});
 assert.equal(overview.availableProfiles,0);
 assert.ok(overview.unknownModelUnitCount>0);
 assert.equal(modelCountLabel(u),'Count not stated');
});
test('Browser route, action, back buttons and data refresh wiring are present',()=>{
 const html=readFileSync(new URL('index.html',base),'utf8');
 const app=readFileSync(new URL('app.js',base),'utf8');
 const css=readFileSync(new URL('styles.css',base),'utf8');
 assert.match(html,/v1 Game Screen preview/);
 for(const id of ['importPage','armyRosterPage','viewRosterBtn','backToImporterBtn',
  'backToImporterBottomBtn','armyRosterHeading','armyRosterSummary','armyRosterList',
  'armyRosterDataStatus']){
  assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
 }
 assert.match(html,/Enter Game Screen/);
 assert.ok(app.includes("renderArmyRosterPage($('armyRosterList')")&&
  app.includes('magicIndex,state.expandedUnits,handleUnitFoldChange,effectProjection,handleItemEffectState)'));
 assert.match(app,/window\.location\.hash='army-roster'/);
 assert.match(app,/window\.addEventListener\('hashchange'/);
 assert.match(app,/backToImporterBottomBtn/);
 assert.match(app,/appVersion:'1\.0\.0-alpha\.5'/);
 assert.match(html,/app\.js\?v=1\.0\.0-alpha\.5/);
 assert.match(app,/army-roster-page\.js\?v=1\.0\.0-alpha\.5/);
 assert.match(css,/\.army-profile-scroll\{[^}]*overflow-x:auto/);
 assert.match(css,/\.army-launch-button\{[^}]*min-height:48px/);
});
test('Roster rendering depends only on local parsed records, never executes a source-side network request',()=>{
 assert.equal(typeof renderArmyRosterPage,'function');
 const js=readFileSync(new URL('army-roster-page.js',base),'utf8');
 assert.doesNotMatch(js,/\bfetch\(/);
 assert.doesNotMatch(js,/innerHTML/);
 assert.match(js,/textContent/);
 assert.match(js,/origin!==SOURCE_ORIGIN/);
});

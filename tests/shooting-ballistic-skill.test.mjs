import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {unitAttackSummary} from '../docs/unit-attack-panel.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const army=parseArmy(read('docs/examples/owb-regular.txt'));
const records=shard=>JSON.parse(read('docs/unit-data/shards/'+shard+'.json')).records;
const sea=army.units.find(u=>u.name==='Lothern Sea Guard');
const seaRecord=records('0f')['unit:lothern-sea-guard'];
const company=army.units.find(u=>u.name==="Ship's Company");
const companyRecord=records('0c')['unit:ships-company'];

test('Shooting projects source-published BS separately for regular model and selected champion',()=>{
 const result=unitAttackSummary(sea,seaRecord,null,[]);
 assert.deepEqual(result.shootingModels,[
  {name:'Sea Guard',ballisticSkill:'4'},
  {name:'Sea Master',ballisticSkill:'5'}
 ]);
 assert.equal(result.melee[0].weaponSkill,'4');
 assert.equal(result.melee[1].attacks,'2');
});

test('unselected champion alternatives are not invented as extra shooters',()=>{
 const data=unitAttackSummary(company,companyRecord,null,[]);
 assert.deepEqual(data.shootingModels,[{name:"Ship's Company",ballisticSkill:'4'}]);
 assert.equal(data.shootingModels.some(x=>x.name==='Midshipman'||x.name==='Bosun'),false);
});

test('unknown and missing BS remain unresolved, not inferred from WS or weapon Strength',()=>{
 const bareUnit={id:'minimal',selections:[]};
 const result=unitAttackSummary(bareUnit,{
  modelProfiles:[{name:'Unknown crew',characteristics:{WS:5,S:4,A:2}}]
 },null,[]);
 assert.deepEqual(result.shootingModels,[{name:'Unknown crew',ballisticSkill:'—'}]);
 const empty=unitAttackSummary(bareUnit,null,null,[]);
 assert.deepEqual(empty.shootingModels,[]);
});

test('the Shooting section displays labelled BS only from published model rows',()=>{
 const source=read('docs/unit-attack-panel.js');
 assert.match(source,/const shootingModels=profiles\.map/);
 assert.match(source,/profile\.characteristics\?\.BS/);
 assert.match(source,/game-attack-ballistic-skill/);
 assert.match(source,/stat\(doc,'BS',profile\.ballisticSkill\)/);
 assert.match(source,/shooting\.append\(group\)/);
 assert.match(source,/Ballistic Skill/);
 assert.match(source,/Bound Spells use casting instead/);
 assert.match(source,/data\.shootingModels\.some\(profile=>profile\.ballisticSkill!=='—'\)/);
 assert.doesNotMatch(source,/stat\(doc,'BS',spell\./);
});

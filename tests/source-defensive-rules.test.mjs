import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceDefensiveRules,sourceArmourCap} from '../docs/source-defensive-rules.js';
const source='https://tow.whfb.app/unit/test-creature';
const record={
 source:{sourceUrl:source},
 classification:{troopType:['Monstrous Creature']},
 startingRules:[
  {name:'Armoured Hide (2)',sourceUrl:'https://tow.whfb.app/special-rules/armoured-hide'},
  {name:'Regeneration (5+)',sourceUrl:'https://tow.whfb.app/special-rules/regeneration'},
  {name:'Impact Hits (D3)',sourceUrl:'https://tow.whfb.app/special-rules/impact-hits'}
 ],
 optionalRules:[{name:'Regeneration (4+)',sourceUrl:'https://tow.whfb.app/special-rules/regeneration'}]
};
test('separates published defensive rules from unselected options',()=>{
 const rules=sourceDefensiveRules(record);
 assert.equal(rules.length,3);
 assert.ok(rules.some(r=>r.name==='Armoured Hide (2)'&&r.classification==='source-listed standard rule'));
 assert.ok(rules.some(r=>r.name==='Regeneration (4+)'&&r.classification.includes('not selected automatically')));
 assert.ok(rules.every(r=>r.scope.includes('No armour, Ward or Regeneration value applied')));
});
test('troop-type ceiling is a reference rather than a calculated save',()=>{
 assert.equal(sourceArmourCap(record)?.cap,3);
 assert.equal(sourceArmourCap({...record,classification:{troopType:['Regular Infantry']}})?.cap,2);
 assert.equal(sourceArmourCap({...record,classification:{troopType:['Regular Cavalry']}})?.cap,2);
 assert.equal(sourceArmourCap({...record,classification:{troopType:['Chariot']}})?.cap,3);
 assert.equal(sourceArmourCap({...record,classification:{troopType:['Unknown']}}),null);
 assert.equal(sourceArmourCap({...record,classification:{troopType:['Infantry','Chariot']}}),null);
});
test('does not trust off-origin source records or lookalike rules',()=>{
 assert.deepEqual(sourceDefensiveRules({...record,source:{sourceUrl:'https://evil.invalid/unit/x'}}),[]);
 assert.deepEqual(sourceDefensiveRules({...record,startingRules:[{name:'Not Armoured Hide (5)',sourceUrl:'https://tow.whfb.app/special-rules/armoured-hide'}],optionalRules:[]}),[]);
 assert.equal(sourceArmourCap({...record,source:{sourceUrl:'https://evil.invalid/unit/x'}}),null);
});
test('Defence Summary presents source references without passing them to equipment save engine',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../docs/defence-engine.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(ui,/sourceDefensiveRules\(record\)/);
 assert.match(ui,/Source troop-type armour ceiling:/);
 assert.match(sw,/\.\/source-defensive-rules\.js/);
 assert.doesNotMatch(engine,/sourceDefensiveRules|sourceArmourCap/);
});

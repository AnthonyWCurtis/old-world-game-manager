import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {selectedCommandRuleLink,COMMAND_RULE_URLS} from '../docs/selected-command-rule-links.js';
import {unitEquipmentAndRules} from '../docs/unit-equipment-and-rules.js';

const getRecord=(shard,id)=>JSON.parse(readFileSync(
 new URL('../docs/unit-data/shards/'+shard+'.json',import.meta.url),'utf8')).records[id];
const sea=getRecord('0f','unit:lothern-sea-guard');
const ship=getRecord('0c','unit:ships-company');
const army=parseArmy(readFileSync(
 new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8'));
const seaUnit=army.units.find(u=>u.name==='Lothern Sea Guard');
const selection=name=>({name,kind:'command',matchStatus:'matched'});
test('real selected Sea Guard command choices point to distinct rule pages',()=>{
 const group=unitEquipmentAndRules(seaUnit,sea).groups.upgrades;
 const mapped=Object.fromEntries(group.filter(x=>['Sea Master','Standard bearer','Musician'].includes(x.name))
  .map(x=>[x.name,x]));
 assert.equal(mapped['Sea Master'].sourceUrl,COMMAND_RULE_URLS.champion);
 assert.equal(mapped['Sea Master'].commandRole,'champion');
 assert.equal(mapped['Sea Master'].ruleTitle,'Champions');
 assert.equal(mapped['Standard bearer'].sourceUrl,COMMAND_RULE_URLS.standardBearer);
 assert.equal(mapped['Standard bearer'].commandRole,'standardBearer');
 assert.equal(mapped['Musician'].sourceUrl,COMMAND_RULE_URLS.musician);
 assert.equal(mapped['Musician'].commandRole,'musician');
});
test('other army-specific champion titles resolve generically from their own published upgrade',()=>{
 const unit={reference:{url:ship.source.sourceUrl},selections:[
  selection('Midshipman'),selection('Bosun'),selection('Standard bearer'),selection('Musician')
 ]};
 const entries=unitEquipmentAndRules(unit,ship).groups.upgrades;
 for(const name of ['Midshipman','Bosun'])
  assert.equal(entries.find(x=>x.name===name)?.sourceUrl,COMMAND_RULE_URLS.champion);
 assert.equal(entries.find(x=>x.name==='Musician')?.sourceUrl,COMMAND_RULE_URLS.musician);
});
test('unverified parents, unknown champion titles and unrelated command names get no rule inference',()=>{
 const unit={reference:{url:sea.source.sourceUrl}};
 assert.equal(selectedCommandRuleLink(selection('Sea Master'),{reference:{url:ship.source.sourceUrl}},sea),null);
 assert.equal(selectedCommandRuleLink(selection('Sea Master'),unit,{
  ...sea,source:{...sea.source,verificationStatus:'unverified'}}),null);
 assert.equal(selectedCommandRuleLink(selection('Sea Master'),unit,{...sea,
  upgradeGroups:[]}),null);
 assert.equal(selectedCommandRuleLink(selection('Captain'),unit,sea),null);
 assert.equal(selectedCommandRuleLink(selection('Battle Standard Bearer'),unit,sea),null);
 assert.equal(selectedCommandRuleLink(selection('Full Command'),unit,sea),null);
 assert.equal(selectedCommandRuleLink(selection('Sea Master'),{reference:{url:'https://evil.example/unit/x'}},sea),null);
});
test('unselected command options never appear simply because a unit could take them',()=>{
 const minimal={reference:{url:sea.source.sourceUrl},selections:[selection('Standard bearer')]};
 const entries=unitEquipmentAndRules(minimal,sea).groups.upgrades;
 assert.equal(entries.length,1);
 assert.equal(entries[0].sourceUrl,COMMAND_RULE_URLS.standardBearer);
});
test('links are source-verified, exact and preserved in offline cache',()=>{
 const ui=readFileSync(new URL('../docs/army-roster-page.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8');
 assert.match(ui,/item\.commandRole\?'Open '/);
 assert.match(sw,/'\.\/selected-command-rule-links\.js'/);
 for(const url of Object.values(COMMAND_RULE_URLS))
  assert.match(url,/^https:\/\/tow\.whfb\.app\/command-groups\//);
});

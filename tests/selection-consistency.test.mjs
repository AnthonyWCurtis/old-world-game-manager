import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,markCharmedShieldUsed,preservePendingUseState,setUnitDisplayName} from '../docs/battle-session.js';
import {evaluateDefences} from '../docs/defence-engine.js';
import {ownedItemEffects} from '../docs/effects-engine.js';
import {ITEM_EFFECT_RULES,projectArmyEffects} from '../docs/effects-engine.js';
import {resolveSelections} from '../docs/selection-resolver.js';

const fixture=readFileSync(new URL('../docs/examples/owb-regular.txt',import.meta.url),'utf8');
const setup=()=>parseArmy(fixture);
const bearer=army=>army.units.find(u=>u.selections.some(s=>s.name==='Charmed Shield'));
const selectionOf=unit=>unit.selections.find(s=>s.name==='Charmed Shield');
const effectsFor=(army,id)=>ownedItemEffects(army,null).filter(e=>e.ownerId===id&&e.id==='charmed-shield');

test('Stage 1 case A: conflicting Charmed Shield / Seed of Rebirth source never grants a save',()=>{
 const army=setup(),unit=bearer(army),selection=selectionOf(unit),original=selection.raw;
 selection.reference={...selection.reference,url:'https://tow.whfb.app/magic-item/seed-of-rebirth'};
 assert.equal(effectsFor(army,unit.id).length,0);
 const defence=evaluateDefences(army,restoreBattleSession(army),unit.id);
 assert.equal(defence.ward.some(w=>w.sourceUrl==='https://tow.whfb.app/magic-item/charmed-shield'),false);
 assert.equal(selection.raw,original);
});

test('Stage 1 case B: correctly sourced nested Charmed Shield is recognized by both engines',()=>{
 const army=setup(),unit=bearer(army),selection=selectionOf(unit);
 unit.selections=unit.selections.filter(s=>s!==selection);
 unit.selections.push({name:'Equipment',kind:'group',children:[selection]});
 assert.equal(effectsFor(army,unit.id).length,1);
 const defence=evaluateDefences(army,restoreBattleSession(army),unit.id);
 assert.equal(defence.ward.filter(w=>w.sourceUrl==='https://tow.whfb.app/magic-item/charmed-shield').length,1);
});

test('nested Charmed Shield use-state survives restore and is shared with both engines',()=>{
 const army=setup(),unit=bearer(army),selection=selectionOf(unit);
 unit.selections=unit.selections.filter(s=>s!==selection);
 unit.selections.push({name:'Equipment',kind:'group',children:[selection]});
 const before=restoreBattleSession(army);
 const spent=markCharmedShieldUsed(army,before,unit.id,true);
 const restored=restoreBattleSession(army,spent);
 assert.equal(restored.usedCharmedShields[unit.id],true);
 assert.equal(evaluateDefences(army,restored,unit.id).ward.find(w=>w.sourceUrl===shieldUrl).available,false);
 assert.equal(ownedItemEffects(army,restored).find(e=>e.ownerId===unit.id&&e.id==='charmed-shield').status,'spent');
});

test('conflicting Charmed Shield identity cannot be marked spent or restored',()=>{
 const army=setup(),unit=bearer(army),selection=selectionOf(unit);
 selection.reference={...selection.reference,url:'https://tow.whfb.app/magic-item/seed-of-rebirth'};
 const stale={...restoreBattleSession(army),usedCharmedShields:{[unit.id]:true}};
 assert.deepEqual(restoreBattleSession(army,stale).usedCharmedShields,{});
 assert.throws(()=>markCharmedShieldUsed(army,stale,unit.id,true),/selected Charmed Shield/);
});

test('champion cannot claim magic standard as personal effect',()=>{
 const army=setup(),unit=army.units.find(u=>u.name==='Lothern Sea Guard');
 unit.selections.push({name:'Champion',kind:'command',qualifier:'champion',children:[{
  name:'Razor Standard',reference:{url:'https://tow.whfb.app/magic-item/razor-standard'}
 }]});
 const erroneous=ownedItemEffects(army,null).filter(e=>e.id==='razor-standard'&&e.champion);
 assert.deepEqual(erroneous,[]);
});

const shieldUrl='https://tow.whfb.app/magic-item/charmed-shield';
const seedUrl='https://tow.whfb.app/magic-item/seed-of-rebirth';
const selected=(army,id='charmed-shield')=>resolveSelections(army,{catalogue:ITEM_EFFECT_RULES})
 .filter(e=>e.canonicalIdentity===id&&e.verificationStatus==='verified');
const defence=(army,id,session=restoreBattleSession(army))=>evaluateDefences(army,session,id);

test('canonical item reference, provenance, owner and one-use state agree',()=>{
 const army=setup(),u=bearer(army),a=selected(army).find(e=>e.ownerUnitId===u.id);
 assert.equal(a.canonicalSourceUrl,shieldUrl);
 assert.equal(a.scope.kind,'character');
 assert.equal(a.scope.modelId,u.id);
 assert.equal(a.sourceProvenance.importedUrl,shieldUrl);
 assert.equal(effectsFor(army,u.id)[0].ownerModel.modelId,u.id);
 assert.equal(defence(army,u.id).ward.find(w=>w.sourceUrl===shieldUrl).available,null,
  'Mounted bearer cannot claim a confirmed Ward before choosing rider armour');
 const spent=restoreBattleSession(army);
 spent.usedCharmedShields[u.id]=true;
 assert.equal(defence(army,u.id,spent).ward.find(w=>w.sourceUrl===shieldUrl).available,false);
 assert.equal(projectArmyEffects(army,spent).owned.find(e=>e.ownerId===u.id&&e.id==='charmed-shield').status,'spent');
});

test('missing and wrong URL do not create an effect, and report unresolved evidence',()=>{
 for(const url of [undefined,'https://tow.whfb.app/magic-item/not-the-item']){
  const army=setup(),u=bearer(army),s=selectionOf(u);
  s.reference={...s.reference,url};
  const entry=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES})
   .find(e=>e.ownerUnitId===u.id&&e.selection===s);
  assert.notEqual(entry.verificationStatus,'verified');
  assert.equal(effectsFor(army,u.id).length,0);
  assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
  assert.ok(projectArmyEffects(army,null).selectionIssues.some(i=>i.ownerId===u.id&&i.selection==='Charmed Shield'));
 }
});

test('incorrect canonical ID conflicts even if item name and URL agree',()=>{
 const army=setup(),u=bearer(army),s=selectionOf(u);
 s.reference={id:'item:seed-of-rebirth',url:shieldUrl};
 const entry=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(e=>e.selection===s);
 assert.equal(entry.verificationStatus,'conflict');
 assert.equal(effectsFor(army,u.id).length,0);
 assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
});

test('model-group unknown bearer is unresolved and has no regiment Ward',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 u.modelGroups=[{id:'front-rank',name:'Front Rank',quantity:4,selections:[
  {name:'Charmed Shield',reference:{url:shieldUrl},kind:'magic-item'}]}];
 const e=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(x=>x.ownerUnitId===u.id&&x.selection.name==='Charmed Shield');
 assert.equal(e.scope.kind,'model-group');
 assert.equal(e.scope.modelGroupId,'front-rank');
 assert.equal(e.verificationStatus,'unresolved');
 assert.equal(effectsFor(army,u.id).length,0);
 assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
});

test('champion is separate from regiment and character, without automatic legal join',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 const cloak=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(x=>x.ownerUnitId===u.id&&x.canonicalIdentity==='the-loremasters-cloak');
 assert.equal(cloak.scope.kind,'model-role');
 assert.equal(cloak.scope.role,'champion');
 assert.equal(defence(army,u.id).ward.length,0);
 assert.equal(defence(army,u.id).champions[0].ward[0].scope,'champion only');
 assert.equal(projectArmyEffects(army,null).owned.find(x=>x.id==='the-loremasters-cloak').champion,true);
 const char=bearer(army);
 assert.equal(selected(army).find(e=>e.ownerUnitId===char.id).scope.kind,'character');
});

test('identical unit instances and repeated selections remain instance-isolated and deterministic',()=>{
 const army=setup(),a=bearer(army);
 const b=army.units.find(x=>x!==a&&x.name==='Sea Guard Garrison Commander');
 const shield=selectionOf(a);
 a.selections.push(structuredClone(shield));
 b.selections.push(structuredClone(shield));
 const all=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES});
 assert.equal(all.filter(e=>e.ownerUnitId===a.id&&e.canonicalIdentity==='charmed-shield').length,2);
 assert.ok(all.some(e=>e.ownerUnitId===a.id&&e.duplicateOf));
 assert.equal(effectsFor(army,a.id).length,1);
 assert.equal(effectsFor(army,b.id).length,1);
 assert.equal(defence(army,a.id).ward.filter(w=>w.sourceUrl===shieldUrl).length,1);
 assert.equal(defence(army,b.id).ward.filter(w=>w.sourceUrl===shieldUrl).length,1);
});

test('removed selection and explicit replacement remove only affected bearer protection',()=>{
 const army=setup(),u=bearer(army),s=selectionOf(u);
 u.selections=u.selections.filter(x=>x!==s);
 assert.equal(effectsFor(army,u.id).length,0);
 assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
 u.selections.push({name:'Seed of Rebirth',kind:'magic-item',reference:{url:seedUrl},replaces:[s]});
 assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
 assert.equal(defence(army,u.id).regeneration.some(x=>x.sourceUrl===seedUrl),true);
 assert.equal(projectArmyEffects(army,null).owned.some(x=>x.ownerId===u.id&&x.id==='seed-of-rebirth'),true);
});

test('verified published defaults are conditional on source ownership, and optional upgrades remain unselected',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 const record={source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Shield',sourceUrl:'https://tow.whfb.app/weapons-of-war/shield'}],
  upgradeGroups:[{options:[{description:'May take Charmed Shield',linkedReferences:[{name:'Charmed Shield',sourceUrl:shieldUrl}]}]}]};
 const verified=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:{[u.id]:record}});
 assert.equal(verified.some(e=>e.ownerUnitId===u.id&&e.origin==='verified-published-default'&&e.canonicalIdentity==='equipment:shield'),true);
 assert.equal(verified.some(e=>e.ownerUnitId===u.id&&e.canonicalIdentity==='charmed-shield'),false);
 record.source.sourceUrl='https://tow.whfb.app/unit/other-unit';
 assert.equal(resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:{[u.id]:record}})
  .some(e=>e.ownerUnitId===u.id&&e.origin==='verified-published-default'),false);
});

test('source-extracted replacement suppresses the replaced default in both engines',()=>{
 const army=setup(),u=bearer(army);
 u.selections.push({name:'Heavy armour',kind:'equipment',reference:{url:'https://tow.whfb.app/weapons-of-war/heavy-armour'}});
 const record={source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Light armour',sourceUrl:'https://tow.whfb.app/weapons-of-war/light-armour'}],
  upgradeGroups:[{eligibilityClause:'May replace light armour with:',options:[
   {description:'Heavy armour',linkedReferences:[{name:'Heavy armour',sourceUrl:'https://tow.whfb.app/weapons-of-war/heavy-armour'}]}]}]};
 const records={[u.id]:record};
 const results=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:records});
 assert.equal(results.some(x=>x.ownerUnitId===u.id&&x.canonicalIdentity==='equipment:light-armour'),false);
 assert.equal(results.some(x=>x.ownerUnitId===u.id&&x.canonicalIdentity==='equipment:heavy-armour'),true);
 assert.equal(evaluateDefences(army,restoreBattleSession(army),u.id,records).armour.value,4);
 assert.equal(projectArmyEffects(army,null,records).selectionIssues.some(x=>x.ownerId===u.id&&x.selection==='Light armour'),false);
 assert.deepEqual(record.startingEquipment.map(e=>e.name),['Light armour'],'published record remains intact');
});

test('unverified replacement wording does not suppress a source-verified default',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 u.selections.push({name:'Heavy armour',reference:{url:'https://tow.whfb.app/weapons-of-war/heavy-armour'}});
 const record={source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Light armour',sourceUrl:'https://tow.whfb.app/weapons-of-war/light-armour'}],
  upgradeGroups:[{eligibilityClause:'May take heavy armour',options:[{description:'Heavy armour',
   linkedReferences:[{name:'Heavy armour',sourceUrl:'https://tow.whfb.app/weapons-of-war/heavy-armour'}]}]}]};
 const results=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:{[u.id]:record}});
 assert.ok(results.some(e=>e.ownerUnitId===u.id&&e.canonicalIdentity==='equipment:light-armour'));
 assert.ok(results.some(e=>e.ownerUnitId===u.id&&e.canonicalIdentity==='equipment:heavy-armour'));
});

test('a contradictory imported reference ID and unknown component bearer fail safely',()=>{
 const army=setup(),u=bearer(army),s=selectionOf(u);
 s.reference={id:'item:unknown-other-item',url:shieldUrl};
 assert.equal(effectsFor(army,u.id).length,0);
 assert.equal(defence(army,u.id).ward.length,0);
 assert.notEqual(resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(e=>e.selection===s).verificationStatus,'verified');
 const before=defence(army,u.id).regeneration.length;
 const rider={name:'Mount',modelRole:'mount',kind:'group',children:[{name:'Seed of Rebirth',reference:{url:seedUrl}}]};
 u.selections.push(rider);
 const e=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(e=>e.selection===rider.children[0]);
 assert.equal(e.scope.kind,'component');
 assert.equal(e.verificationStatus,'unresolved');
 assert.equal(defence(army,u.id).regeneration.length,before);
});

test('item-level structured roles assign champion ownership or leave component bearer unresolved',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 const champion={name:'Seed of Rebirth',modelRole:'champion',
  reference:{url:seedUrl}};
 const mount={name:'Charmed Shield',modelRole:'mount',
  reference:{url:shieldUrl}};
 u.selections.push(champion,mount);
 const selected=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES});
 const championEntry=selected.find(e=>e.selection===champion);
 const mountEntry=selected.find(e=>e.selection===mount);
 assert.equal(championEntry.verificationStatus,'verified');
 assert.equal(championEntry.scope.kind,'model-role');
 assert.equal(championEntry.scope.role,'champion');
 assert.equal(mountEntry.verificationStatus,'unresolved');
 assert.equal(mountEntry.scope.kind,'component');
 assert.equal(mountEntry.scope.role,'mount');
 assert.equal(projectArmyEffects(army,null).owned.some(e=>e.ownerId===u.id&&e.id==='seed-of-rebirth'&&e.champion),true);
 assert.equal(evaluateDefences(army,null,u.id).champions.some(c=>c.regeneration.some(s=>s.sourceUrl===seedUrl)),true);
 assert.equal(evaluateDefences(army,null,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
});

test('ordinary model-group equipment retains known group but never claims an individual bearer',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 u.selections=u.selections.filter(s=>s.name!=='Shield'&&s.name!=='Shields');
 u.modelGroups=[{id:'rankers',quantity:10,name:'Rankers',selections:[
  {name:'Shield',reference:{url:'https://tow.whfb.app/weapons-of-war/shield'}}]}];
 const entry=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES})
  .find(x=>x.ownerUnitId===u.id&&x.scope.modelGroupId==='rankers');
 assert.equal(entry.canonicalIdentity,'equipment:shield');
 assert.equal(entry.scope.kind,'model-group');
 assert.equal(entry.scope.eligibility,'group-known-individual-bearer-unresolved');
 assert.equal(evaluateDefences(army,null,u.id).armour.value,6);
});

test('magic standards need a recorded standard bearer or BSB before either engine projects them',()=>{
 const army=setup(),sea=army.units.find(x=>x.name==='Lothern Sea Guard');
 const banner=sea.selections.find(s=>s.name==='Standard bearer');
 const razor=banner.children.find(s=>s.name==='Razor Standard');
 sea.selections=sea.selections.filter(s=>s!==banner);
 sea.selections.push(razor);
 const missing=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(e=>e.selection===razor);
 assert.equal(missing.verificationStatus,'unresolved');
 assert.match(missing.unresolved,/standard bearer/i);
 assert.equal(ownedItemEffects(army,null).some(e=>e.id==='razor-standard'&&e.ownerId===sea.id),false);
 assert.equal(projectArmyEffects(army,null).byUnit[sea.id].some(e=>e.id==='razor-standard'),false);
 sea.selections.push(banner);
 assert.equal(ownedItemEffects(army,null).filter(e=>e.id==='razor-standard'&&e.ownerId===sea.id).length,1);
 banner.reference.url=seedUrl;
 assert.equal(ownedItemEffects(army,null).some(e=>e.id==='razor-standard'&&e.ownerId===sea.id),false,
  'A standard-bearer command with conflicting source does not authenticate a magic banner');
 banner.reference.url=sea.reference.url;
 const originalUnitSource=sea.reference.url;
 delete banner.reference.url;
 delete sea.reference.url;
 assert.equal(ownedItemEffects(army,null).some(e=>e.id==='razor-standard'&&e.ownerId===sea.id),false,
  'Missing unit and bearer references cannot mutually authenticate a magic banner');
 sea.reference.url=originalUnitSource;
 banner.reference.url=originalUnitSource;

 const bsb=army.units.find(u=>u.selections.some(s=>s.name==='Battle Standard Bearer'));
 const role=bsb.selections.find(s=>s.name==='Battle Standard Bearer');
 const item=role.children.find(s=>s.name==='Banner of Confidence');
 bsb.selections=bsb.selections.filter(s=>s!==role);
 bsb.selections.push(item);
 assert.equal(ownedItemEffects(army,null).some(e=>e.id==='banner-of-confidence'&&e.ownerId===bsb.id),false);
 bsb.selections.push(role);
 assert.equal(ownedItemEffects(army,null).filter(e=>e.id==='banner-of-confidence'&&e.ownerId===bsb.id).length,1);
 role.reference.url=seedUrl;
 assert.equal(ownedItemEffects(army,null).some(e=>e.id==='banner-of-confidence'&&e.ownerId===bsb.id),false,
  'A wrong Battle Standard Bearer role URL is insufficient evidence');
});

test('mounted Charmed Shield is conditional until rider armour choice is recorded',()=>{
 const army=setup(),sky=army.units.find(x=>x.reportedPoints?.value===283);
 const session=restoreBattleSession(army);
 const owned=ownedItemEffects(army,session).find(e=>e.id==='charmed-shield'&&e.ownerId===sky.id);
 assert.equal(owned.availability,'conditional');
 assert.equal(owned.oneUseState,'ready');
 assert.match(owned.availabilityReason,/armour/i);
 const defence=evaluateDefences(army,session,sky.id);
 assert.equal(defence.ward.find(w=>w.sourceUrl===shieldUrl).available,null);
 assert.match(defence.ward.find(w=>w.sourceUrl===shieldUrl).status,/conditional/i);
 assert.equal(defence.armour.status,'conditional');
 const spent=markCharmedShieldUsed(army,session,sky.id,true);
 assert.equal(ownedItemEffects(army,spent).find(e=>e.id==='charmed-shield'&&e.ownerId===sky.id).oneUseState,'spent');
 assert.equal(evaluateDefences(army,spent,sky.id).ward.find(w=>w.sourceUrl===shieldUrl).available,false);
});

test('descendant mount scope overrides enclosing champion and cannot acquire bearer regeneration',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 const seed={name:'Seed of Rebirth',reference:{url:seedUrl}};
 u.selections.push({name:'Champion',modelRole:'champion',children:[
  {name:'Mount',modelRole:'mount',children:[seed]}]});
 const entry=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).find(e=>e.selection===seed);
 assert.equal(entry.scope.kind,'component');
 assert.equal(entry.scope.role,'mount');
 assert.equal(entry.verificationStatus,'unresolved');
 assert.equal(ownedItemEffects(army,null).some(x=>x.id==='seed-of-rebirth'&&x.ownerId===u.id),false);
 assert.equal(evaluateDefences(army,null,u.id).champions.some(x=>x.regeneration.length),false);
});

test('unmatched or informational references cannot verify mundane shields or magical cloaks',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 const baseline=evaluateDefences(army,null,u.id).armour.value;
 const shield={name:'Shield',matchStatus:'unmatched',
  reference:{url:'https://tow.whfb.app/weapons-of-war/shield'}};
 const cloak={name:"The Loremaster's Cloak",matchStatus:'informational',
  reference:{url:'https://tow.whfb.app/magic-item/the-loremasters-cloak'}};
 u.selections.push(shield,cloak);
 const entries=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES});
 assert.notEqual(entries.find(e=>e.selection===shield).verificationStatus,'verified');
 assert.notEqual(entries.find(e=>e.selection===cloak).verificationStatus,'verified');
 assert.equal(evaluateDefences(army,null,u.id).armour.value,baseline);
 assert.equal(evaluateDefences(army,null,u.id).ward.length,0);
});

test('contradictory item ID namespaces fail even when name and URL match',()=>{
 const army=setup(),u=bearer(army),s=selectionOf(u);
 for(const id of ['unit:other-unit','role:battle-standard-bearer','item:other']){
  s.reference={id,url:shieldUrl};
  assert.equal(effectsFor(army,u.id).length,0);
  assert.equal(defence(army,u.id).ward.some(w=>w.sourceUrl===shieldUrl),false);
 }
});

test('a source record with contradictory unit ID cannot supply defaults',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 const record={id:'unit:other-unit',
  source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Shield',sourceUrl:'https://tow.whfb.app/weapons-of-war/shield'}]};
 assert.equal(resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:{[u.id]:record}})
  .some(e=>e.origin==='verified-published-default'),false);
});

test('champion or model-group purchases cannot replace regiment-wide published armour',()=>{
 for(const variant of ['champion','group']){
  const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
  u.selections=u.selections.filter(s=>s.name!=='Light armour');
  const heavy={name:'Heavy armour',reference:{url:'https://tow.whfb.app/weapons-of-war/heavy-armour'}};
  if(variant==='champion')u.selections.push({name:'Champion',modelRole:'champion',children:[heavy]});
  else u.modelGroups=[{id:'some-models',selections:[heavy]}];
  const record={source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
   startingEquipment:[{name:'Light armour',sourceUrl:'https://tow.whfb.app/weapons-of-war/light-armour'}],
   upgradeGroups:[{eligibilityClause:'May replace light armour with:',options:[
    {description:'Heavy armour',linkedReferences:[{name:'Heavy armour',
      sourceUrl:'https://tow.whfb.app/weapons-of-war/heavy-armour'}]}]}]};
  const found=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES,unitRecords:{[u.id]:record}});
  assert.equal(found.some(e=>e.origin==='verified-published-default'&&
   e.canonicalIdentity==='equipment:light-armour'),true,variant);
 }
});

test('magic standard duplicated as unit option and under its bearer projects once',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Lothern Sea Guard');
 const bearerSelection=u.selections.find(s=>s.name==='Standard bearer');
 const razor=bearerSelection.children.find(s=>s.name==='Razor Standard');
 u.selections.push(structuredClone(razor));
 const found=resolveSelections(army,{catalogue:ITEM_EFFECT_RULES}).filter(e=>
  e.ownerUnitId===u.id&&e.canonicalIdentity==='razor-standard');
 assert.equal(found.length,2);
 assert.equal(found.filter(e=>e.duplicateOf).length,1);
 assert.equal(ownedItemEffects(army,null).filter(e=>e.id==='razor-standard'&&e.ownerId===u.id).length,1);
});

test('a verified source-published Charmed Shield can be spent and restored with source records',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 const records={[u.id]:{
  source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Charmed Shield',sourceUrl:shieldUrl}]}};
 const item=ownedItemEffects(army,null,records).find(e=>e.id==='charmed-shield'&&e.ownerId===u.id);
 assert.ok(item);
 const before=restoreBattleSession(army,null,records);
 const spent=markCharmedShieldUsed(army,before,u.id,true,records);
 const restored=restoreBattleSession(army,spent,records);
 assert.equal(restored.usedCharmedShields[u.id],true);
 assert.equal(evaluateDefences(army,restored,u.id,records).ward.find(w=>w.sourceUrl===shieldUrl).available,false);
 assert.equal(ownedItemEffects(army,restored,records).find(e=>e.id==='charmed-shield'&&e.ownerId===u.id).status,'spent');
});

test('saved source-default item use survives an edit made while references load',()=>{
 const army=setup(),u=army.units.find(x=>x.name==='Storm Weaver');
 const records={[u.id]:{source:{verificationStatus:'source-extracted',sourceUrl:u.reference.url},
  startingEquipment:[{name:'Charmed Shield',sourceUrl:shieldUrl}]}};
 const spent=markCharmedShieldUsed(army,restoreBattleSession(army,null,records),u.id,true,records);
 const beforeSources=restoreBattleSession(army,spent);
 assert.deepEqual(beforeSources.usedCharmedShields,{});
 const rename=setUnitDisplayName(army,beforeSources,u.id,'Windspeaker');
 const savedWhileLoading=preservePendingUseState(army,rename,spent);
 const afterSources=restoreBattleSession(army,savedWhileLoading,records);
 assert.equal(afterSources.unitNames[u.id],'Windspeaker');
 assert.equal(afterSources.usedCharmedShields[u.id],true);
 assert.equal(ownedItemEffects(army,afterSources,records)
  .find(x=>x.ownerId===u.id&&x.id==='charmed-shield').status,'spent');
});

test('a player reset clears an older pending one-use flag before source revalidation',()=>{
 const army=setup(),u=bearer(army),spent=markCharmedShieldUsed(army,restoreBattleSession(army),u.id,true);
 const reset=markCharmedShieldUsed(army,spent,u.id,false);
 const queued=preservePendingUseState(army,reset,spent,{shieldUse:{ownerId:u.id,used:false}});
 assert.equal(queued.usedCharmedShields[u.id],undefined);
 assert.equal(restoreBattleSession(army,queued).usedCharmedShields[u.id],undefined);
 const stale={...spent,itemStates:{[u.id]:{'elixir-of-power':'spent'}}};
 const cleared=preservePendingUseState(army,reset,stale,{
  itemUse:{ownerId:u.id,itemId:'elixir-of-power',status:'ready'}});
 assert.equal(cleared.itemStates[u.id],undefined);
});

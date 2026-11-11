import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {restoreBattleSession,setUnitDisplayName,setWizardKnownSpell,armySessionKey,assignCharacter} from '../docs/battle-session.js';
import {indexedSpells,wizardDescriptor,unitDisplayName} from '../docs/player-customization.js';

const example=name=>readFileSync(new URL('../docs/examples/'+name+'.txt',import.meta.url),'utf8');
const magic=JSON.parse(readFileSync(new URL('../docs/reference-records/magic-index.json',import.meta.url),'utf8'));
const spells=indexedSpells(magic);
const army=()=>parseArmy(example('owb-regular'));
const wizard=a=>a.units.find(u=>u.name==='Storm Weaver');
const unit=a=>a.units.find(u=>u.name==='Lothern Sea Guard');

test('all source-indexed spells have bounded, genuine source URLs; no lore membership is invented',()=>{
 assert.equal(spells.length,magic.counts.spells);
 assert.ok(spells.some(s=>s.name==='Earthen Ramparts'));
 assert.ok(spells.some(s=>s.name==='Glittering Robe'));
 assert.ok(spells.every(s=>s.url==='https://tow.whfb.app/spell/'+s.id.slice('magic-ref:/spell/'.length)));
 assert.deepEqual(indexedSpells({...magic,source:{origin:'https://other.example'}}),[]);
});

test('names are per instance, persist on reimport and leave canonical names, points and source unchanged',()=>{
 const a=army(),original=JSON.stringify(a),s=restoreBattleSession(a);
 const dupes=a.units.filter(u=>u.name==="Ship's Company");
 assert.equal(dupes.length,3);
 const first=setUnitDisplayName(a,s,dupes[0].id,'  Left flank  ');
 const second=setUnitDisplayName(a,first,dupes[1].id,'Centre Guard');
 assert.equal(unitDisplayName(dupes[0],second),'Left flank');
 assert.equal(unitDisplayName(dupes[1],second),'Centre Guard');
 assert.equal(unitDisplayName(dupes[2],second),dupes[2].name);
 assert.equal(JSON.stringify(a),original);
 const recovered=restoreBattleSession(parseArmy(a.originalText),second);
 assert.deepEqual(recovered.unitNames,second.unitNames);
 assert.equal(recovered.armyKey,armySessionKey(a));
 const reset=setUnitDisplayName(a,second,dupes[0].id,null);
 assert.equal(unitDisplayName(dupes[0],reset),dupes[0].name);
 assert.throws(()=>setUnitDisplayName(a,s,'not-a-unit','test'),/valid imported/i);
 assert.throws(()=>setUnitDisplayName(a,s,dupes[0].id,'x'.repeat(81)),/80/);
 assert.throws(()=>setUnitDisplayName(a,s,dupes[0].id,{}),/text/i);
});

test('each imported Wizard has independent spell knowledge with no automatic cast or rule effect',()=>{
 const a=army(),original=JSON.stringify(a),storm=wizard(a);
 const other=a.units.filter(u=>u.name==='Mage').find(u=>u.selections.some(s=>s.name==='Illusion'));
 assert.ok(wizardDescriptor(storm,magic));
 assert.ok(wizardDescriptor(other,magic));
 assert.equal(wizardDescriptor(unit(a),magic),null);
 const spell=spells.find(s=>s.name==='Earthen Ramparts');
 const spell2=spells.find(s=>s.name==='Glittering Robe');
 let state=restoreBattleSession(a);
 state=setWizardKnownSpell(a,state,storm.id,spell.id,true,spells);
 state=setWizardKnownSpell(a,state,other.id,spell2.id,true,spells);
 assert.deepEqual(state.knownSpells[storm.id],[spell.id]);
 assert.deepEqual(state.knownSpells[other.id],[spell2.id]);
 assert.deepEqual(state.activeSpells,[]);
 assert.equal(JSON.stringify(a),original);
 const restored=restoreBattleSession(parseArmy(a.originalText),state);
 assert.deepEqual(restored.knownSpells,state.knownSpells);
 const changed=assignCharacter(a,state,other.id,unit(a).id);
 assert.deepEqual(changed.knownSpells,state.knownSpells);
 state=setWizardKnownSpell(a,state,storm.id,spell.id,false,spells);
 assert.equal(state.knownSpells[storm.id],undefined);
 assert.ok(state.knownSpells[other.id]);
 assert.throws(()=>setWizardKnownSpell(a,state,unit(a).id,spell.id,true,spells),/wizard/i);
 assert.throws(()=>setWizardKnownSpell(a,state,storm.id,'magic-ref:/spell/not-in-index',true,spells),/index/i);
 assert.throws(()=>setWizardKnownSpell(a,state,storm.id,spell.id,true,[]),/index/i);
});

test('legacy session migration ignores unknown ids and preserves existing imported quoted nicknames',()=>{
 const a=parseArmy(example('owb-minimalist-nicknames'));
 const first=a.units[0],original=first.nickname;
 const stored={schemaVersion:1,armyKey:armySessionKey(a),assignments:{},
  usedCharmedShields:{},activeSpells:[],unitNames:{[first.id]:'Wizard A',invalid:'bad'},
  knownSpells:{invalid:['magic-ref:/spell/fireball'],[first.id]:['bad']},savedAt:'old'};
 const state=restoreBattleSession(a,stored);
 assert.equal(unitDisplayName(first,state),'Wizard A');
 assert.deepEqual(Object.keys(state.unitNames),[first.id]);
 assert.deepEqual(state.knownSpells,{});
 assert.equal(first.nickname,original);
 assert.equal(unitDisplayName(first,restoreBattleSession(a)),original);
 const foreign=restoreBattleSession(army(),stored);
 assert.deepEqual(foreign.unitNames,{});
 assert.deepEqual(foreign.knownSpells,{});
});

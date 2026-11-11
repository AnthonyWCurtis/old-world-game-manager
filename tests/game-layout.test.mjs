import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {GAME_TABS,loadGameLayout,saveGameLayout,setActiveTab,setUnitExpanded} from '../docs/game-layout.js';

const fixture=id=>parseArmy(readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8'));
test('View preferences default Overview and scope to one exact imported army',()=>{
 const storage=new Map();
 globalThis.localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>{storage.set(key,value);}
 };
 const army=fixture('owb-regular');
 const other=fixture('single-sea-guard');
 assert.deepEqual(GAME_TABS,['overview','units','magic']);
 const fresh=loadGameLayout(army);
 assert.equal(fresh.tab,'overview');
 assert.deepEqual(fresh.expandedUnits,[]);
 const one=setUnitExpanded(fresh,army.units[0].id,true);
 assert.deepEqual(one.expandedUnits,[army.units[0].id]);
 const changed=setActiveTab(one,'magic',246);
 assert.equal(changed.tab,'magic');
 assert.equal(changed.scroll.overview,246);
 assert.equal(loadGameLayout(army).tab,'magic');
 assert.deepEqual(loadGameLayout(army).expandedUnits,[army.units[0].id]);
 assert.equal(loadGameLayout(other).tab,'overview');
 assert.deepEqual(loadGameLayout(other).expandedUnits,[]);
 const collapsed=setUnitExpanded(changed,army.units[0].id,false);
 assert.deepEqual(loadGameLayout(army).expandedUnits,[]);
 assert.deepEqual(collapsed.expandedUnits,[]);
});
test('Tampered preferences cannot reveal old unit IDs or invalid tabs',()=>{
 const army=fixture('single-sea-guard');
 globalThis.localStorage={
  getItem:()=>JSON.stringify({tab:'import',expandedUnits:['fake',army.units[0].id,'bad'],
   scroll:{overview:-99,units:99e12,magic:'invalid'}}),
  setItem:()=>{}
 };
 const saved=loadGameLayout(army);
 assert.equal(saved.tab,'overview');
 assert.deepEqual(saved.expandedUnits,[army.units[0].id]);
 assert.deepEqual(saved.scroll,{overview:0,units:10000000,magic:0});
 assert.equal(setActiveTab(saved,'invalid',10).tab,'overview');
});
test('Blocked browser storage must not interrupt battles',()=>{
 const army=fixture('single-sea-guard');
 globalThis.localStorage={
  getItem:()=>{throw Error('Storage blocked');},
  setItem:()=>{throw Error('Storage blocked');}
 };
 const state=loadGameLayout(army);
 assert.equal(state.tab,'overview');
 assert.doesNotThrow(()=>saveGameLayout(state));
 assert.doesNotThrow(()=>setUnitExpanded(state,army.units[0].id,true));
});

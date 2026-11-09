import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched, formatUnmatchedDebug} from '../docs/unmatched-debug.js';

const example=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');
const selection=(name,line,status='unmatched',options={})=>({
 name,raw:options.raw||name,line,kind:options.kind||'option',matchStatus:status,
 children:options.children||[],reference:status==='matched'?{url:'https://tow.whfb.app/example'}:null
});
test('Copies unmatched selections only, preserving unit, source line and original option',()=>{
 const army=parseArmy(example('nr-tow-footer'));
 for(const unit of army.units){
  unit.matchStatus='matched';
  for(const s of unit.selections)s.matchStatus='matched';
  for(const g of unit.modelGroups)for(const s of g.selections){
   s.matchStatus='matched';
   for(const child of s.children||[])child.matchStatus='matched';
  }
 }
 const helm=army.units.find(u=>u.name==='Silver Helms');
 const archmage=army.units.find(u=>u.name==='Archmage');
 archmage.selections.find(s=>s.name==='Wizard Level 3').matchStatus='unmatched';
 helm.modelGroups[1].selections[1].matchStatus='unmatched';
 helm.modelGroups[1].selections[1].children[0].matchStatus='unmatched';
 const out=collectUnmatched(army);
 assert.equal(out.length,3);
 assert.equal(out.filter(e=>e.type==='selection').length,3);
 assert.equal(out[0].unit,'Archmage');
 assert.equal(out[1].unit,'Silver Helms');
 assert.equal(out[1].groupQuantity,1);
 assert.ok(out[2].parentSelection);
 const debug=formatUnmatchedDebug(army,{appVersion:'0.2.7'});
 assert.ok(debug.includes('Unmatched selections: 3'));
 assert.ok(debug.includes('Wizard Level 3'));
 assert.ok(debug.includes('Source line: 5'));
 assert.ok(debug.includes('Parent unit: Silver Helms'));
 assert.ok(debug.includes('Model group: 1× Silver Helm'));
 assert.ok(debug.includes('Nested under: High Helm'));
 assert.ok(debug.includes('Game Manager: v0.2.7'));
 assert.ok(!debug.includes('Player:'));
 assert.ok(!debug.includes('Created with newrecruit.eu'));
 assert.ok(!debug.includes('Pure of Heart'));
});
test('Repeated units are distinct occurrences, and unmatched unit profiles are included',()=>{
 const army=parseArmy(example('nr-tow-footer'));
 for(const u of army.units){
  u.matchStatus='matched';
  for(const s of u.selections)s.matchStatus='matched';
  for(const g of u.modelGroups)for(const s of g.selections){
   s.matchStatus='matched';
   for(const c of s.children||[])c.matchStatus='matched';
  }
 }
 const allHelms=army.units.filter(u=>u.name==='Silver Helms');
 assert.equal(allHelms.length,3);
 allHelms[0].matchStatus='unmatched';
 allHelms[1].matchStatus='unmatched';
 const items=collectUnmatched(army);
 assert.equal(items.length,2);
 assert.deepEqual(items.map(e=>e.type),['unit','unit']);
 assert.notEqual(items[0].unitOccurrence,items[1].unitOccurrence);
 assert.equal(items[0].sourceLine,allHelms[0].line);
 assert.equal(items[1].sourceLine,allHelms[1].line);
 const debug=formatUnmatchedDebug(army);
 assert.ok(debug.includes('Unmatched units: 2'));
 assert.ok(debug.includes('Unmatched selections: 0'));
});
test('Empty report is explicit, and an unmatched entry does not copy other units',()=>{
 const army=parseArmy(example('nr-tow-footer'));
 for(const u of army.units){
  u.matchStatus='matched';
  for(const s of u.selections)s.matchStatus='matched';
  for(const g of u.modelGroups)for(const s of g.selections){
   s.matchStatus='matched';
   for(const c of s.children||[])c.matchStatus='matched';
  }
 }
 assert.deepEqual(collectUnmatched(army),[]);
 assert.match(formatUnmatchedDebug(army),/No unmatched records found/);
 assert.ok(!formatUnmatchedDebug(army).includes('Silver Helms [175 pts]'));
});
test('Copy control, browser clipboard and manual fallback are wired',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 for(const id of ['copyUnmatchedBtn','copyUnmatchedStatus','unmatchedDebugFallback'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes("formatUnmatchedDebug(current"));
 assert.ok(app.includes("addEventListener('click',()=>void copyUnmatchedDebug())"));
 assert.ok(app.includes("navigator.clipboard?.writeText"));
 assert.ok(app.includes("document.execCommand?.('copy')"));
 assert.ok(app.includes("syncUnmatchedDebug()"));
});

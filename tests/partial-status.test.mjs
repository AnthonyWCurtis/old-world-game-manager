import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {hasUnmatchedSelection,unitHasUnmatched,unitMatchState,selectionMatchState} from '../docs/match-status.js';

const load=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');
const setAllMatched=army=>{
 for(const u of army.units){
  u.matchStatus='matched';
  const visit=entries=>{for(const s of entries){s.matchStatus='matched';visit(s.children||[])}};
  visit(u.selections);
  for(const group of u.modelGroups)visit(group.selections);
 }
};
test('Unit with identified base link but unmatched equipment is partially matched',()=>{
 const army=parseArmy(load('nr-tow-footer'));
 setAllMatched(army);
 const helms=army.units.filter(u=>u.name==='Silver Helms');
 assert.equal(helms.length,3);
 assert.equal(unitMatchState(helms[0]),'matched');
 const helmUpgrade=helms[0].selections.find(x=>x.name==='High Helm');
 helmUpgrade.matchStatus='unmatched';
 assert.equal(unitMatchState(helms[0]),'partial');
 assert.equal(unitHasUnmatched(helms[0]),true);
 assert.equal(unitMatchState(helms[1]),'matched');
 assert.equal(unitMatchState(helms[2]),'matched');
 assert.equal(unitMatchState(army.units[0]),'matched');
});
test('Nested model groups propagate unmatched statuses through every level',()=>{
 const army=parseArmy(load('nr-nr'));
 setAllMatched(army);
 const sisters=army.units.find(u=>u.name==='Sisters of Avelorn');
 const parent=sisters.modelGroups[1].selections.find(s=>s.name==='High Sister');
 assert.ok(parent.children.length>0);
 parent.children[0].matchStatus='unmatched';
 assert.equal(selectionMatchState(parent),'partial');
 assert.equal(hasUnmatchedSelection(parent),true);
 assert.equal(unitMatchState(sisters),'partial');
 parent.children[0].matchStatus='matched';
 assert.equal(unitMatchState(sisters),'matched');
});
test('Absent unit reference is unmatched regardless of selection links',()=>{
 const army=parseArmy(load('nr-tow-footer'));
 setAllMatched(army);
 const u=army.units[1];
 u.matchStatus='unmatched';
 assert.equal(unitMatchState(u),'unmatched');
 assert.equal(unitHasUnmatched(u),true);
});
test('UI shows three distinct status badges and displays debug text synchronously',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
 assert.ok(html.includes('id="selectUnmatchedBtn"'));
 assert.ok(app.includes("left.append(badge(unitMatchState(u)))"));
 assert.ok(app.includes("const all=current.units.filter(u=>u.sectionId===sec.id),uList=only?all.filter(unitHasUnmatched):all;"));
 assert.ok(app.includes("item.append(badge(selectionMatchState(s)))"));
 assert.ok(css.includes('.tag.partial'));
 const start=app.indexOf('async function copyUnmatchedDebug()');
 const end=app.indexOf('function render()',start);
 const handler=app.slice(start,end);
 const show=handler.indexOf("fallback.hidden=false;");
 const copy=handler.indexOf("await navigator.clipboard.writeText(text)");
 assert.ok(show>=0 && copy>show,'Report must appear before asynchronous clipboard attempt');
 assert.ok(app.includes("selectUnmatchedBtn').addEventListener('click',selectUnmatchedText)"));
});

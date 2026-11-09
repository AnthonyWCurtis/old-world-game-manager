import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {CATALOGUE,findReference} from '../docs/catalog.js';
import {parseSubmittedReport,consolidate} from '../scripts/aggregate-unmatched.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source='https://tow.whfb.app';
const cases=[
 {unit:'Sorcerer-Prophet',name:'Wizard',expected:'/magic/wizards'},
 {unit:'Sorcerer-Prophet',name:'Level 3 Wizard',expected:'/magic/levels-of-wizardry'},
 {unit:'Sorcerer-Prophet',name:"'Bale Taurus",expected:'/unit/bale-taurus'},
 {unit:'Hobgoblin Khan',name:'Ranged weapon',expected:'/unit/hobgoblin-khan'},
 {unit:'Infernal Guard',name:'Standard bearer',expected:'/unit/infernal-guard'},
 {unit:'Infernal Guard',name:'Full Command',expected:'/command-groups'},
 {unit:'Hobgoblin Cutthroats',name:'Musician',expected:'/unit/hobgoblin-cutthroats'},
 {unit:'Hobgoblin Wolf Riders',name:'Musician',expected:'/unit/hobgoblin-wolf-riders'}
];
const flatten=selections=>(selections||[]).flatMap(s=>[s,...flatten(s.children)]);
const selections=unit=>flatten(unit.selections).concat(unit.modelGroups.flatMap(g=>flatten(g.selections)));

test('All 8 unique reported references link to verified, appropriately scoped TOW pages',()=>{
 for(const {unit,name,expected} of cases){
  const ref=findReference(name,'selection',unit);
  assert.ok(ref,name+' on '+unit+' should have a source');
  assert.equal(ref.url,source+expected);
  assert.equal(ref.sourceStatus,'verified-on-tow');
  assert.equal(ref.verifiedOn,'2026-11-09');
  assert.equal(ref.parentUnit,unit);
  if(ref.scopeEvidenceUrl)assert.ok(ref.scopeEvidenceUrl.startsWith(source+'/'));
 }
 assert.equal(CATALOGUE.filter(r=>r.sourceStatus==='verified-on-tow'&&r.verifiedOn==='2026-11-09').length,29);
});

test('Never globally match unit-specific command or generic equipment fields',()=>{
 for(const name of ['Musician','Full Command','Standard bearer','Ranged weapon',"'Bale Taurus",'Level 3 Wizard']){
  assert.equal(findReference(name,'selection','Forsaken'),null,name+' should not be a global match');
 }
 assert.equal(findReference("'Eadbuttin' 'At",'selection','Sorcerer-Prophet'),null,
  'Do not blindly strip apostrophes from other names');
 assert.equal(findReference('Bale Taurus','unit',''),null,
  'A mount profile is not a standalone roster unit reference');
});

test('Chaos Dwarfs sample retains 10 unit instances, 1999 points and matches every submitted missing reference',()=>{
 const army=parseArmy(read('../docs/examples/owb-minimalist-nicknames.txt'));
 assert.equal(army.stats.unitCount,10);
 assert.equal(army.stats.matchedUnits,10);
 assert.equal(army.stats.unparsedLines,0);
 assert.equal(army.army.derivedPoints.value,1999);
 assert.equal(army.units.filter(x=>x.name==='Hobgoblin Cutthroats').length,2);
 const matched=[];
 for(const {unit,name,expected} of cases){
  const units=army.units.filter(u=>u.name===unit);
  assert.ok(units.length,unit);
  let found=0;
  for(const item of units.flatMap(selections).filter(s=>s.name===name)){
   assert.equal(item.matchStatus,'matched',name+' on '+unit);
   assert.equal(item.reference?.url,source+expected);
   found++;
  }
  assert.ok(found,name+' on '+unit+' should exist in parsed selections');
  matched.push(found);
 }
 assert.equal(matched.reduce((a,b)=>a+b,0),9,'Two distinct Cutthroat units both have musicians');
 const orc=army.units.find(u=>u.name==='Black Orc Warboss');
 assert.ok(selections(orc).some(s=>s.raw==="'Eadbuttin' 'At"));
});

test('Previously reported fixed references leave consolidated queue but archived submission is retained',()=>{
 const text=read('../reports/unmatched/report-20261109T185859798Z-3f621230-14c2-4b20-982f-49d3373e7841.txt');
 const parsed=parseSubmittedReport(text);
 assert.equal(parsed.length,9);
 const consolidated=consolidate([{name:'historical-chaos.txt',content:text}]);
 assert.match(consolidated,/Distinct missing references: 0/);
 assert.match(consolidated,/Unmatched occurrences: 0/);
 assert.match(consolidated,/Previously reported and now source-linked: 9/);
 assert.match(consolidated,/Report files: 1/);
 assert.match(consolidated,/Original reports are retained as history/);
 assert.ok(!consolidated.includes("'Bale Taurus (SELECTION)"));
});

test('Aggregator still shows genuinely unreviewed future references',()=>{
 const before=read('../reports/unmatched/report-20261109T185859798Z-3f621230-14c2-4b20-982f-49d3373e7841.txt');
 const extra=[
  'Warhammer: The Old World — Unmatched Source Reference Report',
  '[1] SELECTION: Never-Reviewed-Upgrade-999',
  '  Parent unit: Infernal Guard',
  '  Kind: option',
  '  Parent unit reference: https://tow.whfb.app/unit/infernal-guard'
 ].join('\n');
 const result=consolidate([{name:'prior.txt',content:before},{name:'new.txt',content:extra}]);
 assert.match(result,/Distinct missing references: 1/);
 assert.match(result,/Unmatched occurrences: 1/);
 assert.match(result,/Never-Reviewed-Upgrade-999 \(SELECTION\)/);
 assert.match(result,/Previously reported and now source-linked: 9/);
});

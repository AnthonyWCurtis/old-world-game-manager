import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {
 normalizeUnitLabel,loadUnitDataIndex,findIndexedUnit,
 applyUnitDataReferences,getUnitDetails
} from '../docs/unit-data.js';
import {renderUnitDataDetails} from '../docs/unit-detail-ui.js';
import {shardForId,buildUnitDataBundle} from '../scripts/build-browser-unit-data.mjs';

const root=new URL('../docs/unit-data/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',root),'utf8'));
const armies=JSON.parse(readFileSync(new URL('armies.json',root),'utf8'));
const shards={};
for(const id of Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0'))){
 shards[id]=JSON.parse(readFileSync(new URL('shards/'+id+'.json',root),'utf8'));
}
const allUnits=Object.values(shards).flatMap(s=>Object.values(s.records));
const byId=Object.fromEntries(allUnits.map(u=>[u.id,u]));
function fetchFromFiles(url){
 const file=url.startsWith('./unit-data/')?url.slice('./unit-data/'.length):null;
 if(!file)throw Error('Bad requested URL: '+url);
 return Promise.resolve({ok:true,json:async()=>JSON.parse(readFileSync(new URL(file,root),'utf8'))});
}
function makeArmy(names){
 return {units:names.map((name,i)=>({
  id:'u'+(i+1),name,reference:null,matchStatus:'unmatched',
  reportedPoints:{value:100+i},selections:[{id:'s1',name:'Test option',matchStatus:'unmatched'}]
 })),stats:{unitCount:names.length,matchedUnits:0,unmatchedUnits:names.length,
  matchedSelections:0,unmatchedSelections:names.length}};
}
test('Full source snapshot is pinned and divided into 32 complete, unique URL-keyed shards',()=>{
 assert.equal(index.schemaVersion,1);
 assert.equal(index.source.verificationStatus,'source-extracted');
 assert.match(index.source.commit,/^[0-9a-f]{40}$/);
 assert.deepEqual(index.counts,{units:581,armies:19,unitsWithWarnings:269});
 assert.equal(armies.armies.length,19);
 assert.equal(readdirSync(new URL('shards/',root)).filter(x=>x.endsWith('.json')).length,32);
 assert.equal(index.entries.length,581);
 assert.equal(allUnits.length,581);
 assert.equal(new Set(allUnits.map(x=>x.id)).size,581);
 assert.equal(new Set(allUnits.map(x=>x.source.sourceUrl)).size,581);
 for(const entry of index.entries){
  const u=shards[entry.shard].records[entry.id];
  assert.ok(u,'Missing '+entry.id);
  assert.equal(u.id,entry.id);
  assert.equal(u.source.sourceUrl,entry.sourceUrl);
  assert.equal(entry.shard,shardForId(entry.id));
  assert.equal(shards[entry.shard].sourceCommit,index.source.commit);
  assert.equal(u.source.verificationStatus,'source-extracted');
  assert.equal(u.legalityVerified,false);
  assert.ok(Array.isArray(u.modelProfiles)&&u.modelProfiles.length>0);
 }
});
test('Lothern Sea Guard retains exact source cost, rules, model stats and shared options',()=>{
 const u=byId['unit:lothern-sea-guard'];
 assert.equal(u.name,'Lothern Sea Guard');
 assert.deepEqual(u.classification.unitCategory,['Infantry']);
 assert.equal(u.basePoints.amount,10);
 assert.equal(u.basePoints.basis,'per_model');
 assert.equal(u.modelProfiles.length,2);
 assert.deepEqual(u.modelProfiles[0].characteristics,{M:5,WS:4,BS:4,S:3,T:3,W:1,I:4,A:1,Ld:8});
 assert.equal(u.modelProfiles[1].characteristics.BS,5);
 assert.equal(u.modelProfiles[1].characteristics.A,2);
 assert.equal(u.startingEquipment.length,4);
 assert.equal(u.startingRules.length,5);
 assert.deepEqual(u.optionalRules.map(x=>x.name),['Veteran']);
 assert.equal(u.upgradeGroups.length,3);
 assert.equal(u.upgradeGroups.reduce((n,g)=>n+g.options.length,0),7);
 assert.equal(u.upgradeGroups[2].eligibilityClause,'0-1 unit per 1,000 points may:');
 assert.equal(u.upgradeGroups[2].options.length,2);
 assert.equal(u.upgradeGroups[1].options[3].magicItemPointsCap,25);
 assert.equal(u.source.publicationCitation,'Forces of Fantasy, p. 162');
 assert.equal(u.source.sourceUpdatedAt.slice(0,10),'2026-07-10');
});
test('Composite beast pack and mounted behemoth keep their component profiles and review flags',()=>{
 const pack=byId['unit:wood-elf-beast-pack'];
 const stega=byId['unit:ancient-stegadon'];
 assert.equal(pack.modelProfiles.length,5);
 assert.ok(pack.extractionWarnings.length);
 assert.equal(pack.classification.modelTroopTypes['Bear of Loren'],'War Beast');
 assert.equal(stega.modelProfiles.length,2);
 assert.ok(stega.extractionWarnings.some(x=>x.includes('Unmapped')));
 assert.equal(stega.basePoints.amount,230);
});
test('Index matching is conservative: exact name or actual unit reference URL only',()=>{
 assert.equal(normalizeUnitLabel("  Ship’s  Company "),"ship's company");
 assert.equal(findIndexedUnit({name:'Lothern Sea Guard',reference:null},index)?.id,'unit:lothern-sea-guard');
 assert.equal(findIndexedUnit({name:' LOTHERN SEA GUARD ',reference:null},index)?.id,'unit:lothern-sea-guard');
 assert.equal(findIndexedUnit({name:'Imaginary Lothern Sea Guard',reference:null},index),null);
 assert.equal(findIndexedUnit({name:'Lothern Sea Guard',reference:{url:'https://untrusted.test/unit/lothern-sea-guard'}},index),null);
 assert.equal(findIndexedUnit({name:'Lothern Sea Guard',reference:{url:'https://tow.whfb.app/unit/lothern-sea-guard?evil=1'}},index),null);
 assert.equal(findIndexedUnit({name:'Wrong display',reference:{url:'https://tow.whfb.app/unit/lothern-sea-guard'}},index)?.id,'unit:lothern-sea-guard');
 const duplicate={entries:[index.entries.find(e=>e.id==='unit:lothern-sea-guard'),
  {...index.entries.find(e=>e.id==='unit:ishaya-vess'),name:'Lothern Sea Guard'}]};
 assert.equal(findIndexedUnit({name:'Lothern Sea Guard',reference:null},duplicate),null);
});
test('Matching links units only and does not modify imported points or options',()=>{
 const army=makeArmy(['Lothern Sea Guard','Unknown battle unit','Lothern Sea Guard']);
 const before=JSON.stringify(army.units.map(u=>({points:u.reportedPoints,selections:u.selections})));
 const {added}=applyUnitDataReferences(army,index);
 assert.equal(added,2);
 assert.equal(army.stats.matchedUnits,2);
 assert.equal(army.stats.unmatchedUnits,1);
 assert.equal(army.stats.matchedSelections,0);
 assert.equal(army.units[0].reference.source,'published-unit-data');
 assert.equal(army.units[2].reference.verificationStatus,'source-extracted');
 assert.equal(army.units[1].reference,null);
 assert.equal(JSON.stringify(army.units.map(u=>({points:u.reportedPoints,selections:u.selections}))),before);
 const matchedAgain=applyUnitDataReferences(army,index);
 assert.equal(matchedAgain.added,0);
 assert.equal(army.units[0].reference.url,'https://tow.whfb.app/unit/lothern-sea-guard');
 const reviewed=makeArmy(['Lothern Sea Guard']);
 reviewed.units[0].reference={url:'https://tow.whfb.app/unit/lothern-sea-guard',source:'reviewed',id:'unit:custom'};
 reviewed.units[0].matchStatus='matched';
 applyUnitDataReferences(reviewed,index);
 assert.equal(reviewed.units[0].reference.id,'unit:custom');
});
test('Only the relevant shard loads; duplicates share a single request',async()=>{
 const army=makeArmy(['Lothern Sea Guard','Lothern Sea Guard','Unknown']);
 const seen=[];
 const spy=async(url)=>{seen.push(url);return fetchFromFiles(url);};
 const manifest=await loadUnitDataIndex({fetcher:spy});
 const results=await getUnitDetails(army,manifest,{fetcher:spy});
 assert.equal(results.matched,2);
 assert.deepEqual(Object.keys(results.records),['u1','u2']);
 assert.equal(results.records.u1.id,'unit:lothern-sea-guard');
 assert.equal(results.records.u2.id,'unit:lothern-sea-guard');
 assert.equal(seen.filter(url=>url.endsWith('/'+shardForId('unit:lothern-sea-guard')+'.json')).length,1);
 assert.equal(results.errors.length,0);
});
test('Cached manifest and loaded shards remain readable offline after first use',async()=>{
 const manifest=await loadUnitDataIndex({fetcher:()=>{throw Error('offline');},force:true});
 assert.equal(manifest.counts.units,581);
 const army=makeArmy(['Lothern Sea Guard']);
 const result=await getUnitDetails(army,manifest,{fetcher:()=>{throw Error('offline');}});
 assert.equal(result.matched,1);
});
test('Renderer escapes remote descriptions and distinguishes standard from optional rules',()=>{
 class FakeNode{
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.className='';}
  append(...nodes){this.children.push(...nodes);}
 }
 const fakeDoc={createElement:tag=>new FakeNode(tag)};
 const u=structuredClone(byId['unit:lothern-sea-guard']);
 u.upgradeGroups[0].options[0].description='<script>alert("x")</script>';
 u.upgradeGroups[0].options[0].linkedReferences.push({
  name:'External',sourceUrl:'https://example.com/malware'
 });
 const el=renderUnitDataDetails(u,fakeDoc);
 function flatten(n){return n.textContent+' '+n.children.map(flatten).join(' ');}
 const content=flatten(el);
 assert.ok(content.includes('View unit source data'));
 assert.ok(content.includes('Starting equipment'));
 assert.ok(content.includes('Optional rules (not automatically active)'));
 assert.ok(content.includes('0-1 unit per 1,000 points may:'));
 assert.ok(content.includes('<script>alert("x")</script>'));
 assert.ok(content.includes('Source-extracted, not rules-verified'));
 function traverse(n){return [n,...n.children.flatMap(traverse)];}
 assert.equal(traverse(el).filter(x=>x.tag==='script').length,0);
 assert.equal(traverse(el).filter(x=>x.tag==='a'&&x.href?.startsWith('https://example.com')).length,0);
 assert.ok(traverse(el).some(x=>x.tag==='a'&&x.href==='https://tow.whfb.app/unit/lothern-sea-guard'));
});
test('Bundle builder rejects missing source unit pages or incomplete source coverage',()=>{
 const partial={schemaVersion:'1.1.0',coverage:{sourceUnitCount:581,sourceArmyCount:19,
   failedPages:1},units:[],armies:[]};
 assert.throws(()=>buildUnitDataBundle(partial),/incomplete source/);
});

test('Browser wiring loads source data but retains original exported roster state',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
 assert.match(html,/v1 Game Screen preview/);
 assert.match(html,/id="unitDataStatus"/);
 assert.match(html,/app\.js\?v=1\.0\.0-alpha\.4/);
 assert.match(app,/loadUnitDataIndex\(\)/);
 assert.match(app,/applyUnitDataReferences\(army,index\)/);
 assert.match(app,/getUnitDetails\(army,index\)/);
 assert.match(app,/renderUnitDataDetails\(detailedRecord\)/);
 assert.match(app,/unitDataRecords=\{\}/);
 assert.match(css,/\.unit-data-stat-scroll\{[^}]*overflow-x:auto/);
 assert.match(css,/\.unit-data-summary\{[^}]*min-height:44px/);
});
test('Mismatched source commit in a downloaded shard is never displayed as verified data',async()=>{
 const invalidIndex=structuredClone(index);
 invalidIndex.source.commit='1111111111111111111111111111111111111111';
 const army=makeArmy(['Lothern Sea Guard']);
 const out=await getUnitDetails(army,invalidIndex,{fetcher:fetchFromFiles});
 assert.equal(out.matched,0);
 assert.equal(out.records.u1,undefined);
 assert.ok(out.errors.some(x=>x.includes('Invalid unit data shard')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SOURCE_ORIGIN,SITEMAP_URL,parseRulesSitemap,assembleRulesIndex,
  lookupIndexedRule
} from '../scripts/build-rules-reference-index.mjs';

const root=new URL('../docs/reference-records/',import.meta.url);
const rules=JSON.parse(readFileSync(new URL('rules-index.json',root),'utf8'));
const summary=JSON.parse(readFileSync(new URL('rules-summary.json',root),'utf8'));

function sampleHtml(){
  const entries=[
    ['Drilled','/special-rules/drilled'],
    ['Strike First','/special-rules/strike-first'],
    ['Ambushers','/special-rules/ambushers'],
    ['Armour Bane (X)','/special-rules/armour-bane'],
    ['Ambiguous Label','/special-rules/ambiguous-first'],
    ['Ambiguous Label','/the-combat-phase/ambiguous-second'],
    ...Array.from({length:520},(_,i)=>['Sample '+i,'/special-rules/sample-'+i])
  ];
  return '<html><body><nav><a href="/unit/incorrect">A unit</a></nav>'+
    '<h2>Sections</h2><ul><li><a href="/special-rules">Special Rules</a></li>'+
    '<li><a href="/weapons-of-war">Weapons of War</a></li></ul>'+
    '<h2><span>Index</span></h2><main><ul>'+
    entries.map(([name,url])=>'<li><a class="rule" href="'+url+'">'+name+'</a></li>').join('')+
    '<li><a href="/special-rules/drilled">Drilled</a></li>'+
    '<li><a href="/special-rules/drilled">Drilled variant name</a></li>'+
    '<li><a href="https://not-tow.example/special-rules/fake">Fake rule</a></li>'+
    '<li><a href="/special-rules/drilled?x=1">Query variant</a></li>'+
    '<li><a href="/army/high-elf-realms">An army</a></li>'+
    '</ul></main><footer><a href="/sitemap/armies">Other sitemap</a></footer>'+
    '<script><h2>Index</h2><a href="/special-rules/script-fake">Fake</a></script>'+
    '</body></html>';
}

test('Rules sitemap importer recognizes sections and indexed links, excluding unsafe and unrelated links',()=>{
 const data=parseRulesSitemap(sampleHtml());
 assert.deepEqual(data.sections.map(s=>s.name),['Special Rules','Weapons of War']);
 assert.equal(data.entries.length,526);
 assert.equal(data.entries.find(e=>e.name==='Drilled').url,SOURCE_ORIGIN+'/special-rules/drilled');
 assert.equal(data.entries.find(e=>e.name==='Drilled').alternateNames[0],'Drilled variant name');
 assert.ok(!data.entries.some(e=>e.name==='Fake rule'||e.name==='Fake'||e.name==='An army'||e.name==='Query variant'));
 assert.equal(data.countByCategory['special-rules'],525);
 assert.equal(data.countByCategory['the-combat-phase'],1);
 assert.equal(data.ambiguousNames.length,1);
 assert.equal(data.ambiguousNames[0].name,'ambiguous label');
 assert.equal(data.ambiguousNames[0].sourceUrls.length,2);
 assert.equal(lookupIndexedRule('Ambiguous Label',data.entries),null);
 assert.equal(lookupIndexedRule('DRILLED',data.entries)?.url,SOURCE_ORIGIN+'/special-rules/drilled');
 assert.equal(lookupIndexedRule('No such rule',data.entries),null);
});

test('Sitemap parser refuses empty, missing-heading and unexpectedly small snapshots',()=>{
 assert.throws(()=>parseRulesSitemap(''),/Invalid or oversized/);
 assert.throws(()=>parseRulesSitemap('<h2>Other</h2>'),/alphabetical Index/);
 assert.throws(()=>parseRulesSitemap('<h2>Index</h2><a href="/special-rules/drilled">Drilled</a>'),/Unexpected rules-index size/);
});

test('Rules index preserves one real source URL per record and source verification status',()=>{
 assert.equal(rules.schemaVersion,1);
 assert.equal(rules.collectionType,'source-reference-index');
 assert.equal(rules.source.origin,SOURCE_ORIGIN);
 assert.equal(rules.source.url,SITEMAP_URL);
 assert.equal(rules.source.verificationStatus,'source-indexed');
 assert.equal(rules.source.sourceVersion,null);
 assert.equal(rules.scope.startsWith('All entries published'),true);
 assert.ok(rules.counts.entries>=1000);
 assert.equal(rules.entries.length,rules.counts.entries);
 assert.equal(new Set(rules.entries.map(e=>e.id)).size,rules.entries.length);
 assert.equal(new Set(rules.entries.map(e=>e.url)).size,rules.entries.length);
 for(const e of rules.entries){
  assert.equal(e.id,'rule-ref:'+e.path);
  assert.equal(e.verificationStatus,'source-indexed');
  assert.equal(e.path,new URL(e.url).pathname);
  assert.equal(e.categoryPath,e.path.split('/')[1]);
  assert.equal(new URL(e.url).origin,SOURCE_ORIGIN);
  assert.ok(Array.isArray(e.alternateNames));
  assert.ok(e.name.length>0);
 }
 assert.ok(rules.counts.sections>=25);
 assert.equal(rules.sections.length,rules.counts.sections);
 assert.ok(rules.categories['special-rules']>=500);
 assert.ok(rules.categories['weapons-of-war']>=100);
 assert.equal(Object.values(rules.categories).reduce((a,b)=>a+b,0),rules.counts.entries);
});

test('Common High Elf and combat references resolve to exact source URLs',()=>{
 for(const [name,path] of [
  ['Drilled','/special-rules/drilled'],
  ['Strike First','/special-rules/strike-first'],
  ['Naval Discipline','/special-rules/naval-discipline'],
  ['Armour Bane (X)','/special-rules/armour-bane'],
  ['Elven Reflexes','/special-rules/elven-reflexes'],
  ['Valour of Ages','/special-rules/valour-of-ages']
 ]){
  const matched=lookupIndexedRule(name,rules.entries);
  assert.ok(matched,'Missing indexed rule '+name);
  assert.equal(matched.url,SOURCE_ORIGIN+path);
 }
 for(const item of rules.ambiguousNames){
  assert.ok(item.sourceUrls.length>1);
  assert.equal(new Set(item.sourceUrls).size,item.sourceUrls.length);
  assert.equal(lookupIndexedRule(item.name,rules.entries),null,
   'Ambiguous names must not be guessed');
 }
});

test('Summary and indexed source counts are internally consistent',()=>{
 assert.equal(summary.schemaVersion,1);
 assert.equal(summary.sourceUrl,SITEMAP_URL);
 assert.equal(summary.checkedAt,rules.source.checkedAt);
 assert.equal(summary.verificationStatus,'source-indexed');
 assert.equal(summary.entries,rules.counts.entries);
 assert.equal(summary.sections,rules.counts.sections);
 assert.equal(summary.ambiguousNames,rules.counts.ambiguousNames);
 assert.deepEqual(summary.categories,rules.categories);
 assert.ok(summary.sampleEntries.some(e=>e.name==='Drilled'&&e.url===SOURCE_ORIGIN+'/special-rules/drilled'));
});

test('Collection registry makes High Elves and rules separately discoverable',()=>{
 const collections=JSON.parse(readFileSync(new URL('collections.json',root),'utf8'));
 assert.equal(collections.schemaVersion,1);
 assert.equal(collections.sourceOrigin,SOURCE_ORIGIN);
 assert.deepEqual(collections.collections.map(e=>e.id),['high-elf-realms-units','rules-sitemap']);
 for(const item of collections.collections){
  const other=JSON.parse(readFileSync(new URL(item.path,root),'utf8'));
  assert.equal(other.sourceOrigin||other.source.origin,SOURCE_ORIGIN);
 }
 assert.equal(collections.collections[1].path,'rules-index.json');
});

test('Assembled index preserves checked-at date and does not infer rules text or legality',()=>{
 const d=assembleRulesIndex(sampleHtml(),'2026-11-09T21:00:00.000Z');
 assert.equal(d.source.checkedAt,'2026-11-09T21:00:00.000Z');
 assert.equal(d.counts.entries,526);
 assert.ok(d.entries.every(e=>!('ruleText' in e)&&!('legalityVerified' in e)));
});

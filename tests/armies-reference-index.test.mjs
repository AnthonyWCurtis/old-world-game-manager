import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SOURCE_ORIGIN,SITEMAP_URL,parseArmiesSitemap,assembleArmiesIndex,
  normalizeArmyIndexName,matchArmyIndexReference
} from '../scripts/build-armies-reference-index.mjs';

const root=new URL('../docs/reference-records/',import.meta.url);
const armies=JSON.parse(readFileSync(new URL('armies-index.json',root),'utf8'));
const summary=JSON.parse(readFileSync(new URL('armies-summary.json',root),'utf8'));
const collections=JSON.parse(readFileSync(new URL('collections.json',root),'utf8'));
const highElves=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));

function sampleHtml(){
 const armyEntries=[
  ['Chaos Dwarfs','/army/chaos-dwarfs'],
  ['Grand Cathay','/army/grand-cathay'],
  ['High Elf Realms','/army/high-elf-realms'],
  ...Array.from({length:16},(_,i)=>['Example Army '+i,'/army/example-army-'+i])
 ];
 const unitEntries=[
  ['Ishaya Vess','/unit/ishaya-vess'],
  ['Korhil Lionmane','/unit/korhil-lionmane'],
  ['Daemonsmith Sorcerer','/unit/daemonsmith-sorcerer'],
  ['White Lions of Chrace','/unit/white-lions-of-chrace'],
  ["Ship&#39;s Company",'/unit/ships-company'],
  ['Ambiguous One','/unit/ambiguous-one'],
  ['Ambiguous One','/unit/ambiguous-two'],
  ...Array.from({length:494},(_,i)=>['Example Unit '+i,'/unit/example-unit-'+i])
 ];
 const anchor=([name,url])=>'<li><a class="record" href="'+url+'">'+name+'</a></li>';
 return '<html><body><main>'+
  '<h2>Army Index</h2><ul>'+armyEntries.map(anchor).join('')+'</ul>'+
  '<h2>Unit Index</h2><ul>'+unitEntries.map(anchor).join('')+
  '<li><a href="/unit/ishaya-vess">Ishaya Vess</a></li>'+
  '<li><a href="/unit/ishaya-vess">Ishaya Alternate</a></li>'+
  '<li><a href="https://other.example/unit/fake">External</a></li>'+
  '<li><a href="/unit/korhil-lionmane?tracking=1">Query bad</a></li>'+
  '<li><a href="/army/chaos-dwarfs">Wrong kind</a></li>'+
  '</ul></main>'+
  '<footer><a href="/unit/footer-only">Footer only</a></footer>'+
  '<script><h2>Unit Index</h2><a href="/unit/script-fake">Script fake</a></script>'+
  '</body></html>';
}

test('Armies sitemap separates Army Index and Unit Index and rejects untrusted links',()=>{
 const data=parseArmiesSitemap(sampleHtml());
 assert.equal(data.totals.armies,19);
 assert.equal(data.totals.units,501);
 assert.equal(data.totals.entries,520);
 assert.equal(data.entries.length,520);
 assert.equal(data.entries.filter(e=>e.kind==='army').length,19);
 assert.equal(data.entries.filter(e=>e.kind==='unit').length,501);
 assert.equal(data.ambiguousNames.length,1);
 assert.equal(data.ambiguousNames[0].name,'ambiguous one');
 assert.equal(data.ambiguousNames[0].kind,'unit');
 assert.equal(data.ambiguousNames[0].sourceUrls.length,2);
 const ship=data.entries.find(e=>e.name==="Ship's Company");
 assert.equal(ship.url,SOURCE_ORIGIN+'/unit/ships-company');
 const ishaya=data.entries.find(e=>e.name==='Ishaya Vess');
 assert.deepEqual(ishaya.alternateNames,['Ishaya Alternate']);
 for(const invalid of ['External','Footer only','Script fake','Query bad','Wrong kind']){
  assert.ok(!data.entries.some(e=>e.name===invalid),invalid);
 }
 assert.equal(matchArmyIndexReference('Ambiguous One','unit',data.entries),null);
 assert.equal(matchArmyIndexReference('Ishaya Alternate','unit',data.entries)?.url,ishaya.url);
 assert.equal(matchArmyIndexReference('Chaos Dwarfs','unit',data.entries),null);
 assert.equal(matchArmyIndexReference('High Elf Realms','army',data.entries)?.url,SOURCE_ORIGIN+'/army/high-elf-realms');
 assert.equal(matchArmyIndexReference('Ishaya Vess','army',data.entries),null);
 assert.equal(matchArmyIndexReference('Ishaya Vess','other',data.entries),null);
 assert.equal(normalizeArmyIndexName('  Ship’s Company  '),"ship's company");
});

test('Armies importer refuses incomplete, unexpected or unstructured source pages',()=>{
 assert.throws(()=>parseArmiesSitemap(''),/Invalid or oversized/);
 assert.throws(()=>parseArmiesSitemap('<h2>Unit Index</h2>'),/Missing Army Index or Unit Index/);
 assert.throws(()=>parseArmiesSitemap('<h2>Army Index</h2>'),/Missing Army Index or Unit Index/);
 assert.throws(()=>parseArmiesSitemap('<h2>Army Index</h2><h2>Unit Index</h2>'),/Unexpected armies sitemap size/);
});

test('Published global army and unit index consists of source-only records',()=>{
 assert.equal(armies.schemaVersion,1);
 assert.equal(armies.collectionType,'source-reference-index');
 assert.equal(armies.source.origin,SOURCE_ORIGIN);
 assert.equal(armies.source.url,SITEMAP_URL);
 assert.equal(armies.source.verificationStatus,'source-indexed');
 assert.equal(armies.source.sourceVersion,null);
 assert.match(armies.scope,/no implied unit-to-army membership/);
 assert.equal(armies.counts.armies,19);
 assert.equal(armies.counts.units,581);
 assert.equal(armies.counts.entries,600);
 assert.equal(armies.counts.ambiguousNames,0);
 assert.deepEqual(armies.sections,[
  {name:'Army Index',count:19},{name:'Unit Index',count:581}
 ]);
 assert.equal(armies.entries.length,600);
 assert.equal(new Set(armies.entries.map(e=>e.id)).size,600);
 assert.equal(new Set(armies.entries.map(e=>e.url)).size,600);
 for(const entry of armies.entries){
  assert.equal(entry.path,new URL(entry.url).pathname);
  assert.equal(entry.id,'army-ref:'+entry.path);
  assert.equal(new URL(entry.url).origin,SOURCE_ORIGIN);
  assert.equal(new URL(entry.url).search,'');
  assert.equal(new URL(entry.url).hash,'');
  assert.equal(entry.verificationStatus,'source-indexed');
  assert.ok(['army','unit'].includes(entry.kind));
  assert.equal(entry.section,entry.kind==='army'?'Army Index':'Unit Index');
  assert.match(entry.path,entry.kind==='army'?/^\/army\//:/^\/unit\//);
  assert.ok(Array.isArray(entry.alternateNames));
  assert.ok(!('faction' in entry));
  assert.ok(!('points' in entry));
  assert.ok(!('unitOptions' in entry));
  assert.ok(!('legalityVerified' in entry));
 }
});

test('Global index contains all 45 existing High Elf unit URLs without altering their detailed records',()=>{
 const indexed=new Set(armies.entries.filter(e=>e.kind==='unit').map(e=>e.url));
 assert.equal(highElves.records.length,45);
 for(const elf of highElves.records){
  assert.ok(indexed.has(elf.sourceUrl),'Missing High Elf reference: '+elf.name);
  const detail=JSON.parse(readFileSync(new URL(elf.path,root),'utf8'));
  assert.equal(detail.source.url,elf.sourceUrl);
  assert.equal(detail.source.verificationStatus,elf.verificationStatus);
 }
});

test('Known faction and unit titles resolve only to their matching page type',()=>{
 for(const [name,kind,path] of [
  ['High Elf Realms','army','/army/high-elf-realms'],
  ['Chaos Dwarfs','army','/army/chaos-dwarfs'],
  ['Grand Cathay','army','/army/grand-cathay'],
  ['Ishaya Vess','unit','/unit/ishaya-vess'],
  ['Korhil Lionmane','unit','/unit/korhil-lionmane'],
  ['Daemonsmith Sorcerer','unit','/unit/daemonsmith-sorcerer'],
  ['White Lions of Chrace','unit','/unit/white-lions-of-chrace']
 ]){
  assert.equal(matchArmyIndexReference(name,kind,armies.entries)?.url,SOURCE_ORIGIN+path,name);
 }
 assert.equal(matchArmyIndexReference('Despot','unit',armies.entries),null,
  'Do not invent an unsupported profile link for Northside Warriors Despot');
 assert.equal(matchArmyIndexReference('Daemonsmith Sorcerer','army',armies.entries),null);
 assert.equal(matchArmyIndexReference('High Elf Realms','unit',armies.entries),null);
});

test('Summary and fourth-collection registry agree with the source snapshot',()=>{
 assert.equal(summary.schemaVersion,1);
 assert.equal(summary.sourceUrl,SITEMAP_URL);
 assert.equal(summary.checkedAt,armies.source.checkedAt);
 assert.equal(summary.verificationStatus,'source-indexed');
 for(const [name,count] of Object.entries(armies.counts))assert.equal(summary[name],count);
 assert.deepEqual(summary.sections,armies.sections);
 assert.ok(summary.sampleEntries.some(e=>e.name==='High Elf Realms'&&e.kind==='army'));
 assert.ok(summary.sampleEntries.some(e=>e.name==='Ishaya Vess'&&e.kind==='unit'));
 assert.deepEqual(collections.collections.map(e=>e.id),[
  'high-elf-realms-units','rules-sitemap','magic-sitemap','armies-sitemap'
 ]);
 const record=collections.collections.find(e=>e.id==='armies-sitemap');
 assert.equal(record.path,'armies-index.json');
 assert.equal(record.sourceUrl,SITEMAP_URL);
});

test('Assembled sitemap preserves provenance without asserting faction affiliation',()=>{
 const record=assembleArmiesIndex(sampleHtml(),'2026-11-09T21:29:00.000Z');
 assert.equal(record.source.checkedAt,'2026-11-09T21:29:00.000Z');
 assert.equal(record.counts.entries,520);
 assert.ok(record.entries.every(e=>e.verificationStatus==='source-indexed'));
 assert.ok(record.entries.every(e=>!('faction' in e)));
});

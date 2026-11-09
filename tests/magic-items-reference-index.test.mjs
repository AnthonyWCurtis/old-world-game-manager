import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SOURCE_ORIGIN,SITEMAP_URL,parseMagicItemsSitemap,assembleMagicItemsIndex,
 normalizeMagicItemName,matchMagicItemReference
} from '../scripts/build-magic-items-reference-index.mjs';

const root=new URL('../docs/reference-records/',import.meta.url);
const items=JSON.parse(readFileSync(new URL('magic-items-index.json',root),'utf8'));
const summary=JSON.parse(readFileSync(new URL('magic-items-summary.json',root),'utf8'));

function sampleHtml(){
 const types=[
  ['High Elf Realms Magic Items','/magic-items/high-elf-realms-magic-items'],
  ['Magic Weapons','/magic-items/magic-weapons'],
  ['Elven Honours','/magic-items/elven-honours'],
  ...Array.from({length:58},(_,i)=>['Example Type '+i,'/magic-items/example-type-'+i])
 ];
 const listed=[
  ["Mathlann&#39;s Ire",'/magic-item/mathlanns-ire'],
  ['Chayal','/magic-item/chayal'],
  ['Ruby Ring of Ruin','/magic-item/ruby-ring-of-ruin'],
  ['Lore Familiar','/magic-item/lore-familiar'],
  ['Reaver Bow','/magic-item/reaver-bow'],
  ['Charmed Shield*','/magic-item/charmed-shield'],
  ['The Pelt of Charandis','/magic-item/the-pelt-of-charandis'],
  ['Ambiguous Gift','/magic-item/ambiguous-one'],
  ['Ambiguous Gift','/magic-item/ambiguous-two'],
  ...Array.from({length:605},(_,i)=>['Example Item '+i,'/magic-item/example-item-'+i])
 ];
 const anchor=([name,url])=>'<li><a class="item" href="'+url+'">'+name+'</a></li>';
 return '<html><body><main><nav><a href="/magic-item/nav-only">Nav</a></nav>'+
  '<h2>Type Index</h2><ul>'+types.map(anchor).join('')+'</ul>'+
  '<h2>Item(/Ability) Index</h2><ul>'+listed.map(anchor).join('')+
  '<li><a href="/magic-item/charmed-shield">Charmed Shield with footnote</a></li>'+
  '<li><a href="/magic-item/chayal?tracking=1">Tracking query</a></li>'+
  '<li><a href="https://other.example/magic-item/fake">External</a></li>'+
  '<li><a href="/magic-items/magic-weapons">Wrong kind</a></li>'+
  '</ul></main><footer><a href="/magic-item/footer-only">Footer</a></footer>'+
  '<script><h2>Item(/Ability) Index</h2><a href="/magic-item/script-fake">Fake</a></script>'+
  '</body></html>';
}

test('Magic Items sitemap separates type and item/ability links, preserving footnote markers',()=>{
 const data=parseMagicItemsSitemap(sampleHtml());
 assert.deepEqual(data.totals,{types:61,itemsAndAbilities:614,entries:675});
 assert.equal(data.entries.length,675);
 assert.equal(data.ambiguousNames.length,1);
 assert.equal(data.ambiguousNames[0].name,'ambiguous gift');
 assert.equal(data.ambiguousNames[0].kind,'item-or-ability');
 assert.equal(data.ambiguousNames[0].sourceUrls.length,2);
 const charmed=data.entries.find(e=>e.name==='Charmed Shield*');
 assert.ok(charmed);
 assert.equal(charmed.url,SOURCE_ORIGIN+'/magic-item/charmed-shield');
 assert.deepEqual(charmed.alternateNames,['Charmed Shield with footnote']);
 assert.equal(matchMagicItemReference('Charmed Shield','item-or-ability',data.entries)?.url,charmed.url);
 assert.equal(matchMagicItemReference('charmed shield*','item-or-ability',data.entries)?.url,charmed.url);
 assert.equal(matchMagicItemReference('Ambiguous Gift','item-or-ability',data.entries),null);
 assert.equal(matchMagicItemReference('Magic Weapons','type',data.entries)?.url,SOURCE_ORIGIN+'/magic-items/magic-weapons');
 assert.equal(matchMagicItemReference('Magic Weapons','item-or-ability',data.entries),null);
 assert.equal(matchMagicItemReference('not an item','item-or-ability',data.entries),null);
 assert.equal(matchMagicItemReference('Magic Weapons','incorrect',data.entries),null);
 assert.equal(normalizeMagicItemName('  King’s Gift*  '),"king's gift");
 assert.ok(!data.entries.some(e=>['Tracking query','External','Wrong kind','Footer','Fake','Nav'].includes(e.name)));
});

test('Sitemap importer refuses truncated, invalid or unexpected source data',()=>{
 assert.throws(()=>parseMagicItemsSitemap(''),/Invalid or oversized/);
 assert.throws(()=>parseMagicItemsSitemap('<h2>Type Index</h2>'),/Missing Type Index or Item/);
 assert.throws(()=>parseMagicItemsSitemap('<h2>Item\(\/Ability\) Index</h2>'),/Missing Type Index or Item/);
 assert.throws(()=>parseMagicItemsSitemap('<h2>Type Index</h2><h2>Item(/Ability) Index</h2>'),/Unexpected magic items sitemap size/);
});

test('Published Magic Items snapshot has unique same-origin URLs and source-only provenance',()=>{
 assert.equal(items.schemaVersion,1);
 assert.equal(items.collectionType,'source-reference-index');
 assert.equal(items.source.origin,SOURCE_ORIGIN);
 assert.equal(items.source.url,SITEMAP_URL);
 assert.equal(items.source.verificationStatus,'source-indexed');
 assert.equal(items.source.sourceVersion,null);
 assert.equal(items.source.method,'single bounded public sitemap HTML fetch; titles and source URLs only');
 assert.ok(items.counts.types>=55);
 assert.ok(items.counts.itemsAndAbilities>=600);
 assert.equal(items.counts.entries,items.counts.types+items.counts.itemsAndAbilities);
 assert.equal(items.entries.length,items.counts.entries);
 assert.deepEqual(items.sections,[
  {name:'Type Index',count:items.counts.types},
  {name:'Item(/Ability) Index',count:items.counts.itemsAndAbilities}
 ]);
 assert.equal(new Set(items.entries.map(x=>x.id)).size,items.entries.length);
 assert.equal(new Set(items.entries.map(x=>x.url)).size,items.entries.length);
 for(const entry of items.entries){
  assert.equal(entry.id,'magic-item-ref:'+entry.path);
  assert.equal(entry.path,new URL(entry.url).pathname);
  assert.equal(new URL(entry.url).origin,SOURCE_ORIGIN);
  assert.equal(new URL(entry.url).search,'');
  assert.equal(new URL(entry.url).hash,'');
  assert.equal(entry.verificationStatus,'source-indexed');
  assert.ok(['type','item-or-ability'].includes(entry.kind));
  assert.equal(entry.section,entry.kind==='type'?'Type Index':'Item(/Ability) Index');
  assert.match(entry.path,entry.kind==='type'?/^\/magic-items\//:/^\/magic-item\//);
  assert.ok(Array.isArray(entry.alternateNames));
  assert.ok(entry.name.length>0);
  for(const missing of ['points','faction','itemType','eligibility','equipmentProfile','rulesText','legalityVerified']){
   assert.ok(!(missing in entry),entry.name+' should not guess '+missing);
  }
 }
});

test('Common High Elf magical gear and categories have exact unique source links',()=>{
 for(const [name,kind,path] of [
  ['High Elf Realms Magic Items','type','/magic-items/high-elf-realms-magic-items'],
  ['Magic Weapons','type','/magic-items/magic-weapons'],
  ['Elven Honours','type','/magic-items/elven-honours'],
  ["Mathlann's Ire",'item-or-ability','/magic-item/mathlanns-ire'],
  ['Chayal','item-or-ability','/magic-item/chayal'],
  ['Ruby Ring of Ruin','item-or-ability','/magic-item/ruby-ring-of-ruin'],
  ['Lore Familiar','item-or-ability','/magic-item/lore-familiar'],
  ['Reaver Bow','item-or-ability','/magic-item/reaver-bow'],
  ['Charmed Shield','item-or-ability','/magic-item/charmed-shield'],
  ['The Pelt of Charandis','item-or-ability','/magic-item/the-pelt-of-charandis']
 ]){
  const matched=matchMagicItemReference(name,kind,items.entries);
  assert.ok(matched,name+' is missing or ambiguous');
  assert.equal(matched.url,SOURCE_ORIGIN+path);
 }
 assert.equal(matchMagicItemReference('Ruby Ring of Ruin','type',items.entries),null);
});

test('Snapshot summary and fourth registry collection agree',()=>{
 assert.equal(summary.schemaVersion,1);
 assert.equal(summary.sourceUrl,SITEMAP_URL);
 assert.equal(summary.checkedAt,items.source.checkedAt);
 assert.equal(summary.verificationStatus,'source-indexed');
 for(const [k,v] of Object.entries(items.counts))assert.equal(summary[k],v);
 assert.deepEqual(summary.sections,items.sections);
 assert.ok(summary.sampleEntries.some(x=>x.name==="Mathlann's Ire"&&x.url===SOURCE_ORIGIN+'/magic-item/mathlanns-ire'));
 const registry=JSON.parse(readFileSync(new URL('collections.json',root),'utf8'));
 assert.deepEqual(registry.collections.map(x=>x.id),[
  'rules-sitemap','magic-sitemap','armies-sitemap','magic-items-sitemap'
 ]);
 const coll=registry.collections.find(x=>x.id==='magic-items-sitemap');
 assert.equal(coll.path,'magic-items-index.json');
 assert.equal(coll.sourceUrl,SITEMAP_URL);
 assert.equal(registry.collections.length,4);
});

test('Assembled records preserve checkedAt and do not imply individual page verification',()=>{
 const data=assembleMagicItemsIndex(sampleHtml(),'2026-11-09T22:00:00.000Z');
 assert.equal(data.source.checkedAt,'2026-11-09T22:00:00.000Z');
 assert.equal(data.counts.entries,675);
 assert.ok(data.entries.every(e=>e.verificationStatus==='source-indexed'));
});

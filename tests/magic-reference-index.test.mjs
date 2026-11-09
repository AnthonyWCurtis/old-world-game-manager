import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SOURCE_ORIGIN,SITEMAP_URL,parseMagicSitemap,assembleMagicIndex,
  normalizeMagicName,matchMagicReference
} from '../scripts/build-magic-reference-index.mjs';

const root=new URL('../docs/reference-records/',import.meta.url);
const magic=JSON.parse(readFileSync(new URL('magic-index.json',root),'utf8'));
const summary=JSON.parse(readFileSync(new URL('magic-summary.json',root),'utf8'));

function sampleHtml(){
  const lores=[
    ['Battle Magic','/the-lores-of-magic/battle-magic'],
    ['Elementalism','/the-lores-of-magic/elementalism'],
    ['High Magic','/the-lores-of-magic/high-magic'],
    ['Illusion','/the-lores-of-magic/illusion'],
    ['Spell Categories (Lores)','/the-lores-of-magic/spell-categories-lores'],
    ['Spells &amp; Spell Generation','/the-lores-of-magic/spells-and-spell-generation'],
    ...Array.from({length:20},(_,i)=>['Other Lore '+i,'/the-lores-of-magic/other-lore-'+i])
  ];
  const spells=[
    ['Drain Magic','/spell/drain-magic'],
    ['Earthen Ramparts','/spell/earthen-ramparts'],
    ['Glittering Robe','/spell/glittering-robe'],
    ['Plague of Rust','/spell/plague-of-rust'],
    ['Travel Mystical Pathway','/spell/travel-mystical-pathway'],
    ['Twin Label','/spell/twin-one'],
    ['Twin Label','/spell/twin-two'],
    ...Array.from({length:105},(_,i)=>['Other Spell '+i,'/spell/other-spell-'+i])
  ];
  const anchor=([name,url])=>'<li><a class="unit" href="'+url+'">'+name+'</a></li>';
  return '<html><body><main>'+
    '<nav><a href="/spell/outside">Outside</a></nav>'+
    '<h2>Magic Lore Index</h2><ul>'+lores.map(anchor).join('')+'</ul>'+
    '<h2>Spell Index</h2><ul>'+spells.map(anchor).join('')+
    '<li><a href="/spell/drain-magic">Drain Magic</a></li>'+
    '<li><a href="/spell/drain-magic">Drain Magick</a></li>'+
    '<li><a href="https://not-tow.example/spell/fake">External</a></li>'+
    '<li><a href="/spell/glittering-robe?tracking=1">Query variant</a></li>'+
    '<li><a href="/unit/archmage">Not a spell</a></li>'+
    '</ul></main><footer><a href="/spell/outside">Outside</a></footer>'+
    '<script><h2>Spell Index</h2><a href="/spell/script-fake">Script fake</a></script>'+
    '</body></html>';
}

test('Magic sitemap parser separates lore, guidance and spell links using exact source URLs',()=>{
 const data=parseMagicSitemap(sampleHtml());
 assert.equal(data.totals.loreSection,26);
 assert.equal(data.totals.spellSection,112);
 assert.equal(data.totals.lores,24);
 assert.equal(data.totals.magicReferences,2);
 assert.equal(data.totals.spells,112);
 assert.equal(data.totals.entries,138);
 assert.equal(data.entries.length,138);
 assert.equal(data.ambiguousNames.length,1);
 assert.equal(data.ambiguousNames[0].name,'twin label');
 assert.equal(data.ambiguousNames[0].sourceUrls.length,2);
 const drain=data.entries.find(e=>e.name==='Drain Magic');
 assert.equal(drain.url,SOURCE_ORIGIN+'/spell/drain-magic');
 assert.deepEqual(drain.alternateNames,['Drain Magick']);
 assert.equal(data.entries.find(e=>e.name==='Spells & Spell Generation').kind,'magic-reference');
 assert.equal(data.entries.find(e=>e.name==='High Magic').kind,'lore');
 assert.ok(!data.entries.some(e=>['Outside','External','Query variant','Not a spell','Script fake'].includes(e.name)));
 assert.equal(matchMagicReference('Twin Label','spell',data.entries),null);
 assert.equal(matchMagicReference('drain magic','spell',data.entries)?.url,drain.url);
 assert.equal(matchMagicReference('Drain Magick','spell',data.entries)?.url,drain.url);
 assert.equal(matchMagicReference('Drain Magic','lore',data.entries),null);
 assert.equal(normalizeMagicName('  Mork’s Curse  '),"mork's curse");
});

test('Magic sitemap parser fails closed for missing headings, empty or truncated data',()=>{
 assert.throws(()=>parseMagicSitemap(''),/Invalid or oversized/);
 assert.throws(()=>parseMagicSitemap('<h2>Magic Lore Index</h2>'),/Missing Magic Lore Index or Spell Index/);
 assert.throws(()=>parseMagicSitemap('<h2>Spell Index</h2>'),/Missing Magic Lore Index or Spell Index/);
 assert.throws(()=>parseMagicSitemap('<h2>Magic Lore Index</h2><h2>Spell Index</h2>'),/Unexpected magic sitemap size/);
});

test('Published magic index has the exact structure of the source sitemap',()=>{
 assert.equal(magic.schemaVersion,1);
 assert.equal(magic.collectionType,'source-reference-index');
 assert.equal(magic.source.origin,SOURCE_ORIGIN);
 assert.equal(magic.source.url,SITEMAP_URL);
 assert.equal(magic.source.verificationStatus,'source-indexed');
 assert.equal(magic.source.sourceVersion,null);
 assert.equal(magic.counts.entries,170);
 assert.equal(magic.counts.loreSection,31);
 assert.equal(magic.counts.spellSection,139);
 assert.equal(magic.counts.lores,29);
 assert.equal(magic.counts.magicReferences,2);
 assert.equal(magic.counts.spells,139);
 assert.equal(magic.counts.ambiguousNames,0);
 assert.equal(magic.ambiguousNames.length,0);
 assert.deepEqual(magic.sections,[
  {name:'Magic Lore Index',count:31},{name:'Spell Index',count:139}
 ]);
 assert.equal(magic.entries.length,170);
 assert.equal(new Set(magic.entries.map(e=>e.url)).size,170);
 assert.equal(new Set(magic.entries.map(e=>e.id)).size,170);
 for(const entry of magic.entries){
  assert.equal(new URL(entry.url).origin,SOURCE_ORIGIN);
  assert.equal(new URL(entry.url).search,'');
  assert.equal(new URL(entry.url).hash,'');
  assert.equal(entry.path,new URL(entry.url).pathname);
  assert.equal(entry.id,'magic-ref:'+entry.path);
  assert.equal(entry.verificationStatus,'source-indexed');
  assert.ok(['lore','spell','magic-reference'].includes(entry.kind));
  assert.equal(entry.section,entry.kind==='spell'?'Spell Index':'Magic Lore Index');
  assert.ok(Array.isArray(entry.alternateNames));
  assert.ok(!('castingValue' in entry));
  assert.ok(!('rulesText' in entry));
  assert.ok(!('legalityVerified' in entry));
  assert.ok(entry.name.length);
 }
});

test('Familiar High Elf lores and spells match uniquely by exact name and kind',()=>{
 const expected=[
  ['Elementalism','lore','/the-lores-of-magic/elementalism'],
  ['High Magic','lore','/the-lores-of-magic/high-magic'],
  ['Illusion','lore','/the-lores-of-magic/illusion'],
  ['Drain Magic','spell','/spell/drain-magic'],
  ['Earthen Ramparts','spell','/spell/earthen-ramparts'],
  ['Glittering Robe','spell','/spell/glittering-robe'],
  ['Plague of Rust','spell','/spell/plague-of-rust'],
  ['Travel Mystical Pathway','spell','/spell/travel-mystical-pathway'],
  ['Spell Categories (Lores)','magic-reference','/the-lores-of-magic/spell-categories-lores']
 ];
 for(const [name,kind,path] of expected){
  const match=matchMagicReference(name,kind,magic.entries);
  assert.ok(match,'Missing '+name);
  assert.equal(match.url,SOURCE_ORIGIN+path);
  assert.equal(match.kind,kind);
 }
 assert.equal(matchMagicReference('Unknown spell','spell',magic.entries),null);
 assert.equal(matchMagicReference('Drain Magic','lore',magic.entries),null);
});

test('Magic summary and collection registry preserve counts and provenance',()=>{
 assert.equal(summary.schemaVersion,1);
 assert.equal(summary.sourceUrl,SITEMAP_URL);
 assert.equal(summary.checkedAt,magic.source.checkedAt);
 assert.equal(summary.verificationStatus,'source-indexed');
 for(const [name,count] of Object.entries(magic.counts))assert.equal(summary[name],count);
 assert.deepEqual(summary.sections,magic.sections);
 const collections=JSON.parse(readFileSync(new URL('collections.json',root),'utf8'));
 assert.deepEqual(collections.collections.map(x=>x.id),
  ['high-elf-realms-units','rules-sitemap','magic-sitemap']);
 const record=collections.collections.find(x=>x.id==='magic-sitemap');
 assert.equal(record.path,'magic-index.json');
 assert.equal(record.sourceUrl,SITEMAP_URL);
});
test('Assembled magic records retain timestamp and don't claim verified spell content',()=>{
 const record=assembleMagicIndex(sampleHtml(),'2026-11-09T21:00:00.000Z');
 assert.equal(record.source.checkedAt,'2026-11-09T21:00:00.000Z');
 assert.equal(record.counts.entries,138);
 assert.ok(record.entries.every(e=>e.verificationStatus==='source-indexed'));
});

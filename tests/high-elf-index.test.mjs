import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  HIGH_ELF_INDEX_NAMES,resolveIndexUrls,parsePageProfile,parseUnitPage
} from '../scripts/build-high-elf-reference-index.mjs';

const ROOT=new URL('../docs/reference-records/',import.meta.url);
const SOURCE='https://tow.whfb.app';
const cleanSlug=name=>name.toLowerCase().replace(/['()]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

test('High Elf reference index enumerates 45 distinct units from eight source categories',()=>{
 assert.equal(HIGH_ELF_INDEX_NAMES.length,45);
 assert.equal(new Set(HIGH_ELF_INDEX_NAMES.map(x=>x.name)).size,45);
 assert.deepEqual([...new Set(HIGH_ELF_INDEX_NAMES.map(x=>x.category))],[
  'Named Character Units','Character Units','Mount Units','Infantry Units',
  'Cavalry Units','Chariot Units','Monster Units','War Machine Units'
 ]);
 assert.deepEqual(
  Object.fromEntries([...new Set(HIGH_ELF_INDEX_NAMES.map(x=>x.category))]
   .map(x=>[x,HIGH_ELF_INDEX_NAMES.filter(e=>e.category===x).length])),
  {'Named Character Units':2,'Character Units':9,'Mount Units':6,'Infantry Units':11,
   'Cavalry Units':4,'Chariot Units':4,'Monster Units':8,'War Machine Units':1});
});

test('Unit URLs must be sourced from exact, unique, same-origin HTML anchors',()=>{
 const html='<main>'+HIGH_ELF_INDEX_NAMES
   .map(x=>'<a href="/unit/'+cleanSlug(x.name)+'">'+x.name.replace(/'/g,'&#39;')+'</a>')
   .join('\n')+'</main>';
 const records=resolveIndexUrls(html);
 assert.equal(records.length,45);
 assert.ok(records.every((r,i)=>r.name===HIGH_ELF_INDEX_NAMES[i].name));
 assert.ok(records.every(x=>x.url.startsWith(SOURCE+'/unit/')));
 assert.throws(()=>resolveIndexUrls(html.replace('/unit/archmage','https://example.com/unit/archmage')),/Archmage/);
 assert.throws(()=>resolveIndexUrls(html+'<a href="/unit/another-archmage">Archmage</a>'),/uniquely resolve/);
});

test('Structured profile extraction keeps variant/mount modifiers, missing cells and component names',()=>{
 const cells=(name,values)=>'<tr>'+[name,...values].map(x=>'<td>'+x+'</td>').join('')+'</tr>';
 const markup='<main><h1>High Elf Unit</h1>'+
  '<table class="generic-table unit-profile-table"><tbody>'+
  cells('High Elf Unit',['5','6','4','3','3','2','5','3','9'])+
  cells('Barded Elven Steed',['8','3','-','3','-','(+1)','4','1','-'])+
  '</tbody></table>'+
  '<p>Cost: 105 points per model</p>'+
  '<p>Unit Category: Cavalry</p><p>Troop Type: Heavy Cavalry</p>'+
  '<p>Base Size: 30 x 60 mm</p><p>Unit Size: 5+</p>'+
  '<p><a href="/weapons-of-war/hand-weapon">Hand weapon</a></p>'+
  '<p><a href="/special-rules/valour-of-ages">Valour of Ages</a></p>'+
  '<p><a href="https://elsewhere.example/magic-item/fake">Fake</a></p>'+
  '</main>';
 const models=parsePageProfile(markup);
 assert.equal(models.length,2);
 assert.deepEqual(models[0].characteristics,{M:5,WS:6,BS:4,S:3,T:3,W:2,I:5,A:3,Ld:9});
 assert.deepEqual(models[1].characteristics,{M:8,WS:3,BS:null,S:3,T:null,W:'(+1)',I:4,A:1,Ld:null});
 const details=parseUnitPage(markup);
 assert.equal(details.costDescription,'105 points per model');
 assert.equal(details.unitCategory,'Cavalry');
 assert.equal(details.troopTypeDescription,'Heavy Cavalry');
 assert.equal(details.baseSizeDescription,'30 x 60 mm');
 assert.equal(details.unitSizeDescription,'5+ Hand weapon Valour of Ages Fake'); // field is deliberately unverified raw section
 assert.ok(details.pageLinkedReferences.some(e=>e.kind==='weapons-of-war'&&e.name==='Hand weapon'));
 assert.ok(details.pageLinkedReferences.some(e=>e.kind==='special-rules'&&e.name==='Valour of Ages'));
 assert.ok(!details.pageLinkedReferences.some(e=>e.name==='Fake'));
});

test('All published High Elf entries are discoverable; curated records retain verified status',()=>{
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',ROOT),'utf8'));
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.sourceOrigin,SOURCE);
 assert.equal(manifest.records.length,45);
 assert.equal(new Set(manifest.records.map(x=>x.id)).size,45);
 assert.equal(new Set(manifest.records.map(x=>x.sourceUrl)).size,45);
 for(const entry of manifest.records){
  assert.equal(entry.faction,'High Elf Realms');
  assert.ok(entry.sourceUrl.startsWith(SOURCE+'/unit/'));
  assert.ok(entry.path.startsWith('high-elf-realms/'));
  const record=JSON.parse(readFileSync(new URL(entry.path,ROOT),'utf8'));
  assert.equal(record.id,entry.id);
  assert.equal(record.name,entry.name);
  assert.equal(record.source.url,entry.sourceUrl);
  assert.equal(record.source.verificationStatus,entry.verificationStatus);
  assert.equal(record.legalityVerified,false);
  assert.equal(record.engineImplemented,false);
  assert.ok(['verified-on-tow','source-extracted','source-indexed'].includes(entry.verificationStatus));
  if(entry.verificationStatus!=='verified-on-tow'){
   assert.equal(record.source.armyIndexUrl,SOURCE+'/army/high-elf-realms');
   assert.equal(record.source.method,'automated, limited public HTML extraction');
   assert.ok(Array.isArray(record.modelProfiles));
   assert.ok(Array.isArray(record.pageLinkedReferences));
   assert.ok(!('equipment' in record),'linked references cannot be called equipped items automatically');
   assert.ok(!('specialRules' in record),'mentioned rules are not necessarily innate rules');
  }
 }
 assert.equal(manifest.records.filter(x=>x.verificationStatus==='verified-on-tow').length,2);
 const names=manifest.records.map(x=>x.name);
 assert.deepEqual(names,HIGH_ELF_INDEX_NAMES.map(x=>x.name));
});

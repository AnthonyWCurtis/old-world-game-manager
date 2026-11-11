import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditReferenceCollections} from '../scripts/audit-reference-collections.mjs';

const directory=new URL('../docs/reference-records/',import.meta.url);
const originals=Object.fromEntries(['rules','magic','magic-items'].map(key=>[
 key,JSON.parse(readFileSync(new URL(key+'-index.json',directory),'utf8'))
]));
const fresh=()=>structuredClone(originals);

test('all three additional sitemap indexes have internally consistent records',()=>{
 const report=auditReferenceCollections(fresh());
 assert.equal(report.errors.length,0,JSON.stringify(report.errors.slice(0,10)));
 assert.equal(report.summaries.rules.entries,1833);
 assert.equal(report.summaries.magic.entries,170);
 assert.equal(report.summaries['magic-items'].entries,839);
 assert.equal(report.summaries.magic.kinds.spell,139);
 assert.equal(report.summaries['magic-items'].kinds['item-or-ability'],768);
});
test('detects unsafe, duplicate and falsely counted index entries',()=>{
 const data=fresh(),first=data['magic-items'].entries[0];
 data['magic-items'].entries.push({...first,id:'magic-item-ref:/magic-items/fake',
  url:'https://example.com/magic-items/fake',path:'/magic-items/fake'});
 const report=auditReferenceCollections(data);
 for(const code of ['INVALID_SOURCE_URL','ENTRY_COUNT_MISMATCH','GROUP_COUNT_MISMATCH'])
  assert.ok(report.errors.some(e=>e.code===code),code);
});
test('rejects spell links to nonexistent lore or spell records',()=>{
 const data=fresh();
 const spell=data.magic.entries.find(e=>e.kind==='spell');
 const lore=data.magic.entries.find(e=>e.kind==='lore');
 spell.loreIds=['magic-ref:/the-lores-of-magic/does-not-exist'];
 lore.spellIds=['magic-ref:/spell/does-not-exist'];
 const report=auditReferenceCollections(data);
 assert.ok(report.errors.some(e=>e.code==='UNKNOWN_LORE_LINK'));
 assert.ok(report.errors.some(e=>e.code==='UNKNOWN_SPELL_LINK'));
});
test('requires all four supported snapshots to be supplied',()=>{
 const report=auditReferenceCollections({magic:originals.magic});
 assert.equal(report.errors.filter(e=>e.code==='MISSING_COLLECTION').length,2);
});

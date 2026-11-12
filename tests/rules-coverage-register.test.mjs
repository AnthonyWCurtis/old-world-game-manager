import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalId,classify,loadCoverage,validateRegister,buildMetrics,generateArtifacts} from '../scripts/build-rules-coverage.mjs';

const evidence={sourceUrl:'https://tow.whfb.app/special-rules/armour-bane',recordType:'rule-candidate',provenance:[{kind:'source-indexed'}],interpretation:null,implementation:null};
test('URL identity merges numerical variants but never merges different source paths',()=>{
 assert.equal(canonicalId(evidence.sourceUrl+'/'),canonicalId(evidence.sourceUrl));
 assert.notEqual(canonicalId('https://tow.whfb.app/battle-march/magic-items'),canonicalId('https://tow.whfb.app/magic-items/magic-items'));
 assert.throws(()=>canonicalId('https://example.com/special-rules/armour-bane'));
});
test('manual, partial and conditional evidence can never count as complete',()=>{
 assert.equal(classify(evidence),'Source Indexed');
 assert.equal(classify({...evidence,implementation:{mode:'manual'}}),'Manual Support');
 assert.equal(classify({...evidence,implementation:{mode:'partial'}}),'Partial Implementation');
 assert.equal(classify({...evidence,implementation:{mode:'conditional'}}),'Conditional Implementation');
 assert.equal(classify({...evidence,sourceUrl:null,provenance:[]}),'Missing');
 assert.throws(()=>classify({...evidence,implementation:{mode:'complete'}}),/complete/i);
 const complete={...evidence,interpretation:{verifiedOn:'2026-11-12',evidence:['review']},implementation:{mode:'complete',code:['engine.js'],obligations:[{id:'scope',implemented:true}],missing:[],questions:[]},questions:[]};
 assert.equal(classify(complete),'Fully Implemented');
 assert.equal(classify({...complete,implementation:{...complete.implementation,tests:['test.js'],obligations:[{id:'scope',implemented:true,tests:['test.js']}]}}),'Fully Implemented and Tested');
 assert.throws(()=>classify({...complete,implementation:{...complete.implementation,missing:['exception']}}),/complete/i);
});
test('shipped catalogue has traceable provenance, visible variants and explicit unenumerated gaps',async()=>{
 const register=await loadCoverage();
 assert.deepEqual(validateRegister(register),[]);
 const armour=register.entries.find(e=>e.sourceUrl===evidence.sourceUrl);
 assert.equal(armour.name,'Armour Bane (X)');
 assert.ok(armour.occurrences.some(o=>o.name==='Armour Bane (1)'));
 assert.ok(armour.occurrences.some(o=>o.name==='Armour Bane (2)'));
 assert.equal(armour.status,'Manual Support');
 assert.ok(register.entries.some(e=>e.recordType==='catalogue-gap'&&e.status==='Missing'));
 assert.ok(register.entries.some(e=>e.category==='faq-errata'));
 const metrics=buildMetrics(register);
 assert.equal(metrics.globalRulesDenominator,null);
 assert.equal(metrics.interactions.denominator,null);
 assert.equal(metrics.fullyImplemented.globalPercentage,null);
 assert.equal(metrics.testedImplementation.numerator,0);
 assert.ok(metrics.legacyProjectors.counts.startingSpecialRuleOccurrences>0);
});
test('provenance and complete implementation claims fail closed when tampered with',async()=>{
 const register=await loadCoverage();
 const broken=structuredClone(register);
 const entry=broken.entries.find(e=>e.provenance.length);
 entry.provenance[0].sha256='0'.repeat(64);
 assert.ok(validateRegister(broken).some(e=>e.includes('hash')));
 const invalid=structuredClone(register); invalid.entries[0].status='Fully Implemented and Tested';
 assert.ok(validateRegister(invalid).some(e=>e.includes('status')));
});
test('checked-in outputs reproduce byte for byte without network or wall-clock input',async()=>{
 const artifacts=await generateArtifacts();
 for(const [name,content] of Object.entries(artifacts))assert.equal(readFileSync(new URL('../docs/rules-coverage/'+name,import.meta.url),'utf8'),content,name);
 const a=await loadCoverage(),b=await loadCoverage();
 assert.deepEqual(a,b);
 const committed=JSON.parse(readFileSync(new URL('../docs/rules-coverage/register.json',import.meta.url)));
 assert.deepEqual(a,committed);
});
test('deleted catalogue entries, fabricated locators and non-dates cannot pass integrity',async()=>{
 const base=await loadCoverage();
 const removed=structuredClone(base);removed.entries=removed.entries.filter(e=>e.id!=='tow:/special-rules/armour-bane');
 assert.ok(validateRegister(removed).some(e=>e.includes('catalogue')));
 const locator=structuredClone(base);locator.entries.find(e=>e.provenance.some(p=>p.kind==='reviewed-descriptor')).provenance.find(p=>p.kind==='reviewed-descriptor').locator='REVIEWED_CORE_RULES[nonexistent]';
 assert.ok(validateRegister(locator).some(e=>e.includes('locator')));
 const date=structuredClone(base);const e=date.entries.find(e=>e.interpretation);e.interpretation.verifiedOn=e.sourceVerificationDate='not-a-date';
 assert.ok(validateRegister(date).some(e=>e.includes('date')));
});
test('test evidence and generation tooling are hashed inputs; interactions fail closed',async()=>{
 const r=await loadCoverage(),files=new Set(r.inputs.map(x=>x.file));
 for(const e of r.entries)for(const f of [...(e.implementation?.tests||[]),...(e.interpretation?.evidence||[])])assert.ok(files.has(f),'Unhashed evidence '+f);
 assert.ok(files.has('scripts/build-rules-coverage.mjs'));
 const broken=structuredClone(r);Object.assign(broken.interactions[0],{mode:'garbage',code:['absent.js'],tests:['absent.test.js'],sourceUrls:['https://invalid.example/absent']});
 assert.ok(validateRegister(broken).some(e=>e.includes('interaction')));
 const m=buildMetrics(r);
 assert.equal(m.notFullyImplemented,m.sourceCatalogue.ruleCandidates-m.fullyImplemented.numerator);
 assert.ok(m.noAutomatedMechanicsEstablished>=m.statuses['Manual Support']+m.statuses['Source Indexed']+m.statuses['Reference Only']);
});

test('undated spell descriptors never acquire an invented source verification date',async()=>{
 const r=await loadCoverage();
 const spell=r.entries.find(e=>e.sourceUrl==='https://tow.whfb.app/spell/earthen-ramparts');
 assert.equal(spell.sourceVerificationDate,null);
 assert.equal(spell.status,'Partial Implementation');
});
test('every entry states missing functionality and keeps unknown conditions explicit',async()=>{
 const r=await loadCoverage();
 for(const e of r.entries){assert.ok(Array.isArray(e.missingFunctionality),e.id);assert.ok(e.missingFunctionality.length||['Fully Implemented','Fully Implemented and Tested'].includes(e.status));assert.ok(e.conditionsStatus);}
});

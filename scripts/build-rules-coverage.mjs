/** Offline, evidence-gated Stage 1 baseline. No network or runtime mutation. */
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CATALOGUE} from '../docs/catalog.js';
import {ITEM_EFFECT_RULES} from '../docs/effects-engine.js';
import {SPELL_RULES} from '../docs/spell-engine.js';
import {REVIEWED_CORE_RULES} from '../docs/source-core-rule-effects.js';
import {REVIEWED_CHARACTER_RULES,REVIEWED_CONTAGIOUS_RULES} from '../docs/source-special-rule-effects.js';
import {REVIEWED_MISSILE_WEAPONS} from '../docs/source-missile-profiles.js';
import {loadShippedRuleEffectCoverage} from './audit-rule-effect-coverage.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(resolve(ROOT,path),'utf8');
const json=path=>JSON.parse(read(path));
const hash=content=>createHash('sha256').update(content).digest('hex');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)&&Number.isFinite(Date.parse(value));
const sorted=xs=>[...new Set(xs)].sort(compare);
const registries={ITEM_EFFECT_RULES,SPELL_RULES,REVIEWED_CORE_RULES,REVIEWED_CHARACTER_RULES,REVIEWED_CONTAGIOUS_RULES,REVIEWED_MISSILE_WEAPONS};
export const STATUSES=Object.freeze(['Missing','Source Indexed','Source Verified','Reference Only','Manual Support','Partial Implementation','Conditional Implementation','Fully Implemented','Fully Implemented and Tested','Unresolved']);
export function canonicalId(url){
 const u=new URL(url);
 if(u.origin!=='https://tow.whfb.app'||u.search||u.hash||!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(u.pathname))throw Error('Invalid source URL: '+url);
 return 'tow:'+u.pathname.replace(/\/$/,'');
}
/** Status describes audited scope, not whether the page is fully automated. */
export function classify(entry){
 if(entry.unresolved)return 'Unresolved';
 if(!entry.sourceUrl||!entry.provenance?.length)return 'Missing';
 const impl=entry.implementation;
 if(impl?.mode==='complete'){
  if(!validDate(entry.interpretation?.verifiedOn)||!entry.interpretation.evidence?.length||!impl.code?.length||
   !impl.obligations?.length||impl.obligations.some(o=>!o.id||o.implemented!==true)||
   impl.missing?.length||impl.questions?.length||entry.questions?.length)
   throw Error('Invalid complete implementation evidence for '+entry.id);
  return impl.tests?.length&&impl.obligations.every(o=>o.tests?.length&&o.tests.every(t=>impl.tests.includes(t)))?
   'Fully Implemented and Tested':'Fully Implemented';
 }
 if(impl?.mode==='manual')return 'Manual Support';
 if(impl?.mode==='partial')return 'Partial Implementation';
 if(impl?.mode==='conditional')return 'Conditional Implementation';
 if(impl&& !['none','reference'].includes(impl.mode))throw Error('Unknown implementation mode');
 if(impl?.mode==='reference')return 'Reference Only';
 if(entry.interpretation?.verifiedOn&&entry.interpretation.evidence?.length)return 'Source Verified';
 return 'Source Indexed';
}
const category=url=>{
 const p=new URL(url).pathname.split('/')[1];
 return ({'special-rules':'special-rule','weapons-of-war':'weapon-equipment','magic-item':'magic-item-or-ability',spell:'spell',unit:'unit-model-mount',army:'army-context',faq:'faq-errata',characters:'character','forming-units':'formation','unusual-formations':'formation','movement-in-detail':'movement','the-movement-phase':'movement','the-shooting-phase':'shooting','the-combat-phase':'combat','the-psychology-of-war':'psychology','removing-casualties':'defence','magic':'magic-mechanic'})[p]||p;
};
const context=url=>new URL(url).pathname.split('/').filter(Boolean).length===1||/^\/(?:unit|army|magic-items|the-lores-of-magic)\//.test(new URL(url).pathname);
const esc=s=>s.replace(/~/g,'~0').replace(/\//g,'~1');
function walk(value,fn,pointer=''){
 if(!value||typeof value!=='object')return;
 fn(value,pointer);
 for(const [key,child] of Object.entries(value))walk(child,fn,pointer+'/'+esc(key));
}
export async function loadCoverage(){
 const reviews=json('docs/rules-coverage/reviews.json');
 const entries=new Map(),inputs=new Map();
 const remember=path=>{if(!inputs.has(path))inputs.set(path,hash(read(path)));};
 const add=(url,name,provenance,occurrence)=>{
  const id=canonicalId(url);url='https://tow.whfb.app'+id.slice(4);
  let e=entries.get(id);
  if(!e){e={id,name:name||url.split('/').pop(),sourceUrl:url,sourceVerificationDate:null,recordType:context(url)?'context-page':'rule-candidate',category:category(url),scope:{verification:'unresolved',unitRecordIds:[],note:'Source association does not establish model eligibility or legality'},conditions:[],interactions:[],provenance:[],occurrences:[],interpretation:null,implementation:null,questions:['Atomic mechanics, applicable scope and exceptions require source-text review']};entries.set(id,e);}
  remember(provenance.file);e.provenance.push({...provenance,sha256:inputs.get(provenance.file)});
  if(occurrence){e.occurrences.push(occurrence);if(occurrence.unitId)e.scope.unitRecordIds.push(occurrence.unitId);}
  return e;
 };
 for(const file of ['rules','magic','magic-items','armies'].map(x=>'docs/reference-records/'+x+'-index.json')){
  const d=json(file);remember(file);
  d.entries.forEach((x,i)=>add(x.url,x.name,{kind:'source-indexed',file,pointer:'/entries/'+i,sourceUrl:d.source.url,indexedAt:d.source.checkedAt}));
 }
 const index=json('docs/unit-data/index.json');remember('docs/unit-data/index.json');
 let totalStarting=0,totalOptional=0;
 for(const shard of sorted(index.entries.map(e=>e.shard))){
  const file='docs/unit-data/shards/'+shard+'.json',payload=json(file);remember(file);
  for(const [unitId,r] of Object.entries(payload.records)){
   totalStarting+=(r.startingRules||[]).length;totalOptional+=(r.optionalRules||[]).length;
   walk(r,(obj,pointer)=>{
    if(typeof obj.sourceUrl!=='string')return;
    let valid=true;try{canonicalId(obj.sourceUrl);}catch{valid=false;}
    if(!valid)throw Error('Unresolved source URL in '+file+pointer);
    add(obj.sourceUrl,obj.name||r.name,{kind:'source-extracted-reference',file,pointer:'/records/'+esc(unitId)+pointer,sourceUrl:r.source.sourceUrl,capturedAt:index.source.checkedAt,sourceCommit:index.source.commit},
     {unitId,name:obj.name||r.name,field:pointer.split('/')[1],file,pointer:'/records/'+esc(unitId)+pointer});
   });
  }
 }
 remember('docs/catalog.js');
 CATALOGUE.forEach((x,i)=>{
  if(!x.url)return;
  const e=add(x.url,x.name,{kind:'runtime-catalogue-reference',file:'docs/catalog.js',locator:'CATALOGUE['+i+']',declaredVerifiedOn:x.verifiedOn||null});
  e.implementation??={mode:'reference',code:['docs/catalog.js'],tests:[],missing:['Catalogue matching is not mechanical implementation'],questions:[]};
 });
 // Literal factual links in all runtime modules keep FAQ/equipment evidence visible.
 for(const name of readdirSync(resolve(ROOT,'docs')).filter(x=>x.endsWith('.js')).sort(compare)){
  const file='docs/'+name,content=read(file);remember(file);
  for(const match of content.matchAll(/https:\/\/tow\.whfb\.app\/[a-z0-9-]+(?:\/[a-z0-9-]+)*/g)){
   const e=add(match[0],null,{kind:'code-reference',file,locator:'literal:'+match.index});
   e.implementation??={mode:'reference',code:[file],tests:[],missing:['Source link alone does not establish mechanics'],questions:[]};
  }
 }
 remember('docs/rules-coverage/reviews.json');
 remember('scripts/build-rules-coverage.mjs');
 remember('tests/rules-coverage-register.test.mjs');
 remember('tests/imported-rule-coverage.test.mjs');
 remember('scripts/audit-imported-rule-selections.mjs');
 remember('scripts/audit-rule-effect-coverage.mjs');
 remember('docs/source-profiles.json');
 for(const file of readdirSync(resolve(ROOT,'docs/examples')).filter(x=>x.endsWith('.txt')))remember('docs/examples/'+file);
 for(const group of reviews.groups){
  if(!registries[group.registry])throw Error('Unknown registry '+group.registry);
  for(const [key,r] of Object.entries(registries[group.registry])){
   const e=add(r.sourceUrl,r.name,{kind:'reviewed-descriptor',file:group.code,locator:group.registry+'['+key+']',declaredVerifiedOn:r.verifiedOn|| (group.registry==='REVIEWED_MISSILE_WEAPONS'?'2026-11-12':null)});
   const date=e.provenance.at(-1).declaredVerifiedOn;
   e.interpretation={verifiedOn:date,evidence:[group.code, reviews.reviewEvidence],scope:'Existing descriptor interpretation only; not exhaustive page/FAQ verification',verificationNote:date?'Retained prior source review date':'Prior descriptor is undated; source verification date unknown'};
   e.sourceVerificationDate=date;
   e.implementation={mode:group.mode,code:[group.code],locator:group.registry+'['+key+']',tests:group.tests,missing:group.missing,questions:['Verify all atomic obligations and exceptional interactions before completion']};
   e.conditions=[r.scope,r.trigger,r.targeting,r.description,r.effectSummary].filter(Boolean);
  }
 }
 for(const e of entries.values()){
  e.scope.unitRecordIds=sorted(e.scope.unitRecordIds);
  if(e.occurrences.length&&!e.implementation)e.implementation={mode:'reference',code:['docs/unit-equipment-and-rules.js'],tests:[],missing:['Source record reference only; mechanical behavior unverified'],questions:[]};
  e.variants=sorted(e.occurrences.map(o=>o.name));
  e.interactions=reviews.interactions.filter(i=>i.sourceUrls.includes(e.sourceUrl)).map(i=>i.id);
  if(e.recordType==='rule-candidate'&&!e.provenance.some(p=>['source-indexed','source-extracted-reference','reviewed-descriptor'].includes(p.kind)))e.unresolved=true;
  e.status=classify(e);
  e.missingFunctionality=e.implementation?.missing||['No mechanical implementation verified; source interpretation and implementation review required'];
  e.conditionsStatus=e.interpretation?'scoped descriptor only; exceptions remain unreviewed':'unreviewed';
 }
 for(const e of entries.values())for(const file of [...(e.implementation?.code||[]),...(e.implementation?.tests||[]),...(e.interpretation?.evidence||[])])remember(file);
 for(const i of reviews.interactions)for(const file of [...i.code,...i.tests])remember(file);
 const gaps=reviews.gaps.map(g=>({id:g.id,name:g.name,sourceUrl:null,sourceVerificationDate:null,recordType:'catalogue-gap',category:g.category,scope:{verification:'unresolved'},conditions:[],interactions:[],provenance:[],occurrences:[],variants:[],interpretation:null,implementation:null,questions:[g.question],missingFunctionality:['Catalogue scope and evidence are missing'],conditionsStatus:'unreviewed',status:'Missing'}));
 const result={schemaVersion:1,auditDate:reviews.auditDate,baselineCommit:reviews.baselineCommit,identityPolicy:'Exact source-path identity, provisional page-level candidates; no cross-URL semantic equivalence asserted',inputs:[...inputs].sort(([a],[b])=>compare(a,b)).map(([file,sha256])=>({file,sha256})),entries:[...entries.values(),...gaps].sort((a,b)=>compare(a.id,b.id)),interactions:reviews.interactions.map(i=>({...i,status:classify({id:i.id,sourceUrl:i.sourceUrls[0],provenance:[{file:'docs/rules-coverage/reviews.json'}],interpretation:i.interpretation,implementation:i,questions:i.questions})})),unitReferenceCounts:{starting:totalStarting,optional:totalOptional},legacyProjectors:loadShippedRuleEffectCoverage()};
 return result;
}
/** Validate evidence against real committed files, including JSON pointer targets. */
export function validateRegister(register){
 const errors=[],ids=new Set(),cache=new Map(),hashes=new Map(),parsed=new Map();
 const content=file=>{if(!cache.has(file))cache.set(file,read(file));return cache.get(file);};
 const verifyFile=(file,sha256)=>{
  if(!file||file.startsWith('/')||file.split('/').includes('..'))throw Error('unsafe evidence path');
  const c=content(file);if(!hashes.has(file))hashes.set(file,hash(c));if(sha256&&hashes.get(file)!==sha256)throw Error('hash mismatch '+file);return c;
 };
 for(const input of register.inputs||[])try{verifyFile(input.file,input.sha256);}catch(error){errors.push(error.message);}
 for(const e of register.entries){
  try{
   if(e.interpretation?.verifiedOn!==null&&e.interpretation&&!validDate(e.interpretation.verifiedOn))throw Error('invalid verification date');
   if(ids.has(e.id))throw Error('duplicate id');ids.add(e.id);
   if(e.sourceUrl&&canonicalId(e.sourceUrl)!==e.id)throw Error('source identity mismatch');
   if(e.sourceUrl&&!e.provenance.length)throw Error('missing provenance');
   if(e.status!==classify(e))throw Error('status contradicts evidence');
   for(const p of e.provenance){
    const c=verifyFile(p.file,p.sha256);
    if(p.pointer){
     if(!parsed.has(p.file))parsed.set(p.file,JSON.parse(c));
     const obj=p.pointer.split('/').slice(1).reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],parsed.get(p.file));
     if(!obj||canonicalId(obj.url||obj.sourceUrl)!==e.id)throw Error('provenance pointer mismatch');
    }
    if(p.locator){
     if(p.kind==='code-reference'){const offset=Number(p.locator.replace('literal:',''));if(!Number.isInteger(offset)||!c.slice(offset).startsWith(e.sourceUrl))throw Error('invalid code locator');}
     else if(p.kind==='runtime-catalogue-reference'){const m=/^CATALOGUE\[(\d+)\]$/.exec(p.locator);if(!m||canonicalId(CATALOGUE[Number(m[1])]?.url)!==e.id)throw Error('invalid catalogue locator');}
     else if(p.kind==='reviewed-descriptor'){const m=/^(\w+)\[(.*)\]$/.exec(p.locator);if(!m||!registries[m[1]]?.[m[2]]?.sourceUrl||canonicalId(registries[m[1]][m[2]].sourceUrl)!==e.id)throw Error('invalid descriptor locator');}
    }
    if(p.kind==='source-indexed'&&!validDate(p.indexedAt))throw Error('missing indexing date');
    if(p.kind==='source-extracted-reference'&&(!validDate(p.capturedAt)||!p.sourceCommit))throw Error('missing capture provenance');
   }
   if(e.sourceVerificationDate!== (e.interpretation?.verifiedOn||null))throw Error('verification date mismatch');
   for(const file of [...(e.implementation?.code||[]),...(e.implementation?.tests||[]),...(e.interpretation?.evidence||[])])verifyFile(file);
  }catch(error){errors.push(e.id+': '+error.message);}
 }
 const interactionIds=new Set();
 for(const i of register.interactions||[]){try{
  if(interactionIds.has(i.id))throw Error('duplicate interaction id');interactionIds.add(i.id);
  if(!i.sourceUrls?.length||i.sourceUrls.some(url=>!ids.has(canonicalId(url))))throw Error('missing interaction constituent');
  if(i.status!==classify({id:i.id,sourceUrl:i.sourceUrls[0],provenance:[{file:'docs/rules-coverage/reviews.json'}],interpretation:i.interpretation,implementation:i,questions:i.questions}))throw Error('interaction status mismatch');
  for(const file of [...(i.code||[]),...(i.tests||[])])verifyFile(file);
 }catch(error){errors.push('interaction '+i.id+': '+error.message);}}
 for(const file of ['rules','magic','magic-items','armies'].map(x=>'docs/reference-records/'+x+'-index.json')){
  for(const source of json(file).entries)if(!ids.has(canonicalId(source.url)))errors.push('Missing catalogue entry: '+source.url);
 }
 return errors;
}
export function buildMetrics(register){
 const pages=register.entries.filter(e=>e.sourceUrl),candidates=pages.filter(e=>e.recordType==='rule-candidate');
 const count=pred=>candidates.filter(pred).length;
 const full=e=>['Fully Implemented','Fully Implemented and Tested'].includes(e.status);
 const statuses=Object.fromEntries(STATUSES.map(s=>[s,count(e=>e.status===s)]));
 const ratio=(numerator,denominator)=>({numerator,denominator,percentage:denominator?Number((numerator/denominator*100).toFixed(4)):null});
 return {globalRulesDenominator:null,denominatorLimitation:'Page candidates are not decomposed atomic rules. FAQ/errata closure, semantic aliases and exceptional interactions remain unknown.',sourceCatalogue:{indexedPageOccurrences:register.entries.reduce((n,e)=>n+e.provenance.filter(p=>p.kind==='source-indexed').length,0),uniqueIndexedPages:pages.filter(e=>e.provenance.some(p=>p.kind==='source-indexed')).length,registeredSourcePages:pages.length,ruleCandidates:candidates.length,contextPages:pages.length-candidates.length,globalPercentage:null},verifiedInterpretation:{...ratio(count(e=>!!e.interpretation?.verifiedOn),candidates.length),undatedDescriptors:count(e=>!!e.interpretation&&!e.interpretation.verifiedOn),scope:'Known page candidates with a dated reviewed descriptor, not complete verified mechanical interpretations',globalPercentage:null},fullyImplemented:{...ratio(count(full),candidates.length),globalPercentage:null},testedImplementation:{...ratio(count(e=>e.status==='Fully Implemented and Tested'),candidates.length),globalPercentage:null},statuses,notFullyImplemented:count(e=>!full(e)),noAutomatedMechanicsEstablished:count(e=>['Missing','Source Indexed','Source Verified','Reference Only','Manual Support','Unresolved'].includes(e.status)),catalogueGaps:register.entries.filter(e=>e.recordType==='catalogue-gap').length,categories:Object.fromEntries(sorted(pages.map(e=>e.category)).map(c=>[c,pages.filter(e=>e.category===c).length])),interactions:{identified:register.interactions.length,fullyImplemented:register.interactions.filter(full).length,tested:register.interactions.filter(e=>e.status==='Fully Implemented and Tested').length,denominator:null,percentage:null},unitReferenceCounts:register.unitReferenceCounts,legacyProjectors:register.legacyProjectors};
}
function report(metrics,imports){
 const c=metrics.legacyProjectors.counts;
 return ['# Stage 1 generated coverage baseline','',`Audit: ${json('docs/rules-coverage/reviews.json').auditDate}. Run \`node scripts/build-rules-coverage.mjs --check\` to verify reproducibility.`,'','## Distinct measurements','',`- Indexed page occurrences: ${metrics.sourceCatalogue.indexedPageOccurrences}; unique indexed URLs: ${metrics.sourceCatalogue.uniqueIndexedPages}; registered source pages: ${metrics.sourceCatalogue.registeredSourcePages}.`,`- Provisional rule-page candidates: ${metrics.sourceCatalogue.ruleCandidates}; context pages: ${metrics.sourceCatalogue.contextPages}; explicit catalogue gaps: ${metrics.catalogueGaps}.`,`- Page candidates with a scoped reviewed interpretation: ${metrics.verifiedInterpretation.numerator} dated; ${metrics.verifiedInterpretation.undatedDescriptors} undated descriptors. Full atomic interpretation coverage: unknown.`,`- Fully implemented canonical candidates established by evidence: ${metrics.fullyImplemented.numerator}. Fully implemented and tested: ${metrics.testedImplementation.numerator}.`,`- Known interaction records: ${metrics.interactions.identified}; fully implemented: ${metrics.interactions.fullyImplemented}; total interaction denominator: unknown.`,'','## Canonical candidate statuses','',...Object.entries(metrics.statuses).map(([s,n])=>`- ${s}: ${n}`),'',`Candidates without established automated mechanics: ${metrics.noAutomatedMechanicsEstablished}; candidates not fully implemented: ${metrics.notFullyImplemented}. Missing catalogue gaps are separate from rule counts.`,'','## Source-record/projector occurrences','',`- Source-extracted units: ${c.verifiedUnitRecords}/${c.indexedUnits}; extraction-warning records: ${c.warningUnitRecords}.`,`- All starting references: ${metrics.unitReferenceCounts.starting}; all optional references: ${metrics.unitReferenceCounts.optional}.`,`- Starting special-rule references: ${c.startingSpecialRuleOccurrences}; manual: ${c.manualStartingOccurrences}; conditional inherited: ${c.reviewedStartingOccurrences}; reference-only within these projectors: ${c.referenceOnlyStartingOccurrences}.`,`- Optional special-rule references: ${c.optionalSpecialRuleOccurrences}; other starting references excluded by the older special-only audit: ${c.otherStartingReferenceOccurrences}.`,'','## Imported selections','',imports?`${imports.fixtureCount} committed export fixtures; ${imports.totals.unitInstances} unit instances; ${imports.totals.verifiedUnitRecords} matching source-extracted records; ${imports.totals.unmatchedUnits} unmatched units. Explicit selections: ${imports.totals.explicitSelections}; linked: ${imports.totals.linkedSelections}; unlinked: ${imports.totals.unlinkedSelections}; informational: ${imports.totals.informationalSelections}. Fully implemented occurrences: ${imports.totals.fullyImplementedOccurrences}. See imported-selections.json for traceable paths; repeated exports are not unique real armies. Production army coverage: unknown.`:'Imported fixture report unavailable; production roster denominator unknown.','', '## Limits','',metrics.denominatorLimitation,'No whole-game percentage is presented. Local candidate ratios in metrics.json use the explicitly bounded candidate population only. Source indexing, extraction, reviewed description and passing helper tests are never treated as full automation.','', 'See methodology.md, audit.md and backlog.md for evidence, risks and next work.',''].join('\n');
}
export async function generateArtifacts(){
 const register=await loadCoverage();const errors=validateRegister(register);if(errors.length)throw Error(errors.join('\n'));
 const metrics=buildMetrics(register);
 let imports=null;
 {
  const {buildImportedSelectionCoverage}=await import('./audit-imported-rule-selections.mjs');imports=await buildImportedSelectionCoverage({root:ROOT,entries:register.entries});
 }
 const outputs={'register.json':JSON.stringify({...register,entries:[]},null,2).replace('\"entries\": [],','\"entries\": [\n'+register.entries.map(e=>JSON.stringify(e)).join(',\n')+'\n],')+'\n','metrics.json':JSON.stringify(metrics,null,2)+'\n','report.md':report(metrics,imports)};
 outputs['imported-selections.json']=JSON.stringify(imports,null,2)+'\n';
 return outputs;
}
async function main(){
 const outputs=await generateArtifacts();
 for(const [name,content] of Object.entries(outputs)){
  const path='docs/rules-coverage/'+name;
  if(process.argv.includes('--check')){if(!existsSync(resolve(ROOT,path))||read(path)!==content)throw Error('Stale coverage artifact: '+path);}
  else writeFileSync(resolve(ROOT,path),content);
 }
 const metrics=JSON.parse(outputs['metrics.json']);
 process.stdout.write(JSON.stringify({sourceCatalogue:metrics.sourceCatalogue,statuses:metrics.statuses,gaps:metrics.catalogueGaps,integrity:'pass',mode:process.argv.includes('--check')?'check':'generate'})+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

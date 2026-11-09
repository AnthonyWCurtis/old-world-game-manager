import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {collectUnmatched} from '../docs/unmatched-debug.js';
import {prepareAnonymousReport,validateReportingConfig} from '../docs/report-submission.js';
import worker,{validateSubmission,formatStoredReport} from '../worker/unmatched-report-worker.mjs';
import {parseSubmittedReport,consolidate} from '../scripts/aggregate-unmatched.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const original=()=>parseArmy(read('../docs/examples/nr-tow-footer.txt'));

test('Produces a user-privacy-conscious submission with exactly the unmatched entries',()=>{
 const army=original();
 const entries=collectUnmatched(army);
 assert.ok(entries.length>0);
 const payload=prepareAnonymousReport(army);
 assert.equal(payload.schemaVersion,1);
 assert.equal(payload.entries.length,entries.length);
 assert.ok(payload.entries.every(x=>x.unit && x.name && x.type));
 const text=JSON.stringify(payload);
 assert.ok(!text.includes('Player:'));
 assert.ok(!text.includes('Created with newrecruit'));
 assert.ok(!text.includes('Original source'));
 assert.ok(payload.entries.every(item=>entries.some(ref=>ref.name===item.name&&ref.unit===item.unit)));
});
test('Server validation restricts unit references to actual TOW site and strips formatting',()=>{
 const entry={type:'selection',name:'High Helm',unit:'Silver Helms',unitUrl:'https://tow.whfb.app/unit/silver-helms',sourceLine:3,kind:'command'};
 const ok=validateSubmission({schemaVersion:1,format:'new-recruit / tow',faction:'High Elf Realms',entries:[entry]});
 assert.equal(ok.entries[0].unitUrl,entry.unitUrl);
 const malicious=validateSubmission({schemaVersion:1,format:'nr / tow',faction:'',entries:[{...entry,unitUrl:'https://example.com/unit/silver-helms',name:'High Helm\nInjected: text'}]});
 assert.equal(malicious.entries[0].unitUrl,'-');
 assert.equal(malicious.entries[0].name,'High Helm Injected: text');
 assert.throws(()=>validateSubmission({schemaVersion:1,format:'x',entries:[]}));
 assert.throws(()=>validateSubmission({schemaVersion:1,format:'x',entries:Array.from({length:101},()=>entry)}));
 const archive=formatStoredReport(ok,{createdAt:'2026-11-09T18:00:00Z',reportId:'test-id'});
 assert.match(archive,/\[1\] SELECTION: High Helm/);
 assert.match(archive,/Parent unit: Silver Helms/);
 assert.ok(!archive.includes('Player:'));
});
test('Public config does not grant the browser write access to GitHub',()=>{
 assert.equal(validateReportingConfig({enabled:false,endpoint:'https://worker.example.workers.dev/report',turnstileSiteKey:'TEST_SITE_KEY'}),null);
 assert.equal(validateReportingConfig({enabled:true,endpoint:'http://worker.example/report',turnstileSiteKey:'TEST_SITE_KEY'}),null);
 assert.ok(validateReportingConfig({enabled:true,endpoint:'https://worker.example.workers.dev/report',turnstileSiteKey:'TEST_SITE_KEY'}));
 const websiteConfig=JSON.parse(read('../docs/report-config.json'));
 // Public website configuration may be off during initial setup, or enabled
 // after the owner deploys their private Worker. Neither case exposes secrets.
 assert.equal(typeof websiteConfig.enabled,'boolean');
 if(websiteConfig.enabled)assert.ok(validateReportingConfig(websiteConfig));
 else assert.equal(validateReportingConfig(websiteConfig),null);
 const file=read('../worker/unmatched-report-worker.mjs');
 assert.ok(file.includes('env.GITHUB_TOKEN'));
 assert.ok(file.includes('env.TURNSTILE_SECRET'));
 assert.ok(file.includes('env.REPORT_RATE_LIMITER'));
 assert.ok(!read('../docs/report-ui.js').includes('GITHUB_TOKEN'));
});
test('Anonymous user can submit without GitHub login when Turnstile and limiter pass',async()=>{
 const oldFetch=globalThis.fetch;
 let writes=0;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=String(input);
   if(url.includes('/turnstile/v0/siteverify')){
    return new Response(JSON.stringify({success:true,hostname:'anthonywcurtis.github.io',action:'unmatched_report'}),{status:200});
   }
   if(url.includes('api.github.com')){
    writes++;
    assert.match(url,/\/contents\/reports\/unmatched\/report-/);
    assert.equal(init.headers.Authorization,'Bearer private-server-token');
    const data=JSON.parse(init.body);
    const archived=Buffer.from(data.content,'base64').toString('utf8');
    assert.match(archived,/High Helm/);
    assert.match(archived,/Parent unit: Silver Helms/);
    return new Response('{}',{status:201});
   }
   throw Error('Unexpected fetch: '+url);
  };
  const payload={schemaVersion:1,format:'new-recruit / tow',faction:'Unknown',entries:[
   {type:'selection',name:'High Helm',unit:'Silver Helms',kind:'command',sourceLine:3,unitUrl:'https://tow.whfb.app/unit/silver-helms'}
  ],turnstileToken:'test-token'};
  const env={GITHUB_TOKEN:'private-server-token',TURNSTILE_SECRET:'server-secret',
   REPORT_RATE_LIMITER:{limit:async()=>({success:true})}};
  const request=new Request('https://worker.example.workers.dev/report',{method:'POST',
   headers:{Origin:'https://anthonywcurtis.github.io','Content-Type':'application/json'},
   body:JSON.stringify(payload)});
  const result=await worker.fetch(request,env);
  assert.equal(result.status,201);
  const answer=await result.json();
  assert.equal(answer.ok,true);
  assert.match(answer.url,/^https:\/\/github\.com\/AnthonyWCurtis\/old-world-game-manager\/blob\/main\/reports\/unmatched\/report-/);
  assert.equal(writes,1);
 }finally{globalThis.fetch=oldFetch;}
});
test('Worker rejects mismatched origins and fails closed without private backend credentials',async()=>{
 const input={schemaVersion:1,format:'new-recruit / tow',entries:[
  {type:'selection',name:'High Helm',unit:'Silver Helms',sourceLine:3}
 ],turnstileToken:'token'};
 const headers={'Content-Type':'application/json',Origin:'https://evil.example'};
 const no=await worker.fetch(new Request('https://worker.example.workers.dev/report',{method:'POST',headers,body:JSON.stringify(input)}),{});
 assert.equal(no.status,403);
 const unconfigured=await worker.fetch(new Request('https://worker.example.workers.dev/report',{method:'POST',
  headers:{...headers,Origin:'https://anthonywcurtis.github.io'},body:JSON.stringify(input)}),{});
 assert.equal(unconfigured.status,503);
});
test('Consolidator creates one copyable list with duplicate counts and original source links',()=>{
 const validated=validateSubmission({
  schemaVersion:1,format:'new-recruit / tow',faction:'Unknown',
  entries:[
   {type:'selection',name:'High Helm',unit:'Silver Helms',sourceLine:3,unitUrl:'https://tow.whfb.app/unit/silver-helms'},
   {type:'selection',name:'High Helm',unit:'Silver Helms',sourceLine:4,unitUrl:'https://tow.whfb.app/unit/silver-helms'}
  ]
 });
 const one=formatStoredReport(validated,{createdAt:'2026-11-09T18:00:00Z',reportId:'one'});
 assert.equal(parseSubmittedReport(one).length,2);
 const two=formatStoredReport({...validated,entries:[validated.entries[0]]},{createdAt:'2026-11-09T18:01:00Z',reportId:'two'});
 const aggregate=consolidate([{name:'report-1.txt',content:one},{name:'report-2.txt',content:two}]);
 assert.match(aggregate,/Distinct missing references: 1/);
 assert.match(aggregate,/Unmatched occurrences: 3/);
 assert.match(aggregate,/High Helm \(SELECTION\)/);
 assert.match(aggregate,/Parent unit: Silver Helms/);
 assert.match(aggregate,/Occurrences: 3/);
});

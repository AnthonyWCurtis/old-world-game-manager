import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/unmatched-report-worker.mjs';
import {handleAdminRequest} from '../worker/admin-api.mjs';
import {startGithubLogin,finishGithubLogin} from '../worker/admin-auth.mjs';
import {readFileSync} from 'node:fs';
const ORIGIN='https://old-world-unmatched-reports.oldworldcompanion.workers.dev';
const file='report-20261111T131552339Z-edefe906-ec56-4c92-8f77-0205df47e648.txt';
const report=readFileSync(new URL('../reports/unmatched/'+file,import.meta.url),'utf8');
const env={
 ADMIN_PUBLIC_ORIGIN:ORIGIN,
 ADMIN_GITHUB_LOGIN:'AnthonyWCurtis',ADMIN_GITHUB_CLIENT_ID:'Iv1_example',
 GITHUB_OAUTH_CLIENT_SECRET:'test-server-secret',ADMIN_SESSION_SECRET:'a-secure-test-secret-with-32-characters',
 GITHUB_TOKEN:'test-private-repo-write-token'
};
const b64=s=>Buffer.from(s,'utf8').toString('base64');
let store={sha:'review-sha-1',content:b64(JSON.stringify({
 schemaVersion:1,updatedAt:null,entries:{}
}))};
const github=(url,opts={})=>{
 const u=new URL(url),method=opts.method||'GET';
 const reportPath='/repos/AnthonyWCurtis/old-world-game-manager/contents/reports/unmatched';
 if(u.pathname===reportPath&&method==='GET')
  return Promise.resolve(Response.json([{name:file,type:'file'},{
   name:'ALL_UNMATCHED.txt',type:'file'}]));
 if(u.pathname===reportPath+'/'+file&&method==='GET')
  return Promise.resolve(Response.json({type:'file',encoding:'base64',content:b64(report)}));
 const reviewsPath='/repos/AnthonyWCurtis/old-world-game-manager/contents/reports/admin/reviews.json';
 if(u.pathname===reviewsPath&&method==='GET')
  return Promise.resolve(Response.json({sha:store.sha,encoding:'base64',content:store.content}));
 if(u.pathname===reviewsPath&&method==='PUT'){
  const input=JSON.parse(opts.body);
  assert.equal(input.sha,store.sha);
  store={sha:'review-sha-2',content:input.content};
  return Promise.resolve(Response.json({content:{sha:'review-sha-2'}}));
 }
 throw Error('Unexpected GitHub URL '+method+' '+url);
};
const makeSession=async()=>{
 const started=await startGithubLogin(new Request(ORIGIN+'/auth/github'),env);
 const state=new URL(started.headers.get('location')).searchParams.get('state');
 const cookie=started.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 const callback=await finishGithubLogin(new Request(ORIGIN+'/auth/callback?code=abc&state='+state,{headers:{Cookie:cookie}}),
  env,async url=>url.includes('access_token')?Response.json({access_token:'test-user-token'}):Response.json({id:123,login:'AnthonyWCurtis'}));
 assert.equal(callback.status,302);
 return callback.headers.getSetCookie().find(x=>x.startsWith('__Host-gm_admin=')).split(';')[0];
};

test('admin dashboard requires valid GitHub login and does not expose private API anonymously',async()=>{
 const page=await handleAdminRequest(new Request(ORIGIN+'/admin'),env,github);
 assert.equal(page.status,200);
 assert.match(await page.text(),/Sign in with GitHub/);
 const api=await handleAdminRequest(new Request(ORIGIN+'/admin/api/reports'),env,github);
 assert.equal(api.status,401);
 assert.equal(api.headers.get('cache-control'),'no-store');
 const forbidden=await handleAdminRequest(new Request(ORIGIN+'/admin/api/review',{method:'POST',
  headers:{Origin:'https://malicious.example','Content-Type':'application/json'},body:'{}'}),env,github);
 assert.equal(forbidden.status,403);
});

test('authenticated report list exposes existing report entries and source links',async()=>{
 const session=await makeSession();
 const response=await handleAdminRequest(new Request(ORIGIN+'/admin/api/reports',{headers:{Cookie:session}}),env,github);
 assert.equal(response.status,200);
 const json=await response.json();
 assert.equal(json.totalReports,1);
 assert.equal(json.totalItems,11);
 assert.equal(json.counts.new,11);
 assert.equal(json.reports[0].entries[0].name,'Orion');
 assert.equal(json.reports[0].entries[2].sourceUrl,'https://tow.whfb.app/unit/wood-elf-beast-pack');
});

test('review updates require same-origin POST and persist only sanitized triage state',async()=>{
 store={sha:'review-sha-1',content:b64(JSON.stringify({schemaVersion:1,entries:{}}))};
 const session=await makeSession();
 const body={filename:file,ordinal:1,status:'investigating',
  note:'Check published character reference',fixUrl:''};
 const badOrigin=await handleAdminRequest(new Request(ORIGIN+'/admin/api/review',{method:'POST',headers:{
  Cookie:session,Origin:'https://other.example','Content-Type':'application/json'
 },body:JSON.stringify(body)}),env,github);
 assert.equal(badOrigin.status,403);
 const response=await handleAdminRequest(new Request(ORIGIN+'/admin/api/review',{method:'POST',headers:{
  Cookie:session,Origin:ORIGIN,'Content-Type':'application/json'
 },body:JSON.stringify(body)}),env,github);
 assert.equal(response.status,200);
 assert.equal((await response.json()).ok,true);
 const saved=JSON.parse(Buffer.from(store.content,'base64').toString('utf8'));
 assert.equal(saved.entries[file+'#1'].status,'investigating');
 assert.equal(saved.entries[file+'#1'].reviewer,'AnthonyWCurtis');
 assert.equal(saved.entries[file+'#1'].note,'Check published character reference');
});

test('nonexistent report ordinal is rejected and no review is written',async()=>{
 const session=await makeSession();
 const response=await handleAdminRequest(new Request(ORIGIN+'/admin/api/review',{method:'POST',headers:{
  Cookie:session,Origin:ORIGIN,'Content-Type':'application/json'
 },body:JSON.stringify({filename:file,ordinal:55,status:'fixed',
  note:'Evidence',fixUrl:'https://github.com/AnthonyWCurtis/old-world-game-manager/pull/25'})}),env,github);
 assert.equal(response.status,404);
});

test('public POST /report validation remains separate from admin login',async()=>{
 const result=await worker.fetch(new Request(ORIGIN+'/report',{method:'POST',
  headers:{Origin:'https://attacker.example','Content-Type':'application/json'},
  body:JSON.stringify({schemaVersion:1,entries:[]})}),env);
 assert.equal(result.status,403);
 const noTurnstile=await worker.fetch(new Request(ORIGIN+'/report',{method:'POST',
  headers:{Origin:'https://anthonywcurtis.github.io','Content-Type':'application/json'},
  body:JSON.stringify({schemaVersion:1,format:'test',faction:'Unknown',
   entries:[{type:'unit',name:'Test',unit:'Test'}]})}),env);
 assert.equal(noTurnstile.status,503,'Existing Worker still requires rate limiter and Turnstile secrets');
});

test('GitHub review update retries a concurrent SHA conflict without losing existing reviews',async()=>{
 store={sha:'conflict-base',content:b64(JSON.stringify({schemaVersion:1,entries:{
  existing:{status:'needs-info',note:'Keep this review',fixUrl:''}
 }}))};
 const session=await makeSession();
 let writes=0;
 const retryGithub=(url,opts={})=>{
  if(new URL(url).pathname.endsWith('/reports/admin/reviews.json')&&opts.method==='PUT'){
   writes++;
   if(writes===1)return Promise.resolve(new Response('conflict',{status:409}));
  }
  return github(url,opts);
 };
 const result=await handleAdminRequest(new Request(ORIGIN+'/admin/api/review',{method:'POST',headers:{
  Cookie:session,Origin:ORIGIN,'Content-Type':'application/json'
 },body:JSON.stringify({filename:file,ordinal:2,status:'needs-info',note:'Request a clearer export',fixUrl:''})}),
 env,retryGithub);
 assert.equal(result.status,200);
 assert.equal(writes,2);
 const saved=JSON.parse(Buffer.from(store.content,'base64').toString('utf8'));
 assert.equal(saved.entries.existing.note,'Keep this review');
 assert.equal(saved.entries[file+'#2'].status,'needs-info');
});

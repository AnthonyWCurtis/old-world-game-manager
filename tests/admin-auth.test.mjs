import test from 'node:test';
import assert from 'node:assert/strict';
import {startGithubLogin,finishGithubLogin,readAdminSession,logoutAdmin} from '../worker/admin-auth.mjs';

const ORIGIN='https://old-world-unmatched-reports.oldworldcompanion.workers.dev';
const env={
 ADMIN_PUBLIC_ORIGIN:ORIGIN,
 ADMIN_GITHUB_CLIENT_ID:'Iv1_example',
 ADMIN_GITHUB_LOGIN:'AnthonyWCurtis',
 GITHUB_OAUTH_CLIENT_SECRET:'fake-server-secret',
 ADMIN_SESSION_SECRET:'test-only-32-or-more-characters-secret-5678'
};
const getCookies=response=>response.headers.getSetCookie();
const cookieHeader=(cookies)=>cookies.map(s=>s.split(';')[0]).join('; ');

test('no OAuth configuration fails closed and never authorizes anonymously',async()=>{
 const request=new Request(ORIGIN+'/auth/github');
 const response=await startGithubLogin(request,{});
 assert.equal(response.status,503);
 assert.equal(await readAdminSession(new Request(ORIGIN+'/admin'),{}),null);
});

test('GitHub sign-in starts with unpredictable state, PKCE S256 and first-party HttpOnly cookies',async()=>{
 const response=await startGithubLogin(new Request(ORIGIN+'/auth/github'),env);
 assert.equal(response.status,302);
 const url=new URL(response.headers.get('location'));
 assert.equal(url.origin,'https://github.com');
 assert.equal(url.pathname,'/login/oauth/authorize');
 assert.equal(url.searchParams.get('client_id'),'Iv1_example');
 assert.equal(url.searchParams.get('redirect_uri'),ORIGIN+'/auth/callback');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.ok(url.searchParams.get('code_challenge').length>35);
 assert.equal(url.searchParams.get('scope'),null,'Do not request repo access to read identity');
 const cookies=getCookies(response);
 assert.equal(cookies.length,2);
 for(const cookie of cookies){
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\//);
  assert.match(cookie,/Max-Age=600/);
 }
 const state=cookies.find(x=>x.startsWith('__Host-gm_oauth_state='));
 assert.equal(state.split(';')[0].split('=')[1],url.searchParams.get('state'));
});

test('OAuth callback checks state and GitHub identity; signed cookie grants session only to admin',async()=>{
 const init=await startGithubLogin(new Request(ORIGIN+'/auth/github'),env);
 const state=new URL(init.headers.get('location')).searchParams.get('state');
 const cookie=cookieHeader(getCookies(init));
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push([url,opts]);
  if(url==='https://github.com/login/oauth/access_token'){
   const form=new URLSearchParams(opts.body);
   assert.equal(form.get('client_secret'),env.GITHUB_OAUTH_CLIENT_SECRET);
   assert.ok(form.get('code_verifier').length>40);
   return Response.json({access_token:'user-identity-token'});
  }
  if(url==='https://api.github.com/user')
   return Response.json({id:123,login:'AnthonyWCurtis'});
  throw Error('Unexpected URL: '+url);
 };
 const callback=new Request(ORIGIN+'/auth/callback?code=valid-code&state='+state,{
  headers:{Cookie:cookie}
 });
 const res=await finishGithubLogin(callback,env,fetcher);
 assert.equal(res.status,302);
 assert.equal(res.headers.get('location'),ORIGIN+'/admin');
 const adminCookie=getCookies(res).find(c=>c.startsWith('__Host-gm_admin='));
 assert.ok(adminCookie);assert.match(adminCookie,/HttpOnly/);assert.match(adminCookie,/Secure/);
 const read=new Request(ORIGIN+'/admin',{headers:{Cookie:adminCookie.split(';')[0]}});
 assert.deepEqual(await readAdminSession(read,env),{id:123,login:'AnthonyWCurtis'});
 assert.equal(await readAdminSession(read,{...env,ADMIN_SESSION_SECRET:'different-key-123456789012345678901234567890'}),null);
 assert.equal(requests.length,2);
});

test('forged OAuth callback state and unauthorized GitHub user never create an admin cookie',async()=>{
 const init=await startGithubLogin(new Request(ORIGIN+'/auth/github'),env);
 const actual=new URL(init.headers.get('location')).searchParams.get('state');
 const cookie=cookieHeader(getCookies(init));
 const fake=await finishGithubLogin(
  new Request(ORIGIN+'/auth/callback?code=abc&state=bogus',{headers:{Cookie:cookie}}),
  env,async()=>{throw Error('GitHub must not be called for bad state');});
 assert.equal(fake.status,403);
 const res=await finishGithubLogin(
  new Request(ORIGIN+'/auth/callback?code=abc&state='+actual,{headers:{Cookie:cookie}}),
  env,async url=>url.includes('/access_token')
   ?Response.json({access_token:'stranger-token'})
   :Response.json({id:456,login:'other-user'}));
 assert.equal(res.status,403);
 assert.ok(!getCookies(res).some(c=>c.startsWith('__Host-gm_admin=')));
});

test('logout clears session cookie on the Worker origin',()=>{
 const response=logoutAdmin(new Request(ORIGIN+'/admin/logout'));
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),ORIGIN+'/admin');
 assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});

test('GitHub OAuth client IDs with their standard Iv1. prefix are accepted',async()=>{
 const response=await startGithubLogin(new Request(ORIGIN+'/auth/github'),{
  ...env,ADMIN_GITHUB_CLIENT_ID:'Iv1.1234567890abcdef'
 });
 assert.equal(response.status,302);
 assert.equal(new URL(response.headers.get('location')).searchParams.get('client_id'),
  'Iv1.1234567890abcdef');
});

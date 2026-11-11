/**
 * First-party Cloudflare Worker admin routes and GitHub-backed report triage.
 * This module is never loaded by the public GitHub Pages application.
 */
import {startGithubLogin,finishGithubLogin,readAdminSession,logoutAdmin,adminConfigured} from './admin-auth.mjs';
import {parseReportFile,validateReview,summarizeReports,validReportFilename} from './admin-reports.mjs';
import {ADMIN_HTML,ADMIN_LOGIN_HTML,ADMIN_SETUP_HTML,ADMIN_SCRIPT} from './admin-page.mjs';

const REPO='AnthonyWCurtis/old-world-game-manager';
const API='https://api.github.com/repos/'+REPO;
const DIR='/contents/reports/unmatched';
const REVIEWS='/contents/reports/admin/reviews.json';
const MAX_REPORTS=100;
const secureHeaders={
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{
 status,headers:{...secureHeaders,'Content-Type':'application/json; charset=utf-8'}
});
const html=(text)=>new Response(text,{headers:{
 ...secureHeaders,'Content-Type':'text/html; charset=utf-8'
}});
const blocked=(message,status)=>json({ok:false,error:message},status);
const limited=async(request)=>{
 const raw=request.headers.get('Content-Length');
 if(raw&&Number(raw)>4096)throw Error('Request too large.');
 const data=await request.arrayBuffer();
 if(data.byteLength>4096)throw Error('Request too large.');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
};
const decodeBase64=text=>{
 const bytes=Uint8Array.from(atob(String(text||'').replace(/\s+/g,'')),c=>c.charCodeAt(0));
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
};
const encodeBase64=text=>{
 let latin='';
 for(const byte of new TextEncoder().encode(text))latin+=String.fromCharCode(byte);
 return btoa(latin);
};
async function githubRequest(env,path,{method='GET',body=null}={},fetcher=fetch){
 if(typeof env?.GITHUB_TOKEN!=='string'||!env.GITHUB_TOKEN)
  throw Error('GitHub report access is not configured.');
 const response=await fetcher(API+path,{
  method,headers:{
   'Authorization':'Bearer '+env.GITHUB_TOKEN,
   'Accept':'application/vnd.github+json',
   'User-Agent':'OldWorldGameManager-ReportAdmin',
   'X-GitHub-Api-Version':'2022-11-28',
   ...(body===null?{}:{'Content-Type':'application/json'})
  },
  ...(body===null?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(15000)
 });
 return response;
}
async function readReport(env,filename,fetcher){
 if(!validReportFilename(filename))throw Error('Invalid report filename.');
 const response=await githubRequest(env,DIR+'/'+encodeURIComponent(filename)+'?ref=main',{},fetcher);
 if(response.status===404)return null;
 if(!response.ok)throw Error('Could not retrieve report file from GitHub.');
 const item=await response.json();
 if(item.type!=='file'||item.encoding!=='base64'||typeof item.content!=='string')
  throw Error('Unexpected GitHub report format.');
 return parseReportFile(filename,decodeBase64(item.content));
}
async function readReviews(env,fetcher){
 const response=await githubRequest(env,REVIEWS+'?ref=main',{},fetcher);
 if(response.status===404)return {sha:null,record:{schemaVersion:1,updatedAt:null,entries:{}}};
 if(!response.ok)throw Error('Could not retrieve review state from GitHub.');
 const data=await response.json();
 if(data.encoding!=='base64'||typeof data.content!=='string')
  throw Error('Unexpected review state format.');
 const record=JSON.parse(decodeBase64(data.content));
 if(record.schemaVersion!==1||!record.entries||
    typeof record.entries!=='object'||Array.isArray(record.entries))
  throw Error('Unsupported review state schema.');
 return {sha:data.sha,record};
}
async function reportQueue(env,fetcher){
 const directory=await githubRequest(env,DIR+'?ref=main',{},fetcher);
 if(!directory.ok)throw Error('Could not list submitted reports from GitHub.');
 const entries=await directory.json();
 if(!Array.isArray(entries))throw Error('Unexpected report directory listing.');
 const files=entries.filter(x=>x.type==='file'&&validReportFilename(x.name))
  .map(x=>x.name).sort().reverse();
 const selected=files.slice(0,MAX_REPORTS);
 const reports=[];
 // Restrict concurrent GitHub API reads and never return/report arbitrary files.
 for(let i=0;i<selected.length;i+=4){
  const batch=await Promise.all(selected.slice(i,i+4).map(file=>readReport(env,file,fetcher)));
  reports.push(...batch.filter(Boolean));
 }
 const {record:reviews}=await readReviews(env,fetcher);
 return {...summarizeReports(reports,reviews),truncated:files.length>selected.length};
}
async function updateReview(env,review,session,fetcher){
 // Require that the referenced report and ordinal really exist.
 const report=await readReport(env,review.filename,fetcher);
 if(!report||!report.entries.some(x=>x.ordinal===review.ordinal))return null;
 for(let attempt=0;attempt<3;attempt++){
  const {sha,record}=await readReviews(env,fetcher);
  const now=new Date().toISOString();
  const next={schemaVersion:1,updatedAt:now,entries:{
   ...record.entries,[review.key]:{
    status:review.status,note:review.note,fixUrl:review.fixUrl,
    reviewer:session.login,updatedAt:now
   }
  }};
  const payload={message:'Review unmatched reference '+review.key,
   content:encodeBase64(JSON.stringify(next,null,2)+'\n'),branch:'main',
   ...(sha?{sha}:{})};
  const response=await githubRequest(env,REVIEWS,{method:'PUT',body:payload},fetcher);
  if(response.ok)return {ok:true,key:review.key,status:review.status,updatedAt:now};
  if(response.status===409||response.status===422)continue;
  throw Error('GitHub rejected review update.');
 }
 throw Error('Review was changed at the same time. Refresh and retry.');
}
export async function handleAdminRequest(request,env,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 const origin=String(env?.ADMIN_PUBLIC_ORIGIN||'');
 if(url.origin!==origin)return blocked('Wrong admin origin.',403);
 if(path==='/auth/github'){
  if(method!=='GET')return blocked('Method not allowed.',405);
  return startGithubLogin(request,env);
 }
 if(path==='/auth/callback'){
  if(method!=='GET')return blocked('Method not allowed.',405);
  return finishGithubLogin(request,env,fetcher);
 }
 if(path==='/admin'&&method==='GET'){
  if(!adminConfigured(env))return html(ADMIN_SETUP_HTML);
  const session=await readAdminSession(request,env);
  return html(session?ADMIN_HTML:ADMIN_LOGIN_HTML);
 }
 if((path==='/admin/api/review'||path==='/admin/logout')&&
    method==='POST'&&request.headers.get('Origin')!==url.origin)
  return blocked('Incorrect request origin.',403);
 const session=await readAdminSession(request,env);
 if(!session)return blocked('Administrator sign-in required.',401);
 if(path==='/admin/client.js'){
  if(method!=='GET')return blocked('Method not allowed.',405);
  return new Response(ADMIN_SCRIPT,{headers:{
   ...secureHeaders,'Content-Type':'text/javascript; charset=utf-8'
  }});
 }
 if(path==='/admin/logout'){
  if(method!=='POST')return blocked('Method not allowed.',405);
  if(request.headers.get('Origin')!==url.origin)return blocked('Incorrect request origin.',403);
  return logoutAdmin(request);
 }
 if(path==='/admin/api/reports'){
  if(method!=='GET')return blocked('Method not allowed.',405);
  try{return json(await reportQueue(env,fetcher));}
  catch{return blocked('Report data is temporarily unavailable.',502);}
 }
 if(path==='/admin/api/review'){
  if(method!=='POST')return blocked('Method not allowed.',405);
  if(request.headers.get('Origin')!==url.origin)
   return blocked('Incorrect request origin.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
   return blocked('JSON required.',415);
  let review;
  try{review=validateReview(await limited(request));}
  catch(error){return blocked(error.message||'Invalid review.',400);}
  try{
   const saved=await updateReview(env,review,session,fetcher);
   return saved?json(saved):blocked('Report entry not found.',404);
  }catch{return blocked('Review could not be saved. Check GitHub access and retry.',502);}
 }
 return blocked('Not found.',404);
}

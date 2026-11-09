/**
 * Public, credential-free unmatched-reference submissions for Game Manager users.
 * Deploy to a Cloudflare Worker. NEVER expose GITHUB_TOKEN or TURNSTILE_SECRET
 * in the public GitHub Pages application.
 *
 * Required Worker secrets:
 *   GITHUB_TOKEN         Fine-grained token with Contents: Read and write for
 *                        AnthonyWCurtis/old-world-game-manager only
 *   TURNSTILE_SECRET     Cloudflare Turnstile secret key
 *
 * Required Worker variable:
 *   ALLOWED_ORIGIN       https://anthonywcurtis.github.io
 *
 * Requires a Turnstile site key in docs/report-config.json on GitHub Pages.
 */
const REPO='AnthonyWCurtis/old-world-game-manager';
const SOURCE='https://tow.whfb.app';
const MAX_BYTES=20000;
const MAX_ITEMS=100;
const clean=(v,n=140)=>String(v??'').replace(/[\r\n\t|]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const cors=origin=>({
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'Content-Type',
 'Vary':'Origin',
 'Cache-Control':'no-store'
});
const response=(obj,status,origin)=>new Response(JSON.stringify(obj),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',...cors(origin)}
});
function sourceUrl(url){
 if(!url)return '-';
 try{
  const u=new URL(url);
  if(u.origin===SOURCE&&/^\/unit\/[a-z0-9-]+\/?$/i.test(u.pathname)&&!u.search&&!u.hash)
   return u.href;
 }catch{}
 return '-';
}
export function validateSubmission(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))
  throw new Error('Expected JSON object');
 if(payload.schemaVersion!==1)throw new Error('Unsupported report version');
 const format=clean(payload.format,100),faction=clean(payload.faction,100);
 if(!format)throw new Error('Missing export format');
 if(!Array.isArray(payload.entries)||payload.entries.length<1||payload.entries.length>MAX_ITEMS)
  throw new Error('Expected 1 to 100 unmatched entries');
 const entries=payload.entries.map(v=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||
     (v.type!=='unit'&&v.type!=='selection'))throw new Error('Invalid unmatched entry type');
  const name=clean(v.name),unit=clean(v.unit),kind=clean(v.kind,55);
  if(!name||!unit)throw new Error('Missing unmatched name or parent unit');
  const sourceLine=Number.isSafeInteger(v.sourceLine)&&v.sourceLine>0&&v.sourceLine<1000000?v.sourceLine:'-';
  return {type:v.type,name,unit,kind,sourceLine,unitUrl:sourceUrl(v.unitUrl)};
 });
 return {format,faction:faction||'Unknown',entries};
}
export function formatStoredReport(report,{createdAt,reportId}){
 return [
  'Warhammer: The Old World — Unmatched Source Reference Report',
  'Report ID: '+reportId,
  'Submitted: '+createdAt,
  'Export format: '+report.format,
  'Faction: '+report.faction,
  'Unmatched entries: '+report.entries.length,
  '',
  'Each item is an unmatched source reference, not a declaration of invalid army composition.',
  'No player name, original army list, IP address or matched selections included.',
  '',
  ...report.entries.flatMap((x,i)=>[
   '['+(i+1)+'] '+x.type.toUpperCase()+': '+x.name,
   '  Parent unit: '+x.unit,
   '  Kind: '+x.kind,
   '  Source line: '+x.sourceLine,
   '  Parent unit reference: '+x.unitUrl,
   ''
  ])
 ].join('\n');
}
async function verifyTurnstile(token,secret,ip){
 if(!token||typeof token!=='string'||token.length>2048)return false;
 const form=new FormData();
 form.set('secret',secret);
 form.set('response',token);
 if(ip)form.set('remoteip',ip);
 const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
  method:'POST',body:form,signal:AbortSignal.timeout(8000)
 });
 if(!res.ok)return false;
 const result=await res.json();
 return result.success===true && result.hostname==='anthonywcurtis.github.io' && result.action==='unmatched_report';
}
const encodeBase64=text=>{
 const bytes=new TextEncoder().encode(text);
 let latin='';
 for(const byte of bytes)latin+=String.fromCharCode(byte);
 return btoa(latin);
};
export default {
 async fetch(request,env){
  const allowed=String(env.ALLOWED_ORIGIN||'https://anthonywcurtis.github.io').replace(/\/$/,'');
  const origin=request.headers.get('Origin');
  if(origin!==allowed)
   return new Response('Origin not allowed',{status:403,headers:{'Cache-Control':'no-store'}});
  if(request.method==='OPTIONS')
   return new Response(null,{status:204,headers:cors(allowed)});
  if(request.method!=='POST'||new URL(request.url).pathname!=='/report')
   return response({ok:false,error:'Not found'},404,allowed);
  if(!env.GITHUB_TOKEN||!env.TURNSTILE_SECRET||!env.REPORT_RATE_LIMITER)
   return response({ok:false,error:'Reporting is not configured'},503,allowed);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
   return response({ok:false,error:'JSON required'},415,allowed);
  if(Number(request.headers.get('Content-Length')||0)>MAX_BYTES)
   return response({ok:false,error:'Report too large'},413,allowed);
  try{
   // Read with a strict byte limit, including for chunked requests.
   const bytes=await request.arrayBuffer();
   if(bytes.byteLength>MAX_BYTES)
    return response({ok:false,error:'Report too large'},413,allowed);
   const incoming=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   const report=validateSubmission(incoming);
   const isHuman=await verifyTurnstile(incoming.turnstileToken,env.TURNSTILE_SECRET,
    request.headers.get('CF-Connecting-IP'));
   if(!isHuman)
    return response({ok:false,error:'Verification failed; please try again'},400,allowed);
   // Rate limit is mandatory, independent of Turnstile.
   const identifier=request.headers.get('CF-Connecting-IP')||'unknown';
   const limit=await env.REPORT_RATE_LIMITER.limit({key:identifier});
   if(!limit.success)return response({ok:false,error:'Too many reports; try later'},429,allowed);
   const now=new Date().toISOString();
   const id=crypto.randomUUID();
   const name='report-'+now.replace(/[:.]/g,'').replace(/-/g,'')+'-'+id+'.txt';
   const path='reports/unmatched/'+name;
   const contents=formatStoredReport(report,{createdAt:now,reportId:id});
   const github=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+path,{
    method:'PUT',
    headers:{
     'Authorization':'Bearer '+env.GITHUB_TOKEN,
     'Accept':'application/vnd.github+json',
     'Content-Type':'application/json',
     'User-Agent':'OldWorldGameManager-Unmatched-Reports',
     'X-GitHub-Api-Version':'2022-11-28'
    },
    body:JSON.stringify({message:'Save anonymised unmatched reference report',content:encodeBase64(contents),branch:'main'}),
    signal:AbortSignal.timeout(15000)
   });
   if(!github.ok){
    console.error('GitHub rejected report',github.status);
    return response({ok:false,error:'Could not save report; please try later'},502,allowed);
   }
   return response({ok:true,reportId:id,
    url:'https://github.com/'+REPO+'/blob/main/'+path},201,allowed);
  }catch(e){
   console.error('Unmatched report error',e?.name||'unknown');
   return response({ok:false,error:'Report could not be submitted. Try again.'},400,allowed);
  }
 }
};

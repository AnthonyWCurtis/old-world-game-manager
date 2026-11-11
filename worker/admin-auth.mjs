/**
 * GitHub OAuth web flow + PKCE for an allowlisted Game Manager administrator.
 *
 * All exchange and HMAC operations run server-side in Cloudflare Workers.
 * Only a signed, short-lived, HttpOnly session cookie reaches the browser.
 */
const SESSION_COOKIE='__Host-gm_admin';
const STATE_COOKIE='__Host-gm_oauth_state';
const VERIFIER_COOKIE='__Host-gm_oauth_verifier';
const SESSION_SECONDS=8*60*60;
const encoder=new TextEncoder();
function bytesToB64Url(bytes){
 let latin='';for(const b of bytes)latin+=String.fromCharCode(b);
 return btoa(latin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64UrlToBytes(text){
 const raw=String(text).replace(/-/g,'+').replace(/_/g,'/');
 const padded=raw+'='.repeat((4-raw.length%4)%4);
 return Uint8Array.from(atob(padded),x=>x.charCodeAt(0));
}
function randomToken(length){
 const bytes=crypto.getRandomValues(new Uint8Array(length));
 return bytesToB64Url(bytes);
}
function cookie(request,name){
 const raw=request.headers.get('Cookie')||'';
 const entry=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
 return entry?entry.slice(name.length+1):null;
}
function setCookie(name,value,seconds){
 return name+'='+value+'; Path=/; Max-Age='+seconds+'; Secure; HttpOnly; SameSite=Lax';
}
function config(env){
 const origin=String(env?.ADMIN_PUBLIC_ORIGIN||'');
 let validOrigin=false;
 try{const u=new URL(origin);validOrigin=u.protocol==='https:'&&u.origin===origin;}catch{}
 const login=String(env?.ADMIN_GITHUB_LOGIN||'').trim();
 return validOrigin&&/^[a-z0-9-]{1,39}$/i.test(login)&&
  /^[a-z0-9_]{6,100}$/i.test(String(env?.ADMIN_GITHUB_CLIENT_ID||''))&&
  String(env?.GITHUB_OAUTH_CLIENT_SECRET||'').length>8&&
  String(env?.ADMIN_SESSION_SECRET||'').length>=32;
}
const blocked=(message,status=403)=>new Response(message,{
 status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}
});
const redirect=(url,status=302)=>new Response(null,{status,headers:{Location:url}});
async function hmacKey(secret){
 return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},
  false,['sign','verify']);
}
export async function startGithubLogin(request,env){
 if(!config(env))return blocked('Admin login is not configured.',503);
 if(new URL(request.url).origin!==env.ADMIN_PUBLIC_ORIGIN)return blocked('Wrong admin origin');
 const state=randomToken(32),verifier=randomToken(48);
 const hash=await crypto.subtle.digest('SHA-256',encoder.encode(verifier));
 const authorize=new URL('https://github.com/login/oauth/authorize');
 authorize.searchParams.set('client_id',env.ADMIN_GITHUB_CLIENT_ID);
 authorize.searchParams.set('redirect_uri',env.ADMIN_PUBLIC_ORIGIN+'/auth/callback');
 authorize.searchParams.set('state',state);
 authorize.searchParams.set('code_challenge',bytesToB64Url(new Uint8Array(hash)));
 authorize.searchParams.set('code_challenge_method','S256');
 authorize.searchParams.set('allow_signup','false');
 // No "repo" or other OAuth scope: the user's token is used only for GET /user.
 const response=redirect(authorize.href);
 response.headers.set('Cache-Control','no-store');
 response.headers.append('Set-Cookie',setCookie(STATE_COOKIE,state,600));
 response.headers.append('Set-Cookie',setCookie(VERIFIER_COOKIE,verifier,600));
 return response;
}
async function issueSession(env,identity){
 const payload=bytesToB64Url(encoder.encode(JSON.stringify({
  id:identity.id,login:identity.login,exp:Math.floor(Date.now()/1000)+SESSION_SECONDS
 })));
 const signature=await crypto.subtle.sign('HMAC',await hmacKey(env.ADMIN_SESSION_SECRET),
  encoder.encode(payload));
 return payload+'.'+bytesToB64Url(new Uint8Array(signature));
}
export async function finishGithubLogin(request,env,fetcher=fetch){
 if(!config(env))return blocked('Admin login is not configured.',503);
 if(new URL(request.url).origin!==env.ADMIN_PUBLIC_ORIGIN)return blocked('Wrong admin origin');
 const url=new URL(request.url),state=url.searchParams.get('state');
 const verifier=cookie(request,VERIFIER_COOKIE),expected=cookie(request,STATE_COOKIE);
 const code=url.searchParams.get('code');
 if(!state||!expected||state!==expected||!verifier||!code||
  !/^[a-zA-Z0-9_-]{40,130}$/.test(verifier))return blocked('Invalid or expired GitHub sign-in state.');
 try{
  const form=new URLSearchParams({
   client_id:env.ADMIN_GITHUB_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,
   code,redirect_uri:env.ADMIN_PUBLIC_ORIGIN+'/auth/callback',code_verifier:verifier
  });
  const tokenResponse=await fetcher('https://github.com/login/oauth/access_token',{
   method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},
   body:form.toString(),signal:AbortSignal.timeout(8000)
  });
  if(!tokenResponse.ok)return blocked('GitHub authorization did not complete.',502);
  const token=(await tokenResponse.json())?.access_token;
  if(typeof token!=='string'||!token)return blocked('GitHub authorization failed.',403);
  const userResponse=await fetcher('https://api.github.com/user',{
   headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'User-Agent':'OldWorldGameManager-Admin','X-GitHub-Api-Version':'2022-11-28'},
   signal:AbortSignal.timeout(8000)
  });
  if(!userResponse.ok)return blocked('Could not verify GitHub account.',502);
  const user=await userResponse.json();
  if(!Number.isSafeInteger(user?.id)||user.id<1||
     typeof user?.login!=='string'||
     user.login.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())
   return blocked('This GitHub account does not have administrator access.');
  const session=await issueSession(env,{id:user.id,login:user.login});
  const response=redirect(env.ADMIN_PUBLIC_ORIGIN+'/admin');
  response.headers.set('Cache-Control','no-store');
  response.headers.append('Set-Cookie',setCookie(STATE_COOKIE,'',0));
  response.headers.append('Set-Cookie',setCookie(VERIFIER_COOKIE,'',0));
  response.headers.append('Set-Cookie',setCookie(SESSION_COOKIE,session,SESSION_SECONDS));
  return response;
 }catch{
  return blocked('GitHub sign-in is temporarily unavailable.',502);
 }
}
export async function readAdminSession(request,env){
 if(!config(env)||new URL(request.url).origin!==env.ADMIN_PUBLIC_ORIGIN)return null;
 const value=cookie(request,SESSION_COOKIE);
 if(!value||value.length>1200)return null;
 const parts=value.split('.');
 if(parts.length!==2)return null;
 try{
  const payload=parts[0],signature=b64UrlToBytes(parts[1]);
  const valid=await crypto.subtle.verify('HMAC',await hmacKey(env.ADMIN_SESSION_SECRET),
   signature,encoder.encode(payload));
  if(!valid)return null;
  const data=JSON.parse(new TextDecoder().decode(b64UrlToBytes(payload)));
  if(!Number.isSafeInteger(data?.id)||data.id<1||
     data?.login?.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase()||
     !Number.isSafeInteger(data?.exp)||data.exp<=Math.floor(Date.now()/1000))
   return null;
  return {id:data.id,login:data.login};
 }catch{return null;}
}
export function logoutAdmin(request){
 const origin=new URL(request.url).origin;
 const response=redirect(origin+'/admin',303);
 response.headers.set('Cache-Control','no-store');
 response.headers.append('Set-Cookie',setCookie(SESSION_COOKIE,'',0));
 return response;
}

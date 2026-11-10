import {collectUnmatched} from './unmatched-debug.js?v=0.4.2';

/** A public client submits *only* missing source-reference names and context.
 * The endpoint and Turnstile site key are public; write credentials stay on the Worker.
 */
export function prepareAnonymousReport(army){
 const entries=collectUnmatched(army);
 const selections=entries.map(r=>({
  type:r.type,name:r.name,unit:r.unit,kind:r.kind||'unknown',
  sourceLine:r.sourceLine,unitUrl:r.unitUrl||null
 }));
 return {
  schemaVersion:1,
  format:[army?.format?.exporter||'unknown',army?.format?.layout||'unknown'].join(' / '),
  faction:army?.army?.faction?.value||'Unknown',
  entries:selections
 };
}
export function validateReportingConfig(config){
 if(!config||config.enabled!==true)return null;
 try{
  const uri=new URL(config.endpoint);
  if(uri.protocol!=='https:'||!uri.pathname.endsWith('/report')||uri.username||uri.password||uri.search||uri.hash)return null;
  const siteKey=String(config.turnstileSiteKey||'');
  if(siteKey.length<6||siteKey.length>250||!/^[-_a-zA-Z0-9.]+$/.test(siteKey))return null;
  return {endpoint:uri.href,turnstileSiteKey:siteKey};
 }catch{return null;}
}
export async function loadReportingConfig(){
 try{
  const response=await fetch('./report-config.json?v=0.3.0',{cache:'no-store'});
  if(!response.ok)return null;
  return validateReportingConfig(await response.json());
 }catch{return null;}
}
export async function submitAnonymousReport(config,payload,turnstileToken){
 if(!config||!turnstileToken)throw Error('Complete verification before submitting');
 if(!payload.entries?.length)throw Error('There are no unmatched references');
 const response=await fetch(config.endpoint,{
  method:'POST',mode:'cors',credentials:'omit',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({...payload,turnstileToken}),
  signal:AbortSignal.timeout(20000)
 });
 let json=null;
 try{json=await response.json();}catch{}
 if(!response.ok||json?.ok!==true)throw Error(json?.error||'Report submission failed');
 if(typeof json.url!=='string'||
    !/^https:\/\/github\.com\/AnthonyWCurtis\/old-world-game-manager\/blob\/main\/reports\/unmatched\/report-[a-zA-Z0-9-]+\.txt$/.test(json.url))
  throw Error('Unexpected report confirmation');
 return json;
}

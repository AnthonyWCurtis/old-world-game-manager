import {collectUnmatched} from './unmatched-debug.js?v=0.2.7';
import {prepareAnonymousReport,loadReportingConfig,submitAnonymousReport}
 from './report-submission.js?v=0.3.0';

/**
 * Public reporting flow without requiring visitors to sign in to GitHub.
 * Reporting stays disabled until site owner configures the secure Worker.
 */
export function wireReportUI(getArmy){
 const $=id=>document.getElementById(id);
 const button=$('reportUnmatchedBtn');
 const panel=$('reportUnmatchedPanel');
 const status=$('reportUnmatchedStatus');
 const count=$('reportUnmatchedCount');
 const consent=$('reportUnmatchedConsent');
 const submit=$('submitUnmatchedBtn');
 const captcha=$('reportCaptcha');
 const result=$('reportSavedLink');
 let config=null;
 let ready=false;
 let lastArmy=null;
 let token='';
 let widgetId=null;
 let pending=false;
 let scriptPromise=null;
 let finished=false;
 const showStatus=message=>{status.textContent=message;};
 function refresh(){
  const army=getArmy();
  const n=collectUnmatched(army).length;
  if(lastArmy!==army){
   lastArmy=army;
   panel.hidden=true;
   consent.checked=false;
   result.hidden=true;
   result.removeAttribute('href');
   token='';
   finished=false;
   if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);
  }
  button.disabled=!config||!n;
  button.textContent=n?'Report unmatched ('+n+')':'No unmatched references to report';
  if(!ready)button.title='Checking whether reporting is available';
  else if(!config)button.title='The project owner has not configured the secure report endpoint';
  else button.title='Submit unmatched reference names without a GitHub account';
  count.textContent=n+' unmatched reference'+(n===1?'':'s')+' will be included.';
  if(!n&& !panel.hidden){
   showStatus('Everything is matched now. Nothing needs to be reported.');
  }
  updateSubmit();
 }
 function updateSubmit(){
  const n=collectUnmatched(getArmy()).length;
  submit.disabled=!config||!n||!consent.checked||!token||pending||finished;
 }
 const turnstileScript=()=>{
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
   const tag=document.createElement('script');
   tag.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   tag.async=true;
   tag.onload=()=>window.turnstile?resolve(window.turnstile):reject(Error('Verification could not start'));
   tag.onerror=()=>reject(Error('Unable to load human verification'));
   document.head.append(tag);
  });
  return scriptPromise;
 };
 async function showPanel(){
  if(!config||!getArmy()||!collectUnmatched(getArmy()).length){
   showStatus('Reporting is not available. Use Copy unmatched debug instead.');
   return;
  }
  panel.hidden=false;
  showStatus('Review what will be sent. Verification is required before submitting.');
  try{
   const turnstile=await turnstileScript();
   if(!panel.hidden&&widgetId===null){
    widgetId=turnstile.render(captcha,{
     sitekey:config.turnstileSiteKey,
     action:'unmatched_report',
     callback:value=>{token=value;updateSubmit();},
     'expired-callback':()=>{token='';updateSubmit();},
     'error-callback':()=>{token='';showStatus('Verification failed. Retry the challenge.');updateSubmit();}
    });
   }else if(widgetId!==null){
    turnstile.reset(widgetId);
    token='';
   }
   updateSubmit();
  }catch(e){showStatus('Human verification unavailable: '+e.message+'. Try again later.');}
 }
 async function sendReport(){
  const army=getArmy();
  if(!army||!config||pending)return;
  const payload=prepareAnonymousReport(army);
  if(!payload.entries.length){showStatus('No unmatched references remain.');return;}
  if(payload.entries.length>100){
   showStatus('Too many unmatched references for one report. Use Copy unmatched debug instead.');
   return;
  }
  if(!consent.checked){showStatus('Agree to publish the unmatched names before submitting.');return;}
  if(!token){showStatus('Complete verification before submitting.');return;}
  pending=true;finished=false;updateSubmit();
  showStatus('Submitting unmatched references…');
  try{
   const answer=await submitAnonymousReport(config,payload,token);
   finished=true;
   result.href=answer.url;
   result.hidden=false;
   showStatus('Report saved to GitHub. Thank you — no GitHub login was required.');
  }catch(e){
   showStatus(e.message||'Report could not be submitted. Copy unmatched debug is still available.');
  }finally{
   pending=false;
   token='';
   if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);
   updateSubmit();
  }
 }
 button.addEventListener('click',()=>void showPanel());
 consent.addEventListener('change',updateSubmit);
 submit.addEventListener('click',()=>void sendReport());
 loadReportingConfig().then(value=>{
  config=value;ready=true;
  refresh();
  if(!config)showStatus('Direct submissions are not yet configured by the project owner. Copy unmatched debug still works.');
 }).catch(()=>{ready=true;refresh();});
 refresh();
 return {refresh};
}

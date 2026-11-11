/**
 * Authenticated, first-party Cloudflare Worker dashboard.
 * Browser receives report data and review status, never GitHub credentials.
 * All untrusted names, notes and metadata are rendered with textContent.
 */
const STYLE=String.raw`
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f0f3f6;color:#1c3347;font-size:14px}
a{color:#226188}
button,select,input{font:inherit}
button{cursor:pointer}
.top{background:#153349;color:#fff;padding:18px max(18px,calc((100vw - 1120px)/2))}
.top .row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font-weight:800;font-size:18px;letter-spacing:.01em}
.top small{color:#d2e1ea;font-size:12px}
.signout button{border:1px solid #7593a7;background:transparent;color:#fff;border-radius:8px;padding:9px 14px;min-height:44px}
main{max-width:1120px;margin:0 auto;padding:18px 16px 80px}
h1{font-size:clamp(24px,5vw,32px);line-height:1.15;margin:7px 0 6px}
h2{font-size:19px;margin:0}
.lead{color:#617385;line-height:1.55;margin:0 0 18px}
.note{background:#fbf6e7;border:1px solid #e1cf9f;color:#655024;padding:12px;border-radius:10px;line-height:1.55;margin:10px 0 16px}
.toolbar{background:#fff;border:1px solid #d5dfe8;border-radius:12px;padding:14px;display:grid;grid-template-columns:minmax(0,2fr) minmax(140px,1fr) auto;align-items:end;gap:10px}
label{display:block;font-size:12px;font-weight:700;margin:0 0 5px}
input,select{width:100%;min-width:0;min-height:44px;padding:10px;border:1px solid #b9c9d6;border-radius:8px;background:#fff;color:#233b4f}
button{min-height:44px;border:1px solid #abc4d6;border-radius:8px;background:#e9f4fb;color:#1d5277;padding:10px 14px;font-weight:700}
button:hover{background:#d8ebfa}
button:disabled{opacity:.55;cursor:default}
#adminStatus{min-height:18px;color:#5b6677;font-size:13px;margin:10px 0}
#adminStatus[data-error="true"]{color:#a0402d}
.counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:13px 0}
.count{border-radius:10px;background:#fff;border:1px solid #d6e0e8;padding:13px}
.count b{display:block;font-size:25px;font-variant-numeric:tabular-nums;color:#163b55}
.count span{color:#60788a;font-size:12px}
.report{background:#fff;border:1px solid #cbd9e3;border-radius:12px;margin:12px 0;box-shadow:0 2px 8px #172d4412;overflow:hidden}
.report>summary{cursor:pointer;min-height:64px;padding:15px;display:flex;align-items:center;gap:12px;justify-content:space-between}
.report>summary strong{font-size:16px}
.report>summary span{font-size:12px;color:#65798a}
.report-details{padding:0 14px 15px}
.report-meta{margin:0 0 12px;color:#587184;line-height:1.5}
.report-entry{border:1px solid #e0e8ef;border-radius:10px;padding:13px;margin:10px 0;background:#fafcfe;min-width:0}
.entry-head{display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap}
.entry-head strong{font-size:15px;overflow-wrap:anywhere}
.state{font-size:11px;padding:4px 8px;background:#e9eef2;color:#334a60;border-radius:99px;white-space:nowrap;font-weight:750}
.state.fixed{background:#e5f3e9;color:#285f42}
.state.investigating{background:#fff2cf;color:#806018}
.field{font-size:12px;line-height:1.55;color:#526a7e;margin:7px 0}
.links{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 13px;font-size:12px}
.review-form{display:grid;grid-template-columns:minmax(150px,.9fr) minmax(0,2fr);gap:10px}
.review-form .wide{grid-column:1/-1}
.review-form button{justify-self:start}
.footer{margin:24px 0;color:#64778a;font-size:12px}
.empty{text-align:center;padding:22px;color:#64778a}
@media(max-width:650px){.toolbar{grid-template-columns:1fr}.toolbar button{width:100%}.counts{grid-template-columns:repeat(2,minmax(0,1fr))}.review-form{grid-template-columns:1fr}.report>summary{align-items:start;flex-direction:column;gap:5px}.report-entry{padding:11px}.top{padding:16px}}
`;
const html=(body,script='')=>'<!doctype html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="theme-color" content="#153349"><title>Old World Companion · Report Admin</title>'+
 '<style>'+STYLE+'</style>'+script+'</head><body>'+body+'</body></html>';

export const ADMIN_LOGIN_HTML=html(
 '<header class="top"><div class="row"><span class="brand">Old World Companion · Admin</span></div></header>'+
 '<main><h1>Report review</h1><p class="lead">Administrator sign-in is required before editing review status.</p>'+
 '<p class="note">Submitted unmatched references and review notes are public on GitHub. This is not a full-army-list archive.</p>'+
 '<p><a href="/auth/github" style="display:inline-block;padding:14px 18px;background:#153f61;color:white;border-radius:9px;font-weight:750;text-decoration:none">Sign in with GitHub</a></p>'+
 '<p class="footer">Only the configured repository owner account can sign in. <a href="https://github.com/AnthonyWCurtis/old-world-game-manager/tree/main/reports/unmatched">View public reports on GitHub</a></p></main>'
);
export const ADMIN_SETUP_HTML=html(
 '<header class="top"><span class="brand">Old World Companion · Admin</span></header>'+
 '<main><h1>Admin sign-in not yet configured</h1>'+
 '<p class="lead">The source code is installed, but the GitHub OAuth client ID, client secret and session secret must be set in Cloudflare before you can sign in.</p>'+
 '<p class="note">No public visitor is granted admin permissions when configuration is missing. Your existing anonymous reporting service can continue running.</p>'+
 '<p><a href="https://github.com/AnthonyWCurtis/old-world-game-manager/blob/main/ANONYMOUS_REPORTING_SETUP.md">Owner setup instructions</a></p></main>'
);
export const ADMIN_HTML=html(
 '<header class="top"><div class="row"><div><div class="brand">Old World Companion · Admin</div><small>Report review and reference triage</small></div><form action="/admin/logout" method="post" class="signout"><button>Sign out</button></form></div></header>'+
 '<main><h1>Review reported references</h1><p class="lead">Search the reported unmatched units and selections, inspect their tow.whfb.app references, and record your review status.</p>'+
 '<p class="note"><strong>Privacy:</strong> These reports are anonymous references, <strong>not full army lists</strong>. The reports, review statuses and notes are <strong>public on GitHub</strong>. Do not enter passwords, personal details or confidential notes. Marking an item reviewed or fixed does <strong>not</strong> change the importer or verified source catalogue.</p>'+
 '<section class="toolbar" aria-label="Report filters"><div><label for="reportSearch">Search reports, names, factions or parent units</label><input type="search" id="reportSearch" placeholder="Search reported items…"></div><div><label for="statusFilter">Review status</label><select id="statusFilter"><option value="all">All statuses</option><option value="new">New</option><option value="investigating">Investigating</option><option value="needs-info">Needs more information</option><option value="fixed">Fixed in code</option><option value="not-an-issue">Not an issue</option></select></div><button id="refreshReports" type="button">Refresh</button></section>'+
 '<div id="adminStatus" role="status" aria-live="polite">Loading reports…</div>'+
 '<div id="reportCounts" class="counts" aria-label="Report counts"></div>'+
 '<section id="reportQueue" aria-label="Submitted reports"></section>'+
 '<p class="footer"><a href="https://github.com/AnthonyWCurtis/old-world-game-manager/tree/main/reports/unmatched">Public report archive</a> · <a href="https://github.com/AnthonyWCurtis/old-world-game-manager/blob/main/reports/unmatched/ALL_UNMATCHED.txt">Consolidated unresolved references</a></p></main>',
 '<script defer src="/admin/client.js"></script>'
);

export const ADMIN_SCRIPT=String.raw`
(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={data:null};
const statuses=[
 ['new','New'],['investigating','Investigating'],['needs-info','Needs more information'],
 ['fixed','Fixed in code'],['not-an-issue','Not an issue']
];
function element(tag,text,cls){
 const e=document.createElement(tag);
 if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;
 return e;
}
function validLink(value){
 try{
  const u=new URL(value);
  if(!['https://tow.whfb.app','https://github.com'].includes(u.origin))return null;
  return u.href;
 }catch{return null;}
}
function link(text,url){
 const valid=validLink(url);
 if(!valid)return element('span',text);
 const e=element('a',text);
 e.href=valid;e.target='_blank';e.rel='noopener noreferrer';
 return e;
}
const safeFile=file=>/^report-\d{8}T\d{9}Z-[0-9a-f-]{36}\.txt$/i.test(file);
function status(message,error=false){
 $('adminStatus').textContent=message;$('adminStatus').dataset.error=error?'true':'false';
}
function record(report,item){
 const outer=element('article',undefined,'report-entry');
 const head=element('div',undefined,'entry-head');
 head.append(element('strong',item.type.toUpperCase()+' · '+item.name));
 const badge=element('span',statuses.find(s=>s[0]===item.review.status)?.[1]||'New','state '+item.review.status);
 head.append(badge);outer.append(head);
 outer.append(element('p','Parent unit: '+item.unit+' · '+item.kind+
   ' · source line '+(item.sourceLine||'unknown'),'field'));
 const links=element('div',undefined,'links');
 if(item.sourceUrl)links.append(link('Published unit reference',item.sourceUrl));
 if(safeFile(report.filename))
  links.append(link('Original submitted report','https://github.com/AnthonyWCurtis/old-world-game-manager/blob/main/reports/unmatched/'+report.filename));
 if(item.review.fixUrl)links.append(link('Recorded fix / evidence',item.review.fixUrl));
 outer.append(links);
 const form=element('form',undefined,'review-form');
 const field=(caption,input,wide=false)=>{
  const wrap=element('label',undefined,wide?'wide':'');
  wrap.append(element('span',caption),input);
  return wrap;
 };
 const selection=element('select');
 for(const [value,title] of statuses){
  const opt=element('option',title);opt.value=value;selection.append(opt);
 }
 selection.value=item.review.status;
 const note=element('input');
 note.type='text';note.maxLength=300;note.value=item.review.note||'';
 note.placeholder='Public note (maximum 300 characters)';
 const evidence=element('input');
 evidence.type='url';evidence.maxLength=300;evidence.value=item.review.fixUrl||'';
 evidence.placeholder='Source page, merged project PR or commit';
 const save=element('button','Save review');
 save.type='submit';
 form.append(field('Review status',selection),field('Public review note',note),
  field('Fix / evidence URL',evidence,true),save);
 form.addEventListener('submit',event=>{
  event.preventDefault();
  void saveReview({filename:report.filename,ordinal:item.ordinal,status:selection.value,
   note:note.value,fixUrl:evidence.value},save);
 });
 outer.append(form);
 return outer;
}
function draw(){
 if(!state.data)return;
 const term=$('reportSearch').value.toLowerCase().trim();
 const filter=$('statusFilter').value;
 const {counts}=state.data;
 const summary=$('reportCounts');
 summary.replaceChildren();
 for(const [title,value] of [
  ['Reports',state.data.totalReports],['Entries',state.data.totalItems],
  ['New',counts.new||0],['Investigating',counts.investigating||0]]){
  const box=element('div',undefined,'count');
  box.append(element('b',value),element('span',title));summary.append(box);
 }
 const queue=$('reportQueue');queue.replaceChildren();
 let visible=0;
 for(const report of state.data.reports){
  const matching=report.entries.filter(entry=>{
   if(filter!=='all'&&entry.review.status!==filter)return false;
   if(!term)return true;
   return [entry.name,entry.unit,entry.kind,entry.type,report.faction,
    report.format,entry.review.note].some(v=>String(v||'').toLowerCase().includes(term));
  });
  if(!matching.length)continue;
  visible+=matching.length;
  const item=element('details',undefined,'report');
  const summary=element('summary');
  summary.append(element('strong',report.faction+' · '+matching.length+' entries'));
  summary.append(element('span',(report.submitted||'Date unknown')+' · '+report.format));
  item.append(summary);
  if(term||filter!=='all')item.open=true;
  const body=element('div',undefined,'report-details');
  body.append(element('p','Report ID: '+report.reportId+' · Source files remain unchanged.','report-meta'));
  for(const recordItem of matching)body.append(record(report,recordItem));
  item.append(body);queue.append(item);
 }
 if(!visible)queue.append(element('p','No reported entries match these filters.','empty'));
}
async function jsonFetch(url,init){
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...init});
 let payload=null;try{payload=await response.json();}catch{}
 if(response.status===401){location.href='/admin';throw Error('Admin session expired. Sign in again.');}
 if(!response.ok)throw Error(payload?.error||'Could not load report data ('+response.status+').');
 return payload;
}
async function refresh(){
 status('Loading submitted report files…');
 try{
  state.data=await jsonFetch('/admin/api/reports');
  draw();
  status(state.data.totalReports+' reports · '+state.data.totalItems+' entries. Review does not automatically fix source data.');
 }catch(error){status(error.message,true);}
}
async function saveReview(values,button){
 button.disabled=true;button.textContent='Saving…';
 try{
  const result=await jsonFetch('/admin/api/review',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)
  });
  if(result.ok!==true)throw Error('Review was not saved.');
  status('Review saved publicly to GitHub. The importer has not been changed.');
  await refresh();
 }catch(error){status('Review not saved: '+error.message,true);}
 finally{button.disabled=false;button.textContent='Save review';}
}
$('reportSearch').addEventListener('input',draw);
$('statusFilter').addEventListener('change',draw);
$('refreshReports').addEventListener('click',()=>void refresh());
void refresh();
})();
`;

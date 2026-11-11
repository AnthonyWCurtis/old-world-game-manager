/**
 * Untrusted anonymous report text -> safe structured records for owner review.
 * The contents are PUBLIC; review notes are also stored in a public repo file.
 */
export const REVIEW_STATUSES=Object.freeze([
 'new','investigating','needs-info','fixed','not-an-issue'
]);
const FILE_PATTERN=/^report-\d{8}T\d{9}Z-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/i;
const REPO='https://github.com/AnthonyWCurtis/old-world-game-manager';
export const validReportFilename=value=>typeof value==='string'&&FILE_PATTERN.test(value);
const trunc=(value,max=200)=>String(value??'').trim().slice(0,max);
export function safeReference(value){
 try{
  const url=new URL(value);
  if(url.origin==='https://tow.whfb.app'&&
    /^\/unit\/[a-z0-9-]+\/?$/i.test(url.pathname)&&!url.search&&!url.hash)
    return url.href;
 }catch{}
 return null;
}
export function parseReportFile(filename,text){
 if(!validReportFilename(filename))throw Error('Invalid report file name.');
 if(typeof text!=='string'||text.length>30000)throw Error('Invalid report file contents.');
 const lines=text.split(/\r?\n/);
 let reportId=null,submitted=null,format='Unknown',faction='Unknown',entry=null;
 const entries=[];
 const flush=()=>{
  if(entry?.name&&entry.unit)entries.push(entry);
  entry=null;
 };
 for(const line of lines){
  const meta=line.match(/^(Report ID|Submitted|Export format|Faction):\s*(.+)$/);
  if(meta){
   const value=trunc(meta[2],150);
   if(meta[1]==='Report ID')reportId=value;
   else if(meta[1]==='Submitted')submitted=value;
   else if(meta[1]==='Export format')format=value;
   else if(meta[1]==='Faction')faction=value;
   continue;
  }
  const head=line.match(/^\[(\d{1,3})\] (UNIT|SELECTION):\s*(.*)$/);
  if(head){
   flush();
   const ordinal=Number(head[1]);
   if(ordinal<1||ordinal>100)continue;
   entry={ordinal,type:head[2].toLowerCase(),name:trunc(head[3]),
    unit:null,kind:'unknown',sourceLine:null,sourceUrl:null,
    key:filename+'#'+ordinal};
   continue;
  }
  if(!entry)continue;
  const field=line.match(/^\s{2}(Parent unit|Kind|Source line|Parent unit reference):\s*(.*)$/);
  if(!field)continue;
  const value=trunc(field[2],300);
  if(field[1]==='Parent unit')entry.unit=trunc(value);
  else if(field[1]==='Kind')entry.kind=trunc(value,65)||'unknown';
  else if(field[1]==='Source line'){
   const n=Number(value);
   entry.sourceLine=Number.isSafeInteger(n)&&n>0&&n<1000000?n:null;
  }else if(field[1]==='Parent unit reference')entry.sourceUrl=safeReference(value);
 }
 flush();
 const uuid=filename.match(/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.txt$/i)?.[1];
 return {filename,reportId:reportId||uuid,submitted,format,faction,entries};
}
function safeReviewUrl(value){
 if(!value)return '';
 try{
  const url=new URL(value);
  if(url.origin==='https://tow.whfb.app'&&!url.username&&!url.password&&!url.search&&!url.hash&&
    /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/i.test(url.pathname))return url.href;
  if(url.origin==='https://github.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&
    url.pathname.startsWith('/AnthonyWCurtis/old-world-game-manager/')&&
    /^\/AnthonyWCurtis\/old-world-game-manager\/(?:pull\/\d+|commit\/[a-f0-9]{7,40})\/?$/i.test(url.pathname))
    return url.href;
 }catch{}
 return null;
}
export function validateReview(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid review.');
 const {filename,ordinal,status}=input;
 if(!validReportFilename(filename))throw Error('Invalid report filename.');
 if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>100)throw Error('Invalid entry ordinal.');
 if(!REVIEW_STATUSES.includes(status))throw Error('Invalid review status.');
 const note=String(input.note??'');
 if(note.length>300||/[\r\n<>]/.test(note))throw Error('Review note must be one line, at most 300 characters, without markup.');
 const supplied=String(input.fixUrl??'').trim();
 if(supplied.length>300)throw Error('Evidence link is too long.');
 const fixUrl=safeReviewUrl(supplied);
 if(fixUrl===null)throw Error('Invalid evidence URL; use a source rule or project PR/commit.');
 if(status==='fixed'&&!(fixUrl?.startsWith(REPO+'/pull/')||fixUrl?.startsWith(REPO+'/commit/')))
  throw Error('Fixed status requires a project PR or commit evidence link.');
 return {key:filename+'#'+ordinal,filename,ordinal,status,note:note.trim(),fixUrl};
}
export function summarizeReports(reports,reviews={}){
 const source=reviews?.entries&&typeof reviews.entries==='object'?reviews.entries:{};
 const counts=Object.fromEntries(REVIEW_STATUSES.map(s=>[s,0]));
 let totalItems=0;
 const projected=reports.map(report=>({
  ...report,
  entries:report.entries.map(entry=>{
   const reviewed=source[entry.key]||{};
   const status=REVIEW_STATUSES.includes(reviewed.status)?reviewed.status:'new';
   counts[status]++;totalItems++;
   return {...entry,review:{status,
    note:typeof reviewed.note==='string'?trunc(reviewed.note,300):'',
    fixUrl:safeReviewUrl(reviewed.fixUrl)||''}};
  })
 }));
 return {reports:projected,totalReports:projected.length,totalItems,counts};
}

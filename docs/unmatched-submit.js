import { collectUnmatched } from './unmatched-debug.js?v=0.2.7';

export const REPORT_START='OWGM-UNMATCHED-REPORT-V1';
export const REPORT_END='END-OWGM-UNMATCHED-REPORT-V1';
const REPOSITORY='AnthonyWCurtis/old-world-game-manager';
const clean=(value,max=140)=>String(value??'Unknown').replace(/[\r\n|\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)||'Unknown';
const validUrl=value=>{
 try{
  const u=new URL(String(value||''));
  return u.origin==='https://tow.whfb.app' && u.pathname.startsWith('/unit/') && !u.search && !u.hash?u.href:'-';
 }catch{return '-';}
};

/** Public GitHub issue format for short, reviewable unmatched-only submissions.
 * Does not include player details, original list, complete selections or points.
 */
export function prepareUnmatchedSubmission(army){
 const all=collectUnmatched(army);
 const records=all.slice(0,100);
 const format=clean(army?.format?.exporter,48)+' / '+clean(army?.format?.layout,48);
 const faction=clean(army?.army?.faction?.value,100);
 const lines=[
  REPORT_START,
  'Format: '+format,
  'Faction: '+faction,
  'Entries: '+records.length,
  '',
  ...records.map(r=>'- '+(r.type==='unit'?'UNIT':'SELECTION')+
   ' | '+clean(r.name)+' | '+clean(r.unit)+' | '+validUrl(r.unitUrl)+
   ' | '+(Number.isSafeInteger(r.sourceLine)?r.sourceLine:'-')),
  '',
  REPORT_END
 ];
 const body=lines.join('\n');
 const title='[Unmatched report] '+records.length+' reference'+(records.length===1?'':'s')+' · '+format;
 const base='https://github.com/'+REPOSITORY+'/issues/new';
 const url=base+'?'+new URLSearchParams({title,body}).toString();
 return {records:all,body,url,title,tooLong:url.length>6500,truncated:all.length>records.length};
}

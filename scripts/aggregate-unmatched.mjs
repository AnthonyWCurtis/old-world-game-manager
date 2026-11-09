import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function parseSubmittedReport(text){
 const raw=String(text||'').slice(0,12000);
 const lines=raw.split(/\r?\n/);
 const out=[];
 let entry=null;
 const flush=()=>{
  if(entry?.name&&entry?.unit)out.push(entry);
  entry=null;
 };
 for(const line of lines){
  const head=line.match(/^\[\d+\]\s+(UNIT|SELECTION):\s+(.+)$/);
  if(head){flush();entry={type:head[1],name:head[2].trim(),unit:null,url:'-',kind:null};continue;}
  if(!entry)continue;
  const name=line.match(/^\s+Parent unit:\s+(.+)$/);
  if(name)entry.unit=name[1].trim();
  const link=line.match(/^\s+Parent unit reference:\s+(.+)$/);
  if(link)entry.url=link[1].trim();
  const kind=line.match(/^\s+Kind:\s+(.+)$/);
  if(kind)entry.kind=kind[1].trim();
 }
 flush();
 return out;
}
export function consolidate(reports){
 const all=new Map();
 let occurrences=0;
 for(const report of reports){
  for(const item of parseSubmittedReport(report.content)){
   occurrences++;
   const key=[item.type,item.name.toLowerCase(),item.unit.toLowerCase(),item.url].join('|');
   if(!all.has(key))all.set(key,{...item,occurrences:0,files:new Set()});
   const saved=all.get(key);
   saved.occurrences++;
   saved.files.add(report.name);
  }
 }
 const sorted=[...all.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit));
 const lines=[
  'Warhammer: The Old World — ALL UNMATCHED REFERENCES',
  'Collected from anonymous reports submitted by players.',
  'These are unresolved source references, not invalid army selections.',
  'Distinct missing references: '+sorted.length,
  'Unmatched occurrences: '+occurrences,
  'Report files: '+reports.length,
  ''
 ];
 if(!sorted.length)lines.push('No unmatched reports yet.');
 for(const item of sorted){
  lines.push(item.name+' ('+item.type+')',
   '  Parent unit: '+item.unit,
   '  Kind: '+(item.kind||'not specified'),
   '  Parent source: '+item.url,
   '  Occurrences: '+item.occurrences,
   '  Report files: '+[...item.files].sort().join(', '),
   '');
 }
 return lines.join('\n').trimEnd()+'\n';
}
export function rebuild(dir=resolve('reports/unmatched')){
 const files=readdirSync(dir).filter(name=>/^report-[0-9TZ-]+-[a-f0-9-]{36}\.txt$/.test(name)).sort();
 const reports=files.map(name=>({name,content:readFileSync(join(dir,name),'utf8')}));
 const text=consolidate(reports);
 writeFileSync(join(dir,'ALL_UNMATCHED.txt'),text,'utf8');
 return {reports:reports.length,bytes:text.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=rebuild();
 process.stdout.write('Consolidated '+result.reports+' report files.\n');
}

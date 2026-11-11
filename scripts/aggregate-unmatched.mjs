import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {findReference} from '../docs/catalog.js';

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
  if(head){flush();entry={type:head[1],name:head[2].trim(),unit:null,url:'-',kind:null,sourceLine:null};continue;}
  if(!entry)continue;
  const name=line.match(/^\s+Parent unit:\s+(.+)$/);
  if(name)entry.unit=name[1].trim();
  const link=line.match(/^\s+Parent unit reference:\s+(.+)$/);
  if(link)entry.url=link[1].trim();
  const kind=line.match(/^\s+Kind:\s+(.+)$/);
  if(kind)entry.kind=kind[1].trim();
  const originalLine=line.match(/^\s+Source line:\s+(\d+)$/);
  if(originalLine)entry.sourceLine=Number(originalLine[1]);
 }
 flush();
 return out;
}
/**
 * Historical report text is immutable, including malformed selection names.
 * Match only the exact THREE consecutive fragments emitted by an OWB
 * multi-line bracketed Wood Elf Beast Pack choice. This requires the
 * verified unit profile https://tow.whfb.app/unit/wood-elf-beast-pack
 * and its Deepwood Hound choice:
 * https://tow.whfb.app/unit/deepwood-hound
 *
 * The current parser reassembles these fragments into a single selection.
 * Do not relabel unrelated, incomplete or unverified reports as fixed.
 */
export function recoveredWrappedSelections(entries){
 const recovered=new Set();
 for(let i=0;i+2<entries.length;i++){
  const [a,b,c]=entries.slice(i,i+3);
  if([a,b,c].some(x=>x.type!=='SELECTION'||x.unit!=='Wood Elf Beast Pack'||
     x.url!=='https://tow.whfb.app/unit/wood-elf-beast-pack'))continue;
  if(!/^[1-3]x Deepwood Hound \[Hand weapons \(Claws \+ fangs$/i.test(a.name)||
     b.name!=='tusks'||c.name!=='teeth)]')continue;
  if(!Number.isSafeInteger(a.sourceLine)||b.sourceLine!==a.sourceLine+1||
     c.sourceLine!==a.sourceLine+2)continue;
  recovered.add(i);recovered.add(i+1);recovered.add(i+2);
  i+=2;
 }
 return recovered;
}

export function consolidate(reports){
 const all=new Map();
 let occurrences=0,archivedOccurrences=0,resolvedOccurrences=0;
 for(const report of reports){
  const items=parseSubmittedReport(report.content);
  const parserFixed=recoveredWrappedSelections(items);
  for(const [index,item] of items.entries()){
   archivedOccurrences++;
   if(parserFixed.has(index)){
    resolvedOccurrences++;
    continue;
   }
   // Historical report files are immutable. Show only names that still
   // lack a *reviewed catalogue* reference, so repaired issues disappear
   // from the current copy-paste queue without losing the audit trail.
   const reference=findReference(item.name,item.type==='UNIT'?'unit':'selection',item.unit);
   if(reference){
    resolvedOccurrences++;
    continue;
   }
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
  'Previously reported and now source-linked or parser-fixed: '+resolvedOccurrences,
  'Archived occurrences (including resolved): '+archivedOccurrences,
  'Report files: '+reports.length,
  ''
 ];
 if(!sorted.length)lines.push(reports.length?'No unresolved catalogue references remain in archived reports. Original reports are retained as history.':'No unmatched reports yet.');
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

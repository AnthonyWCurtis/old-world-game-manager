/**
 * Converts validated public "unmatched report" GitHub issues into text files.
 * This script only reads the GitHub event JSON as DATA. Nothing from an issue
 * is used as a file path or executed as a shell command.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const START='OWGM-UNMATCHED-REPORT-V1';
const END='END-OWGM-UNMATCHED-REPORT-V1';
const REPO='AnthonyWCurtis/old-world-game-manager';
const MAX_BODY=24000;
const clean=(s,n=140)=>String(s||'').replace(/[\r\n|\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
export function parseIssueBody(body){
 if(typeof body!=='string'||body.length>MAX_BODY)throw Error('Invalid or excessively long report');
 const lines=body.replace(/\r/g,'').split('\n').map(s=>s.trim());
 if(lines[0]!==START||lines.at(-1)!==END)throw Error('Missing report delimiters');
 const format=lines.find(s=>s.startsWith('Format: '))?.slice(8);
 const faction=lines.find(s=>s.startsWith('Faction: '))?.slice(9);
 const countString=lines.find(s=>s.startsWith('Entries: '))?.slice(9);
 const count=Number(countString);
 if(!format||!faction||!Number.isSafeInteger(count)||count<1||count>100)
  throw Error('Missing or invalid report metadata');
 const items=[];
 for(const line of lines){
  if(!line.startsWith('- '))continue;
  const fields=line.slice(2).split(' | ');
  if(fields.length!==5)throw Error('Malformed report entry');
  const [type,name,unit,unitUrl,sourceLine]=fields.map(s=>clean(s));
  if(!['SELECTION','UNIT'].includes(type)||!name||!unit)throw Error('Malformed type or name');
  if(unitUrl!=='-'&&!/^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+\/?$/i.test(unitUrl))
   throw Error('Untrusted unit source URL');
  if(sourceLine!=='-'&&!/^\d{1,7}$/.test(sourceLine))throw Error('Invalid source line');
  items.push({type,name,unit,unitUrl,sourceLine});
 }
 if(items.length!==count)throw Error('Entry count mismatch');
 return {format:clean(format,100),faction:clean(faction,100),items};
}
export function archiveIssueReport(event,root=process.cwd()){
 if(event?.repository?.full_name!==REPO)throw Error('Wrong repository');
 const issue=event.issue;
 if(!Number.isSafeInteger(issue?.number)||issue.number<1||issue.number>999999999)throw Error('Invalid issue number');
 if(issue.pull_request||!String(issue.title||'').startsWith('[Unmatched report] '))
  throw Error('Not an unmatched reference issue');
 const {format,faction,items}=parseIssueBody(issue.body);
 const dir=resolve(root,'reports','unmatched');
 mkdirSync(dir,{recursive:true});
 const filename='issue-'+String(issue.number).padStart(6,'0')+'.txt';
 const link='https://github.com/'+REPO+'/issues/'+issue.number;
 const report=[
  'Unmatched reference report — GitHub issue #'+issue.number,
  'Submitted: '+clean(issue.created_at,40),
  'Issue: '+link,
  'Format: '+format,
  'Faction: '+faction,
  'Entries: '+items.length,'',
  ...items.map(x=>x.type+' | '+x.name+' | '+x.unit+' | '+x.unitUrl+' | '+x.sourceLine),
  ''
 ].join('\n');
 writeFileSync(join(dir,filename),report,'utf8');
 const files=readdirSync(dir).filter(s=>/^issue-\d{6,9}\.txt$/.test(s)).sort();
 const seen=new Map();
 let total=0;
 for(const f of files){
  const raw=readFileSync(join(dir,f),'utf8');
  for(const line of raw.split('\n')){
   const fields=line.split(' | ');
   if(fields.length!==5||!['SELECTION','UNIT'].includes(fields[0]))continue;
   const [type,name,unit,url]=fields;
   const key=[type,name.toLocaleLowerCase('en'),unit.toLocaleLowerCase('en'),url].join('|');
   const previous=seen.get(key)||{type,name,unit,url,occurrences:0,reports:new Set()};
   previous.occurrences++;
   previous.reports.add(f.replace('.txt',''));
   seen.set(key,previous);
   total++;
  }
 }
 const ordered=[...seen.values()].sort((a,b)=>
  a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit)||a.type.localeCompare(b.type));
 const aggregate=[
  'Warhammer: The Old World — All unmatched reference reports',
  'Public GitHub reports only. An unmatched name is not evidence of an illegal selection.',
  'Unique unmatched references: '+ordered.length,
  'Total occurrences: '+total,
  'Issue reports archived: '+files.length,
  '',
  ...ordered.flatMap(x=>[
   x.name+' ['+x.type+']',
   '  In unit: '+x.unit,
   '  Unit source: '+x.url,
   '  Occurrences: '+x.occurrences,
   '  Reports: '+[...x.reports].join(', '),''
  ])
 ].join('\n');
 writeFileSync(join(dir,'ALL_UNMATCHED.txt'),aggregate,'utf8');
 return {file:join(dir,filename),aggregate:join(dir,'ALL_UNMATCHED.txt'),count:items.length,unique:ordered.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const result=archiveIssueReport(event);
  process.stdout.write('Saved '+result.count+' unmatched records; '+result.unique+' distinct in aggregate.\n');
 }catch(e){
  process.stderr.write('Unmatched issue ignored or invalid: '+e.message+'\n');
  process.exitCode=1;
 }
}

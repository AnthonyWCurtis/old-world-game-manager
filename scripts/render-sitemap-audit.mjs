/** Read-only Markdown view of the sitemap audit JSON. Never infers rules correctness. */
import {readFile,writeFile} from 'node:fs/promises';
const SOURCE='https://tow.whfb.app';
const safe=url=>{try{const u=new URL(url);return u.origin===SOURCE&&!u.search&&!u.hash&&
 /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(u.pathname)?u.href:null;}catch{return null;}};
const clean=x=>String(x??'').replace(/[\r\n|\x60<>]/g,' ').replace(/\s+/g,' ').trim();
const link=url=>safe(url)?'[Source]('+safe(url)+')':'Source unavailable';
const priorities=['wizardLevel','magicLore','armourValue','costOverride','magicItem','bodyBefore','bodyAfter'];
export function summarizeCoverage(report){
 if(!report?.counts||!Array.isArray(report.warnings)||!Array.isArray(report.errors))
  throw Error('Expected sitemap coverage JSON');
 const byField=new Map(),misc=new Map(),codes=new Map();
 function add(map,key,item){
  if(!map.has(key))map.set(key,new Map());
  const m=map.get(key);m.set(item.id||item.sourceUrl||item.name||String(m.size),item);
 }
 for(const w of report.warnings){
  add(codes,String(w.code||'UNKNOWN'),w);
  if(w.code!=='EXTRACTION_WARNINGS')continue;
  let notes;try{notes=JSON.parse(w.detail);}catch{notes=[w.detail||'Unspecified warning'];}
  if(!Array.isArray(notes))notes=[w.detail||'Unspecified warning'];
  for(const n of notes){
   const str=String(n),prefix='Unmapped source fields present:';
   if(str.startsWith(prefix)){
    for(const field of str.slice(prefix.length).split(',').map(x=>x.trim()).filter(Boolean))
     add(byField,field,w);
   }else add(misc,str,w);
  }
 }
 const sort=map=>[...map].map(([name,items])=>({
  name,count:items.size,units:[...items.values()].sort((a,b)=>
   String(a.name||'').localeCompare(String(b.name||'')))
 })).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 return {fields:sort(byField),misc:sort(misc),codes:sort(codes)};
}
export function renderCoverageMarkdown(report){
 const grouped=summarizeCoverage(report);
 const out=['# Game Manager — source-reference audit','',
  '**Status:** '+clean(report.status||'unknown')+' · **Structural errors:** '+report.errors.length+
   ' · **Warnings:** '+report.warnings.length+' · **Indexed references:** '+
   (report.counts.indexedReferences??'Unknown'),'',
  '**Unit extraction flags:** '+(report.counts.unitWarnings??'?')+' of '+
   (report.counts.sitemapUnits??'?')+' units. A warning does not necessarily indicate a defect.','',
  '## Source snapshot coverage','','| Collection | Indexed entries | Snapshot checked (UTC) | Verification scope |',
  '|---|---:|---|---|'];
 for(const [name,c] of Object.entries(report.collections||{}))
  out.push('| '+clean(name)+' | '+(c.entries??'—')+' | '+clean(c.sourceSnapshotCheckedAt||'Unknown')+
   ' | '+clean(c.status||'stored snapshot only')+' |');
 out.push('','## Unmapped unit fields','',
  'Counts overlap when units have more than one field. Extraction flags are not confirmed rules errors.','',
  '| Field | Affected units | Example source |','|---|---:|---|');
 for(const g of grouped.fields)
  out.push('| '+clean(g.name)+' | '+g.count+' | '+clean(g.units[0]?.name||'Unknown')+
   ' — '+link(g.units[0]?.sourceUrl)+' |');
 if(!grouped.fields.length)out.push('| None reported | 0 | — |');
 out.push('','## Priority review queue','',
  'Linked units are examples for investigation. No claim of rule correctness or legality is made.','');
 for(const field of priorities){
  const group=grouped.fields.find(x=>x.name===field);if(!group)continue;
  out.push('### '+clean(field)+' — '+group.count+' unit(s)','');
  for(const unit of group.units.slice(0,12))
   out.push('- '+clean(unit.name||unit.id)+' — '+link(unit.sourceUrl));
  if(group.count>12)out.push('- …and '+(group.count-12)+' more units in JSON report');
  out.push('');
 }
 out.push('## Other review flags','');
 for(const item of grouped.misc)out.push('- **'+clean(item.name)+'**: '+item.count+' unit(s)');
 for(const item of grouped.codes.filter(x=>x.name!=='EXTRACTION_WARNINGS'))
  out.push('- **'+clean(item.name)+'**: '+item.count+' record(s)');
 if(!grouped.misc.length&&!grouped.codes.some(x=>x.name!=='EXTRACTION_WARNINGS'))
  out.push('No other flags.');
 out.push('','## Structural errors','');
 if(!report.errors.length)out.push('No structural errors detected in the stored audit.');
 else for(const e of report.errors.slice(0,40))
  out.push('- '+clean(e.code)+': '+clean(e.name||e.id||e.detail)+' — '+link(e.sourceUrl));
 out.push('','## Limitations','',clean(report.scope||'Stored snapshot only.'),
  'This does not verify live rules, spells, army legality, costs or completeness of extracted source-page contents.','');
 return out.join('\n');
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 const [input,output]=process.argv.slice(2);
 if(!input||!output){console.error('Usage: node scripts/render-sitemap-audit.mjs report.json summary.md');process.exitCode=2;}
 else try{
  const report=JSON.parse(await readFile(input,'utf8'));
  await writeFile(output,renderCoverageMarkdown(report));
  console.log('Wrote human-readable sitemap audit '+output);
 }catch(error){console.error(error);process.exitCode=1;}
}

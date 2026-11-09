/**
 * Build a discoverable rules-reference index using ONLY tow.whfb.app/sitemap/rules.
 *
 * This is an index of published titles and real source URLs, NOT a mirror of
 * rule wording, verified interpretations, army legality, or a combat engine.
 *
 * One bounded request per refresh. GitHub Actions runs this script outside
 * the browser because the source may not allow cross-origin browser access.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';

export const SOURCE_ORIGIN='https://tow.whfb.app';
export const SITEMAP_URL=SOURCE_ORIGIN+'/sitemap/rules';
const DEST=new URL('../docs/reference-records/rules-index.json',import.meta.url);
const SUMMARY=new URL('../docs/reference-records/rules-summary.json',import.meta.url);
const MAX_BYTES=5_000_000;

const decode=s=>String(s||'')
 .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,num)=>String.fromCodePoint(parseInt(hex||num,hex?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo);/gi,x=>({
  '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  '&ldquo;':'“','&rdquo;':'”','&lsquo;':'‘','&rsquo;':'’'
 })[x.toLowerCase()]||x);
const clean=s=>decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
export const normalizeRuleName=name=>clean(name).normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
function sameOriginPage(raw){
 try{
  const u=new URL(decode(raw),SOURCE_ORIGIN);
  if(u.origin!==SOURCE_ORIGIN||u.search||u.hash||
    !/^\/[a-z0-9][a-z0-9/-]*\/?$/.test(u.pathname)||
    /^\/(?:sitemap|unit|army)(?:\/|$)/.test(u.pathname))return null;
  return SOURCE_ORIGIN+u.pathname.replace(/\/$/,'');
 }catch{return null;}
}
function anchors(markup){
 const out=[];
 for(const match of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const attrs=match[1];
  const href=attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  if(!href)continue;
  const url=sameOriginPage(href[1]||href[2]);
  const name=clean(match[2]);
  if(!url||!name||name.length>180)continue;
  out.push({name,url});
 }
 return out;
}
function headings(markup){
 return [...markup.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(match=>({name:clean(match[2]),start:match.index,end:match.index+match[0].length}));
}
export function parseRulesSitemap(html){
 if(typeof html!=='string'||!html.trim()||html.length>MAX_BYTES)throw Error('Invalid or oversized rules sitemap');
 const markup=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const hs=headings(markup);
 const sectionsHeading=hs.find(h=>h.name==='Sections');
 const indexHeading=hs.find(h=>h.name==='Index'&&(!sectionsHeading||h.start>sectionsHeading.start));
 if(!indexHeading)throw Error('Rules sitemap is missing its alphabetical Index heading');
 const endMain=markup.indexOf('</main>',indexHeading.end);
 const indexMarkup=markup.slice(indexHeading.end,endMain<0?undefined:endMain);
 const candidates=anchors(indexMarkup);
 const byUrl=new Map();
 for(const {name,url} of candidates){
  const existing=byUrl.get(url);
  if(existing){
   if(!existing.alternateNames.includes(name)&&existing.name!==name)existing.alternateNames.push(name);
  }else{
   const pathname=new URL(url).pathname;
   byUrl.set(url,{
    id:'rule-ref:'+pathname,
    name,
    url,
    path:pathname,
    categoryPath:pathname.split('/')[1],
    verificationStatus:'source-indexed',
    alternateNames:[]
   });
  }
 }
 const entries=[...byUrl.values()];
 // Reject incomplete/unexpected site changes rather than claiming the index
 // has full coverage when the source couldn't be parsed.
 if(entries.length<500||entries.length>5000)throw Error('Unexpected rules-index size: '+entries.length);
 for(const name of ['Ambushers','Strike First','Drilled','Armour Bane (X)']){
  if(!entries.some(entry=>normalizeRuleName(entry.name)===normalizeRuleName(name)))
   throw Error('Expected reference absent from source index: '+name);
 }
 const sectionRegion=sectionsHeading&&sectionsHeading.start<indexHeading.start?
  markup.slice(sectionsHeading.end,indexHeading.start):'';
 const sectionLinks=anchors(sectionRegion);
 const sections=[...new Map(sectionLinks.map(x=>[x.url,x])).values()].map(x=>({
  name:x.name,url:x.url,path:new URL(x.url).pathname
 }));
 const byName=new Map();
 for(const entry of entries){
  const key=normalizeRuleName(entry.name);
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(entry.url);
 }
 const ambiguousNames=[...byName.entries()].filter(([,urls])=>new Set(urls).size>1)
  .map(([name,urls])=>({name,sourceUrls:[...new Set(urls)]}));
 const countByCategory=Object.fromEntries([...new Set(entries.map(e=>e.categoryPath))].sort()
  .map(cat=>[cat,entries.filter(e=>e.categoryPath===cat).length]));
 return {sections,entries,ambiguousNames,countByCategory};
}
export function lookupIndexedRule(name,entries){
 // Strictly a unique SAME-NAME URL lookup. An ambiguous rule name cannot be
 // assigned one source location without additional category/parent evidence.
 const key=normalizeRuleName(name);
 const matches=(entries||[]).filter(entry=>normalizeRuleName(entry.name)===key ||
  (entry.alternateNames||[]).some(alias=>normalizeRuleName(alias)===key));
 return matches.length===1?matches[0]:null;
}
export function assembleRulesIndex(html,checkedAt){
 const data=parseRulesSitemap(html);
 return {
  schemaVersion:1,
  collectionType:'source-reference-index',
  source:{origin:SOURCE_ORIGIN,url:SITEMAP_URL,checkedAt,
   verificationStatus:'source-indexed',
   method:'single bounded public HTML sitemap fetch; titles and links only',
   sourceVersion:null},
  scope:'All entries published in the rules sitemap, including gameplay, special rules, equipment and other linked rule/reference pages',
  counts:{sections:data.sections.length,entries:data.entries.length,ambiguousNames:data.ambiguousNames.length},
  categories:data.countByCategory,
  sections:data.sections,
  entries:data.entries,
  ambiguousNames:data.ambiguousNames
 };
}
async function fetchSitemap(url){
 const r=await fetch(url,{
  headers:{'User-Agent':'OldWorldGameManager-RuleIndex/0.1 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'},
  signal:AbortSignal.timeout(30000)
 });
 if(!r.ok)throw Error('Sitemap returned HTTP '+r.status);
 const len=Number(r.headers.get('content-length')||0);
 if(len>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 const data=await r.text();
 if(data.length>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 return data;
}
export async function refreshRulesIndex({fetcher=fetchSitemap,checkedAt=new Date().toISOString()}={}){
 const html=await fetcher(SITEMAP_URL);
 const next=assembleRulesIndex(html,checkedAt);
 let previous=null;
 try{previous=JSON.parse(await readFile(DEST,'utf8'));}catch{}
 // A sudden large index drop is suspicious; do not delete known links on
 // failure or transient upstream HTML changes.
 if(previous?.counts?.entries && next.counts.entries<previous.counts.entries*0.9)
  throw Error('Source index shrank unexpectedly; keeping previous snapshot');
 await mkdir(new URL('../docs/reference-records/',import.meta.url),{recursive:true});
 await writeFile(DEST,JSON.stringify(next,null,2)+'\n');
 const summary={
  schemaVersion:1,collectionType:'source-reference-summary',
  sourceUrl:SITEMAP_URL,checkedAt,
  verificationStatus:'source-indexed',
  ...next.counts,
  categories:next.categories,
  sampleEntries:next.entries.filter(e=>[
    'Drilled','Strike First','Armour Bane (X)','Naval Discipline','Regeneration (X+)'
  ].includes(e.name)).map(e=>({name:e.name,url:e.url,categoryPath:e.categoryPath}))
 };
 await writeFile(SUMMARY,JSON.stringify(summary,null,2)+'\n');
 console.log('Rules sitemap indexed '+next.counts.entries+' exact source URLs across '+
  Object.keys(next.categories).length+' path categories; '+next.counts.sections+
  ' section links; '+next.counts.ambiguousNames+' ambiguous titles.');
 console.log('First 5: '+next.entries.slice(0,5).map(x=>x.url).join(', '));
 return summary;
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 refreshRulesIndex().catch(error=>{console.error(error);process.exitCode=1;});
}

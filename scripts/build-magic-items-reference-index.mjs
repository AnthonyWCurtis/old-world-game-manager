/**
 * Build a static reference index from https://tow.whfb.app/sitemap/magic-items.
 *
 * This sitemap mixes item types, purchasing/runic rules and individual items,
 * abilities, gifts, honours, etc. Indexing a link is not verification of
 * points, item type, restrictions, army eligibility or combat effects.
 *
 * This importer makes ONE bounded sitemap request and does not crawl pages.
 */
import {readFile,writeFile} from 'node:fs/promises';

export const SOURCE_ORIGIN='https://tow.whfb.app';
export const SITEMAP_URL=SOURCE_ORIGIN+'/sitemap/magic-items';
const OUTPUT=new URL('../docs/reference-records/magic-items-index.json',import.meta.url);
const SUMMARY=new URL('../docs/reference-records/magic-items-summary.json',import.meta.url);
const MAX_BYTES=2_000_000;
const TYPE_HEADING='Type Index';
const ITEM_HEADING='Item(/Ability) Index';

const decode=s=>String(s||'')
 .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo);/gi,x=>({
  '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  '&ldquo;':'“','&rdquo;':'”','&lsquo;':'‘','&rsquo;':'’'
 })[x.toLowerCase()]||x);
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export const normalizeMagicItemName=name=>clean(name).normalize('NFKC').toLowerCase()
 .replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\*+$/,'').trim();
function safeUrl(raw,kind){
 try{
  const u=new URL(decode(raw),SOURCE_ORIGIN);
  const prefix=kind==='type'?'magic-items':'magic-item';
  if(u.origin!==SOURCE_ORIGIN||u.search||u.hash||
    !new RegExp('^/'+prefix+'/[a-z0-9-]+/?$').test(u.pathname))return null;
  return SOURCE_ORIGIN+u.pathname.replace(/\/$/,'');
 }catch{return null;}
}
function headings(html){
 return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(m=>({name:clean(m[2]),start:m.index,end:m.index+m[0].length}));
}
function sectionLinks(html,kind){
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  if(!href)continue;
  const url=safeUrl(href[1]||href[2],kind),name=clean(m[2]);
  if(!url||!name||name.length>180)continue;
  out.push({name,url});
 }
 return out;
}
export function parseMagicItemsSitemap(html){
 if(typeof html!=='string'||!html.trim()||html.length>MAX_BYTES)
  throw Error('Invalid or oversized Magic Items sitemap');
 const markup=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const hs=headings(markup);
 const typeHead=hs.find(h=>h.name===TYPE_HEADING);
 const itemHead=hs.find(h=>h.name===ITEM_HEADING&&(!typeHead||h.start>typeHead.start));
 if(!typeHead||!itemHead)throw Error('Missing Type Index or Item(/Ability) Index heading');
 const nextHead=hs.find(h=>h.start>itemHead.start);
 const endMain=markup.indexOf('</main>',itemHead.end);
 const limits=[nextHead?.start,endMain>=0?endMain:null].filter(n=>Number.isInteger(n)&&n>=itemHead.end);
 const itemEnd=limits.length?Math.min(...limits):markup.length;
 const byUrl=new Map();
 for(const [kind,found] of [
  ['type',sectionLinks(markup.slice(typeHead.end,itemHead.start),'type')],
  ['item-or-ability',sectionLinks(markup.slice(itemHead.end,itemEnd),'item-or-ability')]
 ]){
  for(const {name,url} of found){
   const prior=byUrl.get(url);
   if(prior){
    if(prior.name!==name&&!prior.alternateNames.includes(name))prior.alternateNames.push(name);
    continue;
   }
   const path=new URL(url).pathname;
   byUrl.set(url,{id:'magic-item-ref:'+path,name,url,path,kind,
    section:kind==='type'?TYPE_HEADING:ITEM_HEADING,
    verificationStatus:'source-indexed',alternateNames:[]});
  }
 }
 const entries=[...byUrl.values()];
 const totals={
  types:entries.filter(x=>x.kind==='type').length,
  itemsAndAbilities:entries.filter(x=>x.kind==='item-or-ability').length,
  entries:entries.length
 };
 // Reject seriously partial sitemap responses, but allow normal future growth.
 if(totals.types<55||totals.types>150||totals.itemsAndAbilities<600||totals.itemsAndAbilities>1800)
  throw Error('Unexpected magic items sitemap size: '+JSON.stringify(totals));
 for(const [kind,name] of [
  ['type','High Elf Realms Magic Items'],
  ['type','Magic Weapons'],
  ['type','Elven Honours'],
  ['item-or-ability',"Mathlann's Ire"],
  ['item-or-ability','Chayal'],
  ['item-or-ability','Ruby Ring of Ruin'],
  ['item-or-ability','Lore Familiar'],
  ['item-or-ability','Reaver Bow']
 ]){
  if(!entries.some(x=>x.kind===kind&&normalizeMagicItemName(x.name)===normalizeMagicItemName(name)))
   throw Error('Expected '+kind+' absent from sitemap: '+name);
 }
 const byName=new Map();
 for(const entry of entries){
  for(const title of [entry.name,...entry.alternateNames]){
   const key=entry.kind+':'+normalizeMagicItemName(title);
   const set=byName.get(key)||new Set();set.add(entry.url);byName.set(key,set);
  }
 }
 const ambiguousNames=[...byName.entries()].filter(([,urls])=>urls.size>1)
  .map(([key,urls])=>({kind:key.split(':')[0],name:key.slice(key.indexOf(':')+1),sourceUrls:[...urls]}));
 return {entries,totals,ambiguousNames};
}
export function matchMagicItemReference(name,kind,entries){
 // Exact normalized name, optional source section; remove only a trailing
 // source footnote "*" marker, retaining the display name in the record.
 if(kind!=='type'&&kind!=='item-or-ability')return null;
 const key=normalizeMagicItemName(name);
 const matches=(entries||[]).filter(e=>e.kind===kind&&(
  normalizeMagicItemName(e.name)===key||
  (e.alternateNames||[]).some(n=>normalizeMagicItemName(n)===key)
 ));
 return matches.length===1?matches[0]:null;
}
export function assembleMagicItemsIndex(html,checkedAt){
 const {entries,totals,ambiguousNames}=parseMagicItemsSitemap(html);
 return {
  schemaVersion:1,collectionType:'source-reference-index',
  source:{origin:SOURCE_ORIGIN,url:SITEMAP_URL,checkedAt,
   verificationStatus:'source-indexed',sourceVersion:null,
   method:'single bounded public sitemap HTML fetch; titles and source URLs only'},
  scope:'Type Index and Item(/Ability) Index links; no inferred type assignments, points, faction eligibility or item effects',
  counts:{...totals,ambiguousNames:ambiguousNames.length},
  sections:[{name:TYPE_HEADING,count:totals.types},{name:ITEM_HEADING,count:totals.itemsAndAbilities}],
  entries,ambiguousNames
 };
}
async function fetchHtml(url){
 const response=await fetch(url,{headers:{
  'User-Agent':'OldWorldGameManager-MagicItemsIndex/0.1 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'
 },signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Magic items sitemap HTTP '+response.status);
 if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 const body=await response.text();
 if(body.length>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 return body;
}
export async function refreshMagicItemsIndex({fetcher=fetchHtml,checkedAt=new Date().toISOString()}={}){
 const next=assembleMagicItemsIndex(await fetcher(SITEMAP_URL),checkedAt);
 let old=null;
 try{old=JSON.parse(await readFile(OUTPUT,'utf8'));}catch{}
 if(old?.counts?.types&&next.counts.types<old.counts.types*0.9)
  throw Error('Magic item types index shrank unexpectedly; previous snapshot preserved');
 if(old?.counts?.itemsAndAbilities&&next.counts.itemsAndAbilities<old.counts.itemsAndAbilities*0.9)
  throw Error('Magic items index shrank unexpectedly; previous snapshot preserved');
 const summary={
  schemaVersion:1,collectionType:'source-reference-summary',
  sourceUrl:SITEMAP_URL,checkedAt,verificationStatus:'source-indexed',
  ...next.counts,sections:next.sections,
  sampleEntries:next.entries.filter(e=>[
   'High Elf Realms Magic Items','Magic Weapons','Elven Honours',
   "Mathlann's Ire",'Chayal','Ruby Ring of Ruin','Lore Familiar',
   'Reaver Bow','Charmed Shield*','The Pelt of Charandis'
  ].includes(e.name)).map(e=>({name:e.name,kind:e.kind,url:e.url}))
 };
 await writeFile(OUTPUT,JSON.stringify(next,null,2)+'\n');
 await writeFile(SUMMARY,JSON.stringify(summary,null,2)+'\n');
 console.log('Magic Items sitemap indexed '+next.counts.entries+' unique URLs: '+
  next.counts.types+' type/guidance pages, '+next.counts.itemsAndAbilities+
  ' item/ability pages; '+next.counts.ambiguousNames+' ambiguous names.');
 return summary;
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 refreshMagicItemsIndex().catch(error=>{console.error(error);process.exitCode=1;});
}

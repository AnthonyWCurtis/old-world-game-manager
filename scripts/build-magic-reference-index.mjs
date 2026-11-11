/**
 * Build a static, source-linked magic index from tow.whfb.app/sitemap/magic.
 *
 * Sitemap title + URL and source-linked lore-page spell relationships.
 * Does not claim spell effects, caster eligibility, spell generation, casting values,
 * or army legality. Each lore page is fetched once with a bounded delay.
 */
import {readFile,writeFile} from 'node:fs/promises';

export const SOURCE_ORIGIN='https://tow.whfb.app';
export const SITEMAP_URL=SOURCE_ORIGIN+'/sitemap/magic';
const OUTPUT=new URL('../docs/reference-records/magic-index.json',import.meta.url);
const SUMMARY=new URL('../docs/reference-records/magic-summary.json',import.meta.url);
const MAX_BYTES=1_000_000;
const LABEL_LORE='Magic Lore Index';
const LABEL_SPELL='Spell Index';
const GUIDANCE_SLUGS=new Set(['spell-categories-lores','spells-and-spell-generation']);
const decode=s=>String(s||'').replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,
 (_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo);/gi,x=>({
  '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  '&ldquo;':'“','&rdquo;':'”','&lsquo;':'‘','&rsquo;':'’'
 })[x.toLowerCase()]||x);
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export const normalizeMagicName=name=>clean(name).normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'");
function safeUrl(raw,kind){
 try {
  const u=new URL(decode(raw),SOURCE_ORIGIN);
  if(u.origin!==SOURCE_ORIGIN||u.search||u.hash)return null;
  if(!/^\/(?:the-lores-of-magic|spell)\/[a-z0-9-]+\/?$/.test(u.pathname))return null;
  if(kind==='spell'&&!u.pathname.startsWith('/spell/'))return null;
  if(kind==='lore'&&!u.pathname.startsWith('/the-lores-of-magic/'))return null;
  return SOURCE_ORIGIN+u.pathname.replace(/\/$/,'');
 }catch{return null;}
}
function headings(html){
 return [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(m=>({level:Number(m[1]),name:clean(m[2]),start:m.index,end:m.index+m[0].length}));
}
function sectionLinks(html,kind){
 const output=[];
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  if(!href)continue;
  const url=safeUrl(href[1]||href[2],kind),name=clean(m[2]);
  if(!url||!name||name.length>180)continue;
  output.push({name,url});
 }
 return output;
}
export function parseMagicSitemap(html){
 if(typeof html!=='string'||!html.trim()||html.length>MAX_BYTES)
  throw Error('Invalid or oversized magic sitemap');
 // Script/style contents may include duplicate headings/links.
 const markup=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const hs=headings(markup);
 const loreHead=hs.find(h=>h.name===LABEL_LORE);
 const spellHead=hs.find(h=>h.name===LABEL_SPELL&&(!loreHead||h.start>loreHead.start));
 if(!loreHead||!spellHead)throw Error('Missing Magic Lore Index or Spell Index heading');
 const nextAfterSpell=hs.find(h=>h.start>spellHead.start);
 const mainEnd=markup.indexOf('</main>',spellHead.end);
 const spellEndCandidates=[nextAfterSpell?.start,mainEnd>=0?mainEnd:null]
  .filter(x=>Number.isInteger(x)&&x>=spellHead.end);
 const spellEnd=spellEndCandidates.length?Math.min(...spellEndCandidates):markup.length;
 const lores=sectionLinks(markup.slice(loreHead.end,spellHead.start),'lore');
 const spells=sectionLinks(markup.slice(spellHead.end,spellEnd),'spell');
 const unique=new Map();
 for(const [group,items] of [['lore',lores],['spell',spells]]){
  for(const {name,url} of items){
   const pathname=new URL(url).pathname;
   const kind=group==='spell'?'spell':GUIDANCE_SLUGS.has(pathname.split('/').at(-1))?'magic-reference':'lore';
   const record=unique.get(url);
   if(record){
    if(record.name!==name&&!record.alternateNames.includes(name))record.alternateNames.push(name);
    continue;
   }
   unique.set(url,{
    id:'magic-ref:'+pathname,
    name,url,path:pathname,kind,
    section:group==='spell'?LABEL_SPELL:LABEL_LORE,
    verificationStatus:'source-indexed',alternateNames:[]
   });
  }
 }
 const entries=[...unique.values()];
 const totals={
  loreSection:entries.filter(x=>x.section===LABEL_LORE).length,
  spellSection:entries.filter(x=>x.section===LABEL_SPELL).length,
  lores:entries.filter(x=>x.kind==='lore').length,
  spells:entries.filter(x=>x.kind==='spell').length,
  magicReferences:entries.filter(x=>x.kind==='magic-reference').length,
  entries:entries.length
 };
 if(totals.loreSection<20||totals.spellSection<100||totals.entries>500)
  throw Error('Unexpected magic sitemap size: '+JSON.stringify(totals));
 for(const name of ['Battle Magic','Elementalism','High Magic','Illusion','Drain Magic','Earthen Ramparts']){
  if(!entries.some(e=>normalizeMagicName(e.name)===normalizeMagicName(name)))
   throw Error('Expected magic reference missing: '+name);
 }
 const byName=new Map();
 for(const record of entries){
  for(const name of [record.name,...record.alternateNames]){
   const key=normalizeMagicName(name);
   const set=byName.get(key)||new Set();set.add(record.url);byName.set(key,set);
  }
 }
 const ambiguousNames=[...byName.entries()]
  .filter(([,urls])=>urls.size>1).map(([name,urls])=>({name,sourceUrls:[...urls]}));
 return {entries,totals,ambiguousNames};
}
export function matchMagicReference(name,kind,entries){
 // Only exact normalized titles, optionally restricted by source section.
 // No unchecked aliases, guessing or treating a lore page as a spell page.
 const key=normalizeMagicName(name);
 const options=(entries||[]).filter(e=>(!kind||e.kind===kind)&&
  (normalizeMagicName(e.name)===key ||
   (e.alternateNames||[]).some(s=>normalizeMagicName(s)===key)));
 return options.length===1?options[0]:null;
}
export function assembleMagicIndex(html,checkedAt){
 const {entries,totals,ambiguousNames}=parseMagicSitemap(html);
 return {
  schemaVersion:1,collectionType:'source-reference-index',
  source:{origin:SOURCE_ORIGIN,url:SITEMAP_URL,checkedAt,
   verificationStatus:'source-indexed',sourceVersion:null,
   method:'single bounded public HTML sitemap fetch; titles and URLs only'},
  scope:'Magic lore pages, magic guidance pages and spell pages listed by the source sitemap',
  counts:{...totals,ambiguousNames:ambiguousNames.length},
  sections:[{name:LABEL_LORE,count:totals.loreSection},{name:LABEL_SPELL,count:totals.spellSection}],
  entries,ambiguousNames
 };
}

/**
 * A lore page itself is the source of truth for its advertised spell links.
 * This is an INDEX relationship only, not proof that an individual wizard may
 * generate, substitute or know a spell. No spell effect text is mirrored.
 */
export function parseLoreSpellLinks(html,lore,spellEntries){
 if(typeof html!=='string'||!html.trim()||html.length>MAX_BYTES)
  throw Error('Invalid or oversized lore source page');
 if(!lore||lore.kind!=='lore'||!safeUrl(lore.url,'lore')||
    !Array.isArray(spellEntries))throw Error('Invalid lore or spell catalogue');
 const markup=html.replace(/<(script|style|noscript)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi,'');
 // Restrict discovery to the article, not global navigation or page footer.
 const main=markup.match(/<main\\b[^>]*>([\\s\\S]*?)<\\/main>/i)?.[1];
 if(!main)throw Error('No main lore content at '+lore.url);
 const catalogue=new Map(spellEntries.filter(e=>e.kind==='spell').map(e=>[e.url,e]));
 const links=sectionLinks(main,'spell');
 const found=new Map();
 for(const link of links){
  const spell=catalogue.get(link.url);
  if(!spell)continue; // Unindexed URLs are never recorded as eligible spells.
  const name=link.name.replace(/^\\d+\\.\\s*/,'').replace(/\\s*\\(Signature Spell\\)\\s*$/i,'').trim();
  if(normalizeMagicName(name)!==normalizeMagicName(spell.name))continue;
  const signature=/\\(Signature Spell\\)/i.test(link.name);
  if(found.has(spell.id)){if(signature)found.get(spell.id).signature=true;continue;}
  found.set(spell.id,{id:spell.id,signature});
 }
 if(!found.size||found.size>12)
  throw Error('Unexpected spell links for lore '+lore.name+': '+found.size);
 return [...found.values()];
}
/** Bounded, sequential source verification: one request per indexed lore page. */
export async function enrichMagicIndexWithLoreLinks(index,{fetcher,checkedAt=index?.source?.checkedAt}={}){
 if(!index?.entries?.length||typeof fetcher!=='function')
  throw Error('Magic index and source fetcher required');
 const entries=index.entries.map(e=>({...e}));
 const spells=entries.filter(e=>e.kind==='spell');
 const lores=entries.filter(e=>e.kind==='lore');
 if(lores.length<20||lores.length>40)throw Error('Lore page count outside review bounds');
 const spellLoreIds=new Map();
 let linked=0;
 for(const [position,lore] of lores.entries()){
  if(position)await new Promise(resolve=>setTimeout(resolve,250));
  const source=await fetcher(lore.url);
  const links=parseLoreSpellLinks(source,lore,spells);
  lore.spellIds=links.map(x=>x.id);
  lore.signatureSpellIds=links.filter(x=>x.signature).map(x=>x.id);
  lore.spellLinksCheckedAt=checkedAt;
  lore.spellLinkStatus='source-lore-page-indexed';
  linked+=links.length;
  for(const {id} of links){
   const ls=spellLoreIds.get(id)||[];
   ls.push(lore.id);
   spellLoreIds.set(id,ls);
  }
 }
 for(const spell of spells)spell.loreIds=spellLoreIds.get(spell.id)||[];
 return {...index,entries,loreLinks:{
  status:'source-lore-page-indexed',
  checkedAt,
  method:'sequential, bounded lore-page HTML spell links; index only, not spell legality',
  pagesChecked:lores.length,
  linksIndexed:linked,
  spellsWithLore:spells.filter(e=>e.loreIds.length).length
 }};
}

async function fetchHtml(url){
 const r=await fetch(url,{headers:{
  'User-Agent':'OldWorldGameManager-MagicIndex/0.1 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'
 },signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Magic sitemap HTTP '+r.status);
 if(Number(r.headers.get('content-length')||0)>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 const body=await r.text();
 if(body.length>MAX_BYTES)throw Error('Sitemap exceeds size budget');
 return body;
}
export async function refreshMagicIndex({fetcher=fetchHtml,checkedAt=new Date().toISOString()}={}){
 const html=await fetcher(SITEMAP_URL);
 const next=await enrichMagicIndexWithLoreLinks(assembleMagicIndex(html,checkedAt),{fetcher,checkedAt});
 let previous=null;
 try{previous=JSON.parse(await readFile(OUTPUT,'utf8'));}catch{}
 if(previous?.counts?.entries&&next.counts.entries<previous.counts.entries*0.9)
  throw Error('Magic sitemap shrank unexpectedly; previous index preserved');
 const summary={
  schemaVersion:1,collectionType:'source-reference-summary',
  sourceUrl:SITEMAP_URL,checkedAt,verificationStatus:'source-indexed',
  ...next.counts,
  sections:next.sections,
  sampleEntries:next.entries.filter(e=>['High Magic','Elementalism','Illusion','Drain Magic',
   'Earthen Ramparts','Plague of Rust','Glittering Robe','Travel Mystical Pathway']
   .includes(e.name)).map(e=>({name:e.name,kind:e.kind,url:e.url}))
 };
 await writeFile(OUTPUT,JSON.stringify(next,null,2)+'\n');
 await writeFile(SUMMARY,JSON.stringify(summary,null,2)+'\n');
 console.log('Magic sitemap indexed '+next.counts.entries+' URLs: '+
  next.counts.lores+' lore pages, '+next.counts.magicReferences+' guidance pages, '+
  next.counts.spells+' spells; '+next.counts.ambiguousNames+' ambiguous names.');
 return summary;
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 refreshMagicIndex().catch(error=>{console.error(error);process.exitCode=1;});
}

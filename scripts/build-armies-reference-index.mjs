/**
 * Index the two independently labeled sections of tow.whfb.app/sitemap/armies.
 *
 * Captures only same-origin army and unit page labels/URLs. Neither the
 * sitemap nor this index proves unit faction membership, army-list legality,
 * option availability, points or verified rules. No unit pages are crawled.
 */
import {readFile,writeFile} from 'node:fs/promises';

export const SOURCE_ORIGIN='https://tow.whfb.app';
export const SITEMAP_URL=SOURCE_ORIGIN+'/sitemap/armies';
const OUTPUT=new URL('../docs/reference-records/armies-index.json',import.meta.url);
const SUMMARY=new URL('../docs/reference-records/armies-summary.json',import.meta.url);
const MAX_BYTES=2_000_000;
const HEAD_ARMY='Army Index';
const HEAD_UNIT='Unit Index';

const decode=s=>String(s||'')
  .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)))
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo);/gi,x=>({
    '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
    '&ldquo;':'“','&rdquo;':'”','&lsquo;':'‘','&rsquo;':'’'
  })[x.toLowerCase()]||x);
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' '))
  .replace(/\s+/g,' ').trim();
export const normalizeArmyIndexName=name=>clean(name).normalize('NFKC').toLowerCase()
  .replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
function safePage(raw,kind){
  try{
    const u=new URL(decode(raw),SOURCE_ORIGIN);
    if(u.origin!==SOURCE_ORIGIN||u.search||u.hash)return null;
    const prefix=kind==='army'?'army':'unit';
    if(!new RegExp('^/'+prefix+'/[a-z0-9-]+/?$').test(u.pathname))return null;
    return SOURCE_ORIGIN+u.pathname.replace(/\/$/,'');
  }catch{return null;}
}
function headings(markup){
  return [...markup.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(m=>({name:clean(m[2]),start:m.index,end:m.index+m[0].length}));
}
function sectionLinks(markup,kind){
  const out=[];
  for(const m of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const match=m[1].match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if(!match)continue;
    const url=safePage(match[1]||match[2],kind);
    const name=clean(m[2]);
    if(!url||!name||name.length>180)continue;
    out.push({name,url});
  }
  return out;
}
export function parseArmiesSitemap(html){
  if(typeof html!=='string'||!html.trim()||html.length>MAX_BYTES)
    throw Error('Invalid or oversized armies sitemap');
  const markup=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const hs=headings(markup);
  const armyHead=hs.find(h=>h.name===HEAD_ARMY);
  const unitHead=hs.find(h=>h.name===HEAD_UNIT&&(!armyHead||h.start>armyHead.start));
  if(!armyHead||!unitHead)throw Error('Missing Army Index or Unit Index heading');
  const nextAfterUnit=hs.find(h=>h.start>unitHead.start);
  const mainEnd=markup.indexOf('</main>',unitHead.end);
  const possibleEnds=[nextAfterUnit?.start,mainEnd>=0?mainEnd:null]
    .filter(n=>Number.isInteger(n)&&n>=unitHead.end);
  const unitEnd=possibleEnds.length?Math.min(...possibleEnds):markup.length;
  const byUrl=new Map();
  for(const [kind,links] of [
    ['army',sectionLinks(markup.slice(armyHead.end,unitHead.start),'army')],
    ['unit',sectionLinks(markup.slice(unitHead.end,unitEnd),'unit')]
  ]){
    for(const {name,url} of links){
      const previous=byUrl.get(url);
      if(previous){
        if(previous.name!==name&&!previous.alternateNames.includes(name))
          previous.alternateNames.push(name);
        continue;
      }
      const path=new URL(url).pathname;
      byUrl.set(url,{
        id:'army-ref:'+path,name,url,path,kind,
        section:kind==='army'?HEAD_ARMY:HEAD_UNIT,
        verificationStatus:'source-indexed',alternateNames:[]
      });
    }
  }
  const entries=[...byUrl.values()];
  const totals={
    armies:entries.filter(e=>e.kind==='army').length,
    units:entries.filter(e=>e.kind==='unit').length,
    entries:entries.length
  };
  if(totals.armies<15||totals.armies>100||totals.units<500||totals.units>1500)
    throw Error('Unexpected armies sitemap size: '+JSON.stringify(totals));
  for(const [kind,name] of [
    ['army','High Elf Realms'],['army','Chaos Dwarfs'],['army','Grand Cathay'],
    ['unit','Ishaya Vess'],['unit','Korhil Lionmane'],
    ['unit','Daemonsmith Sorcerer'],['unit','White Lions of Chrace']
  ]){
    if(!entries.some(e=>e.kind===kind&&normalizeArmyIndexName(e.name)===normalizeArmyIndexName(name)))
      throw Error('Expected '+kind+' absent from sitemap: '+name);
  }
  const byName=new Map();
  for(const e of entries){
    for(const title of [e.name,...e.alternateNames]){
      const key=e.kind+':'+normalizeArmyIndexName(title);
      const urls=byName.get(key)||new Set();urls.add(e.url);byName.set(key,urls);
    }
  }
  const ambiguousNames=[...byName.entries()].filter(([,urls])=>urls.size>1)
    .map(([key,urls])=>({kind:key.split(':')[0],name:key.slice(key.indexOf(':')+1),
      sourceUrls:[...urls]}));
  return {entries,totals,ambiguousNames};
}
export function matchArmyIndexReference(name,kind,entries){
  // Exact unique label and type only. Do not infer a unit belongs to an army.
  if(kind!=='army'&&kind!=='unit')return null;
  const key=normalizeArmyIndexName(name);
  const matches=(entries||[]).filter(e=>e.kind===kind&&(
    normalizeArmyIndexName(e.name)===key||
    (e.alternateNames||[]).some(alias=>normalizeArmyIndexName(alias)===key)
  ));
  return matches.length===1?matches[0]:null;
}
export function assembleArmiesIndex(html,checkedAt){
  const {entries,totals,ambiguousNames}=parseArmiesSitemap(html);
  return {
    schemaVersion:1,collectionType:'source-reference-index',
    source:{origin:SOURCE_ORIGIN,url:SITEMAP_URL,checkedAt,
      verificationStatus:'source-indexed',sourceVersion:null,
      method:'single bounded public HTML sitemap fetch; army and unit titles/URLs only'},
    scope:'Army pages and unit pages in the public Armies sitemap; no implied unit-to-army membership',
    counts:{...totals,ambiguousNames:ambiguousNames.length},
    sections:[{name:HEAD_ARMY,count:totals.armies},{name:HEAD_UNIT,count:totals.units}],
    entries,ambiguousNames
  };
}
async function fetchHtml(url){
  const response=await fetch(url,{headers:{
    'User-Agent':'OldWorldGameManager-ArmyIndex/0.1 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'
  },signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Armies sitemap HTTP '+response.status);
  if(Number(response.headers.get('content-length')||0)>MAX_BYTES)
    throw Error('Sitemap exceeds size budget');
  const body=await response.text();
  if(body.length>MAX_BYTES)throw Error('Sitemap exceeds size budget');
  return body;
}
export async function refreshArmiesIndex({fetcher=fetchHtml,checkedAt=new Date().toISOString()}={}){
  const next=assembleArmiesIndex(await fetcher(SITEMAP_URL),checkedAt);
  let old=null;
  try{old=JSON.parse(await readFile(OUTPUT,'utf8'));}catch{}
  if(old?.counts?.armies&&next.counts.armies<old.counts.armies*0.9)
    throw Error('Army index shrank unexpectedly; keeping previous snapshot');
  if(old?.counts?.units&&next.counts.units<old.counts.units*0.9)
    throw Error('Unit index shrank unexpectedly; keeping previous snapshot');
  const summary={
    schemaVersion:1,collectionType:'source-reference-summary',
    sourceUrl:SITEMAP_URL,checkedAt,verificationStatus:'source-indexed',
    ...next.counts,sections:next.sections,
    sampleEntries:next.entries.filter(e=>[
      'High Elf Realms','Chaos Dwarfs','Grand Cathay',
      'Ishaya Vess','Korhil Lionmane','Daemonsmith Sorcerer','White Lions of Chrace'
    ].includes(e.name)).map(e=>({name:e.name,kind:e.kind,url:e.url}))
  };
  await writeFile(OUTPUT,JSON.stringify(next,null,2)+'\n');
  await writeFile(SUMMARY,JSON.stringify(summary,null,2)+'\n');
  console.log('Armies sitemap indexed '+next.counts.entries+' unique URLs: '+
    next.counts.armies+' army pages, '+next.counts.units+' unit pages; '+
    next.counts.ambiguousNames+' ambiguous names.');
  return summary;
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
  refreshArmiesIndex().catch(error=>{console.error(error);process.exitCode=1;});
}

/**
 * Public HTML -> small static fallback index for source model names.
 *
 * This is a controlled, low-volume importer run from GitHub Actions because
 * some tow.whfb.app pages do not return browser CORS headers.
 *
 * It uses actual imported example unit names, never hardcodes faction units.
 * Only unit/model names and provenance are retained; rules text and points
 * are not mirrored. Missing pages retain their last successful snapshot.
 */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {parseArmy} from '../docs/parser.js';
import {findIndexedReference} from '../docs/live-source.js';
import {extractWizardMagic} from './extract-wizard-magic.mjs';

const ORIGIN='https://tow.whfb.app';
const OUTPUT=new URL('../docs/source-profiles.json',import.meta.url);
const EXAMPLES=new URL('../docs/examples/',import.meta.url);
const MAGIC_INDEX=new URL('../docs/reference-records/magic-index.json',import.meta.url);
const MAX_PER_RUN=35;
const MAX_BYTES=2_000_000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const decodeHtml=s=>String(s||'')
 .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,h,n)=>String.fromCodePoint(parseInt(h||n,h?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi,x=>({
 '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[x.toLowerCase()]||x);
const clean=s=>normalized(decodeHtml(String(s||'').replace(/<[^>]*>/g,' ')));
function safeUrl(href){
 try{
  const u=new URL(decodeHtml(href),ORIGIN);
  return u.origin===ORIGIN&&/^\/unit\/[a-z0-9-]+\/?$/.test(u.pathname)
   &&!u.search&&!u.hash?u.href:null;
 }catch{return null;}
}
async function fetchHtml(url){
 const response=await fetch(url,{headers:{'User-Agent':'OldWorldGameManager/0.2 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'},
  signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const len=Number(response.headers.get('content-length')||0);
 if(len>MAX_BYTES)throw Error('Page too large');
 const html=await response.text();
 if(html.length>MAX_BYTES)throw Error('Page too large');
 return html;
}
function sitemapEntries(html){
 const entries=[],seen=new Set();
 // Only unit hrefs from the public armies sitemap are considered.
 for(const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const url=safeUrl(match[1]),name=clean(match[2]);
  if(!url||!name||seen.has(url)||name.length>120)continue;
  entries.push({name,url,kind:'unit'});seen.add(url);
 }
 if(!entries.length)throw Error('The public armies sitemap contained no unit links');
 return entries;
}
export function parseModelNames(html){
 const table=html.match(/<table\b[^>]*class=["'][^"']*\bunit-profile-table\b[^"']*["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
 if(!table)return [];
 const rows=table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 const names=[];
 for(const row of rows){
  const td=row.match(/<td\b[^>]*>[\s\S]*?<\/td>/i)?.[0];
  if(!td)continue;
  const name=clean(td);
  if(!name||name.length>125||names.includes(name))continue;
  names.push(name);
 }
 return names;
}
async function existingSnapshot(){
 try{
  const o=JSON.parse(await readFile(OUTPUT,'utf8'));
  return o?.profiles&&typeof o.profiles==='object'?o.profiles:{};
 }catch{return {};}
}
async function main(){
 const files=(await readdir(EXAMPLES)).filter(n=>n.endsWith('.txt')).sort();
 const frequencies=new Map(),fallback=new Map();
 for(const name of files){
  const army=parseArmy(await readFile(new URL(name,EXAMPLES),'utf8'));
  for(const u of army.units){
   frequencies.set(u.name,(frequencies.get(u.name)||0)+1);
   if(u.reference?.url){
    const url=safeUrl(u.reference.url);
    if(url)fallback.set(u.name,url);
   }
  }
 }
 const entries=sitemapEntries(await fetchHtml(ORIGIN+'/sitemap/armies'));
 const jobs=[],seen=new Set();
 for(const [name,frequency] of frequencies.entries()){
  const entry=findIndexedReference(name,true,entries);
  const url=safeUrl(entry?.url||fallback.get(name));
  if(!url||seen.has(url))continue;
  seen.add(url);
  jobs.push({name,url,frequency});
 }
 // Audit-driven source coverage: prioritize every unit whose pinned source
 // record specifically flagged wizardLevel / magicLore, not one army's examples.
 // Run oldest-checked source pages first so a 35-page batch advances coverage.
 const previous=await existingSnapshot();
 const shardDir=new URL('../docs/unit-data/shards/',import.meta.url);
 const shardNames=(await readdir(shardDir)).filter(n=>n.endsWith('.json')&&n.length===7);
 for(const filename of shardNames){
  const shard=JSON.parse(await readFile(new URL(filename,shardDir),'utf8'));
  for(const record of Object.values(shard.records||{})){
   if(!(record.extractionWarnings||[]).some(w=>/wizardLevel|magicLore/.test(w)))continue;
   const url=safeUrl(record.source?.sourceUrl);
   if(!url)continue;
   if(!seen.has(url)){
    jobs.push({name:record.name,url,frequency:0,wizardReview:true});seen.add(url);
   }else{
    const existing=jobs.find(j=>j.url===url);
    if(existing)existing.wizardReview=true;
   }
  }
 }
 jobs.sort((a,b)=>Number(!!b.wizardReview)-Number(!!a.wizardReview)||
  (a.wizardReview?String(previous[a.url]?.sourceCheckedAt||'')
   .localeCompare(String(previous[b.url]?.sourceCheckedAt||'')):b.frequency-a.frequency)||
   a.url.localeCompare(b.url));
 const magicIndex=JSON.parse(await readFile(MAGIC_INDEX,'utf8'));
 if(magicIndex?.source?.url!=='https://tow.whfb.app/sitemap/magic'||!Array.isArray(magicIndex.entries))
  throw Error('Trusted source magic index unavailable');
 const selected=jobs.slice(0,MAX_PER_RUN);
 const checkedAt=new Date().toISOString();
 let updated=0,failed=0;
 for(const [i,job] of selected.entries()){
  try{
   const html=await fetchHtml(job.url);
   const names=parseModelNames(html);
   if(!names.length)throw Error('No model names found in profile table');
   const wizardMagic=extractWizardMagic(html,job.url,magicIndex);
   previous[job.url]={
    url:job.url,source:'tow.whfb.app',schemaVersion:2,sourceCheckedAt:checkedAt,
    verificationStatus:'source-extracted',models:names.map(name=>({name})),
    wizardLevels:previous[job.url]?.wizardLevels||[],
    ...(wizardMagic?{wizardMagic}: {})
   };
   updated++;
   console.log((i+1)+'/'+selected.length+' '+job.url+' → '+names.length+' models');
  }catch(error){
   failed++;
   console.warn((i+1)+'/'+selected.length+' '+job.url+': '+(error?.message||error));
  }
  // Keep requests serial and polite; no background crawling or API endpoints.
  await sleep(350);
 }
 const sorted=Object.fromEntries(Object.entries(previous).sort(([a],[b])=>a.localeCompare(b)));
 const data={schemaVersion:2,sourceOrigin:ORIGIN,generatedAt:checkedAt,
  note:'Model names and explicit wizard facts only, from permitted public unit pages. No army legality inferred.',
  profiles:sorted};
 await writeFile(OUTPUT,JSON.stringify(data,null,2)+'\n');
 console.log('Discovered '+jobs.length+' unit URLs from '+files.length+' example lists; checked '+selected.length+
  ', refreshed '+updated+', failures '+failed+', available profiles '+Object.keys(sorted).length);
 if(!updated&&!Object.keys(sorted).length)throw Error('No verified unit data could be retrieved');
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 main().catch(error=>{console.error(error);process.exitCode=1;});
}

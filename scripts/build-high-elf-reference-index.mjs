/**
 * Build the High Elf Realms unit-reference index exclusively from tow.whfb.app.
 *
 * An index link proves that a unit page exists; it does not verify its army
 * legality, optional upgrades or all linked rules. Existing manually reviewed
 * records (Ishaya and Korhil) are preserved byte-for-byte.
 *
 * Run deliberately (weekly/manual GitHub Action), with conservative limits.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';

const ORIGIN='https://tow.whfb.app';
const ARMY_PAGE=ORIGIN+'/army/high-elf-realms';
const ROOT=new URL('../docs/reference-records/',import.meta.url);
const MANIFEST=new URL('manifest.json',ROOT);
const UNIT_DIR=new URL('high-elf-realms/',ROOT);
const COLUMNS=['M','WS','BS','S','T','W','I','A','Ld'];
const MAX_BYTES=2_000_000;
const DELAY_MS=650;
const SOURCE_GROUPS=[
 ['Named Character Units',['Ishaya Vess','Korhil Lionmane']],
 ['Character Units',['Archmage','Chracian Chieftain','Dragon Mage','Handmaiden of the Everqueen','Mage','Noble','Prince','Sea Guard Garrison Commander','Storm Weaver']],
 ['Mount Units',['Barded Elven Steed','Elven Steed','Flamespyre Phoenix (Mount)','Frostheart Phoenix (Mount)','Great Eagle (Mount)','Unicorn']],
 ['Infantry Units',['Chracian Woodsmen','Elven Archers','Elven Spearmen','Lion Guard','Lothern Sea Guard','Phoenix Guard','Shadow Warriors',"Ship's Company",'Sisters of Avelorn','Swordmasters of Hoeth','White Lions of Chrace']],
 ['Cavalry Units',['Dragon Princes','Ellyrian Reavers','Silver Helms','War Lions']],
 ['Chariot Units',["Chieftain's Chariot",'Lion Chariot of Chrace','Lothern Skycutter','Tiranoc Chariot']],
 ['Monster Units',['Flamespyre Phoenix','Frostheart Phoenix','Great Eagle','Griffon (High Elves)','Merwyrm','Moon Dragon','Star Dragon','Sun Dragon']],
 ['War Machine Units',['Eagle-Claw Bolt Thrower']]
];
export const HIGH_ELF_INDEX_NAMES=SOURCE_GROUPS.flatMap(([category,names])=>names.map(name=>({category,name})));

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const decode=s=>String(s||'')
  .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)))
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi,x=>({
    '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[x.toLowerCase()]||x);
const clean=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const normal=s=>clean(s).normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'");
const noScripts=html=>String(html).replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<head\b[^>]*>[\s\S]*?<\/head>/i,' ');
function safeUrl(raw){
 try {
  const u=new URL(decode(raw),ORIGIN);
  if(u.origin!==ORIGIN || !/^\/(?:unit|special-rules|weapons-of-war|magic-item|the-lores-of-magic|magic|command-groups|war-machines)\/[a-z0-9-]+\/?$/.test(u.pathname)
     ||u.search||u.hash)return null;
  return u.href;
 } catch {return null;}
}
function links(html){
 const entries=[];
 for(const m of String(html).matchAll(/<a\b[^>]*?\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  const url=safeUrl(m[2]),name=clean(m[3]);
  if(url&&name&&name.length<140)entries.push({name,url});
 }
 return entries;
}
export function resolveIndexUrls(html, sourceGroups=HIGH_ELF_INDEX_NAMES){
 const found=links(noScripts(html)).filter(e=>new URL(e.url).pathname.startsWith('/unit/'));
 const results=[];
 for(const item of sourceGroups){
  const matches=[...new Set(found.filter(e=>normal(e.name)===normal(item.name)).map(e=>e.url))];
  if(matches.length!==1)throw Error('Could not uniquely resolve index unit '+item.name+' (matches '+matches.length+')');
  results.push({...item,url:matches[0]});
 }
 if(new Set(results.map(x=>x.url)).size!==results.length)throw Error('Distinct index units share a page URL');
 return results;
}
export function parsePageProfile(html){
 const table=noScripts(html).match(/<table\b[^>]*class=["'][^"']*\bunit-profile-table\b[^"']*["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
 if(!table)return [];
 const rows=[];
 for(const row of table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]){
  const cells=(row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi)||[]).map(clean);
  if(cells.length!==10||!cells[0]||cells[0].length>125)continue;
  const characteristics=Object.fromEntries(COLUMNS.map((key,i)=>{
    const raw=cells[i+1];
    return [key,/^\d+$/.test(raw)?Number(raw):raw=== '-'?null:raw];
  }));
  rows.push({name:cells[0],characteristics});
 }
 return rows;
}
function valueBetween(text,label,next){
 const start=text.indexOf(label);
 if(start<0)return null;
 const remainder=text.slice(start+label.length);
 const end=next.map(x=>remainder.indexOf(x)).filter(n=>n>=0);
 const part=remainder.slice(0,end.length?Math.min(...end):75).trim();
 return part.slice(0,90)||null;
}
export function parseUnitPage(html){
 const visible=clean(noScripts(html));
 const rows=parsePageProfile(html);
 const cost=visible.match(/\bCost:\s*(\+?\d[\d,]*)\s*points?(?:\s+per\s+model)?/i);
 const costText=cost?.[0]?.slice(5).trim()||null;
 const sourceLinks=links(noScripts(html))
  .filter(x=>!new URL(x.url).pathname.startsWith('/unit/') || x.name.length<130);
 const unique=[...new Map(sourceLinks.map(x=>[x.url+'|'+normal(x.name),x])).values()]
  .filter(x=>x.name.length<=125).map(x=>({...x,
   kind:new URL(x.url).pathname.split('/')[1]}));
 return {
  modelProfiles:rows,
  costDescription:costText,
  unitCategory:valueBetween(visible,'Unit Category:',['Troop Type:','Base Size:']),
  troopTypeDescription:valueBetween(visible,'Troop Type:',['Base Size:','Unit Size:']),
  baseSizeDescription:valueBetween(visible,'Base Size:',['Unit Size:']),
  unitSizeDescription:valueBetween(visible,'Unit Size:',['Cost:','May be','May take']),
  // Merely mentioned by page: no claim that a linked option is purchased,
  // a rule is innate, or another character is entitled to the same upgrade.
  pageLinkedReferences:unique
 };
}
async function fetchHtml(url) {
 const response=await fetch(url,{
  headers:{'User-Agent':'OldWorldGameManager-HighElfIndex/0.1 (+https://github.com/AnthonyWCurtis/old-world-game-manager)'},
  signal:AbortSignal.timeout(25000)
 });
 if(!response.ok)throw Error('HTTP '+response.status);
 const len=Number(response.headers.get('content-length')||0);
 if(len>MAX_BYTES)throw Error('Oversized page');
 const html=await response.text();
 if(html.length>MAX_BYTES)throw Error('Oversized page');
 return html;
}
export async function refreshHighElfIndex({fetcher=fetchHtml,date=new Date().toISOString(),write=true}={}){
 const html=await fetcher(ARMY_PAGE);
 const entries=resolveIndexUrls(html);
 if(entries.length!==45)throw Error('Expected 45 indexed units, got '+entries.length);
 const manifest=JSON.parse(await readFile(MANIFEST,'utf8'));
 const original=new Map(manifest.records.map(e=>[e.sourceUrl,e]));
 await mkdir(UNIT_DIR,{recursive:true});
 const generated=[];
 for(const [index,entry] of entries.entries()){
  const pathname=new URL(entry.url).pathname,slug=pathname.split('/').filter(Boolean).at(-1);
  const existing=original.get(entry.url);
  if(existing?.verificationStatus==='verified-on-tow'){
   generated.push({...existing,sourceCategory:entry.category});
   console.log((index+1)+'/45 reviewed '+entry.name+' (preserved)');
   continue;
  }
  const fileName=slug+'.json';
  const fileUrl=new URL(fileName,UNIT_DIR);
  let prev=null;
  try{prev=JSON.parse(await readFile(fileUrl,'utf8'));}catch{}
  let verificationStatus='source-indexed',page=null,error=null;
  try{
   const detail=await fetcher(entry.url);
   page=parseUnitPage(detail);
   if(page.modelProfiles.length || page.costDescription)verificationStatus='source-extracted';
   else error='Unit page parsed but no profile/cost fields found';
  }catch(e){error=String(e?.message||e);}
  if(verificationStatus==='source-indexed'&&prev?.source?.verificationStatus==='source-extracted'){
   console.warn('Keeping earlier extracted record: '+entry.name+' ('+error+')');
   generated.push(original.get(entry.url)||{
    id:'unit:'+slug,name:entry.name,faction:'High Elf Realms',
    path:'high-elf-realms/'+fileName,sourceUrl:entry.url,
    verificationStatus:'source-extracted',sourceCategory:entry.category,
    sourceCheckedAt:prev.source.checkedAt
   });
   continue;
  }
  const record={
   schemaVersion:1,recordType:'unit',id:'unit:'+slug,
   source:{origin:ORIGIN,url:entry.url,armyIndexUrl:ARMY_PAGE,
    verificationStatus,checkedAt:date,sourceVersion:null,
    method:'automated, limited public HTML extraction'},
   name:entry.name,faction:'High Elf Realms',sourceCategory:entry.category,
   // This field is a source index category; it is NOT an army list allowance.
   ...(page||{modelProfiles:[],costDescription:null,unitCategory:null,
    troopTypeDescription:null,baseSizeDescription:null,unitSizeDescription:null,
    pageLinkedReferences:[]}),
   ...(error?{extractionWarning:error}:{}),
   legalityVerified:false,engineImplemented:false
  };
  if(write)await writeFile(fileUrl,JSON.stringify(record,null,2)+'\n');
  generated.push({id:record.id,name:record.name,faction:record.faction,
   path:'high-elf-realms/'+fileName,sourceUrl:entry.url,
   verificationStatus,sourceCategory:entry.category,sourceCheckedAt:date});
  console.log((index+1)+'/45 '+entry.name+' '+verificationStatus+
    ' profiles='+record.modelProfiles.length+' links='+record.pageLinkedReferences.length+
    (error?' WARNING='+error:''));
  if(index<entries.length-1)await sleep(DELAY_MS);
 }
 const updated={...manifest,records:generated};
 if(write)await writeFile(MANIFEST,JSON.stringify(updated,null,2)+'\n');
 console.log('High Elf Realms index: '+generated.length+' units, '+
   generated.filter(e=>e.verificationStatus==='verified-on-tow').length+' manually reviewed, '+
   generated.filter(e=>e.verificationStatus==='source-extracted').length+' page extracted, '+
   generated.filter(e=>e.verificationStatus==='source-indexed').length+' index-only');
 return updated;
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 refreshHighElfIndex().catch(error=>{console.error(error);process.exitCode=1;});
}

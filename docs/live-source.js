/**
 * Cache-first, source-indexed reference discovery.
 * Reads permitted public HTML only: no /api/ or other robots-excluded endpoints.
 * Sitemap links are references, NOT proof of army legality or verified rules.
 * Only URL/name metadata and page fingerprints are stored locally, not rules text.
 */
export const SOURCE_ORIGIN = 'https://tow.whfb.app';
export const INDEX_SOURCES = [
  {path:'/sitemap/armies', type:'unit'},
  {path:'/sitemap/magic-items', type:'item'},
  {path:'/sitemap/magic', type:'magic'},
  {path:'/sitemap/rules', type:'rules'}
];
const MAX_AGE = 6*60*60*1000;
const PAGE_AGE = 24*60*60*1000;
const DB_NAME='old-world-manager-source-cache';
const STORE='records';
const fallback = new Map();
const allowedPaths = /^\/(?:unit\/|magic-item\/|weapons-of-war\/|special-rules\/|the-lores-of-magic\/|spell\/|command-groups(?:\/|$)|war-machines\/|magic\/|characters\/)/i;

function cacheDB(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined') return reject(Error('IndexedDB unavailable'));
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('Source cache could not be opened'));
  });
}
async function cacheGet(key){
  try{
    const db=await cacheDB();
    try{return await new Promise((resolve,reject)=>{
      const q=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
      q.onsuccess=()=>resolve(q.result||null);
      q.onerror=()=>reject(q.error);
    });}finally{db.close();}
  }catch{return fallback.get(key)||null;}
}
async function cachePut(value){
  fallback.set(value.key,value);
  try{
    const db=await cacheDB();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),req=tx.objectStore(STORE).put(value);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||Error('Cache write failed'));
      req.onerror=()=>reject(req.error||Error('Cache write failed'));
    });}finally{db.close();}
  }catch{/* Safari Private Browsing may be transient; fallback still works. */}
}
function sourceUrl(url) {
  try {
    const u=new URL(url,SOURCE_ORIGIN);
    return u.origin===SOURCE_ORIGIN && allowedPaths.test(u.pathname) && !u.search && !u.hash ? u.href : null;
  } catch{return null;}
}
function normal(s) {
  return String(s||'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'")
    .replace(/\s+/g,' ').trim();
}
function aliases(name) {
  const n=normal(name).replace(/^\d+\s*[×x]\s+/i,'');
  // Only a final plural -s is stripped, and only after an exact match fails.
  const singular=n.endsWith('s')&&!n.endsWith('ss')?n.slice(0,-1):null;
  return singular&&singular!==n?[n,singular]:[n];
}
export function parseIndexHtml(html,source) {
  if(typeof DOMParser==='undefined') throw Error('HTML parser unavailable in this browser');
  const doc=new DOMParser().parseFromString(html,'text/html');
  const entries=[];
  const seen=new Set();
  for(const link of doc.querySelectorAll('a[href]')){
    const url=sourceUrl(link.getAttribute('href'));
    if(!url)continue;
    const pathname=new URL(url).pathname;
    const kind=pathname.startsWith('/unit/')?'unit':
      pathname.startsWith('/magic-item/')?'item':
      pathname.startsWith('/spell/')?'spell':
      pathname.startsWith('/the-lores-of-magic/')?'lore':'rule';
    if(source.type==='unit'&&kind!=='unit')continue;
    if(source.type==='item'&&kind!=='item')continue;
    if(source.type==='magic'&&kind!=='spell'&&kind!=='lore')continue;
    if(source.type==='rules'&&kind!=='rule')continue;
    const name=(link.textContent||'').replace(/\s+/g,' ').trim();
    if(!name || name.length>130 || seen.has(url))continue;
    seen.add(url);
    entries.push({name,url,kind});
  }
  if(!entries.length)throw Error('No usable source links found in '+source.path);
  return entries;
}
async function fetchHTML(path,timeout=15000) {
  const target=sourceUrl(path) || (INDEX_SOURCES.some(s=>s.path===path)?SOURCE_ORIGIN+path:null);
  if(!target) throw Error('Source path not permitted');
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(target,{method:'GET',mode:'cors',credentials:'omit',cache:'no-cache',signal:c.signal});
    if(!r.ok)throw Error('HTTP '+r.status+' from '+new URL(target).pathname);
    if(!(r.headers.get('content-type')||'').includes('text/html'))throw Error('Unexpected response content type');
    return await r.text();
  }finally{clearTimeout(timer);}
}
export async function loadCachedIndexes() {
  const found=await Promise.all(INDEX_SOURCES.map(async s=>await cacheGet('index:'+s.path)));
  return {
    entries:found.flatMap(r=>r?.entries||[]),
    latestCheck:found.filter(Boolean).map(r=>r.checkedAt).sort((a,b)=>b-a)[0]||null,
    indexCount:found.filter(Boolean).length
  };
}
export async function refreshIndexes({force=false}={}) {
  const results=await Promise.all(INDEX_SOURCES.map(async source=>{
    const key='index:'+source.path;
    const prior=await cacheGet(key);
    if(!force&&prior?.checkedAt&&Date.now()-prior.checkedAt<MAX_AGE)
      return {record:prior,network:false};
    try{
      const html=await fetchHTML(source.path);
      const entries=parseIndexHtml(html,source);
      const record={key,entries,checkedAt:Date.now(),sourceUrl:SOURCE_ORIGIN+source.path};
      await cachePut(record);
      return {record,network:true};
    }catch(error){
      return {record:prior||null,network:false,error:String(error?.message||error)};
    }
  }));
  return {
    entries:results.flatMap(r=>r.record?.entries||[]),
    networkCount:results.filter(r=>r.network).length,
    indexCount:results.filter(r=>r.record).length,
    errors:results.filter(r=>r.error).map(r=>r.error),
    lastChecked:Math.max(0,...results.map(r=>r.record?.checkedAt||0))||null
  };
}

export function findIndexedReference(name,isUnit,entries) {
  if(!entries?.length)return null;
  // No fuzzy substring or invented source URLs. A unique exact name is required,
  // with at most a safe final -s plural adjustment or copied quantity prefix.
  for(const key of aliases(name)){
    const relevant=entries.filter(e=>(isUnit?e.kind==='unit':true)&&normal(e.name)===key);
    const unique=new Map(relevant.map(e=>[e.url,e]));
    if(unique.size===1){
      const r=[...unique.values()][0];
      return {id:'indexed:'+new URL(r.url).pathname, url:r.url, type:r.kind,
        source:'live-index', name:r.name};
    }
    if(unique.size>1)return null; // ambiguous -> never guess
  }
  // Battle Builder prefixes the generic Waaagh! Magic lore with "Lore of".
  // Match only a unique lore title when an exact match was not found.
  const normalized=normal(name);
  if(!isUnit&&normalized.startsWith('lore of ')){
    const nameWithoutPrefix=normalized.slice('lore of '.length);
    const lores=new Map(entries.filter(e=>e.kind==='lore'&&normal(e.name)===nameWithoutPrefix).map(e=>[e.url,e]));
    if(lores.size===1){
      const r=[...lores.values()][0];
      return {id:'indexed:'+new URL(r.url).pathname,url:r.url,type:r.kind,
        source:'live-index',name:r.name};
    }
  }
  return null;
}
const walk=items=>items.flatMap(x=>[x,...walk(x.children||[])]);
export function applyIndexedReferences(army, entries){
  if(!entries?.length || !army?.units)return {added:0};
  let added=0;
  for(const u of army.units){
    if(!u.reference || u.reference.source==='live-index'){
      const ref=findIndexedReference(u.name,true,entries);
      if(ref){
        if(u.matchStatus!=='matched')added++;
        u.reference=ref;u.matchStatus='matched';
      } else if(u.reference?.source==='live-index'){
        u.reference=null;u.matchStatus='unmatched';
      }
    }
    const selections=walk(u.selections||[]).concat((u.modelGroups||[]).flatMap(g=>walk(g.selections||[])));
    for(const s of selections){
      if(s.reference && s.reference.source!=='live-index')continue;
      const ref=findIndexedReference(s.name,false,entries);
      if(ref){
        if(s.matchStatus!=='matched')added++;
        s.reference=ref;s.matchStatus='matched';
      }else if(s.reference?.source==='live-index'){
        s.reference=null;s.matchStatus='unmatched';
      }
    }
  }
  const units=army.units, selections=units.flatMap(u=>
    walk(u.selections||[]).concat((u.modelGroups||[]).flatMap(g=>walk(g.selections||[]))));
  army.stats.matchedUnits=units.filter(u=>u.matchStatus==='matched').length;
  army.stats.unmatchedUnits=units.length-army.stats.matchedUnits;
  army.stats.matchedSelections=selections.filter(s=>s.matchStatus==='matched').length;
  army.stats.unmatchedSelections=selections.length-army.stats.matchedSelections;
  return {added};
}
/**
 * Extract only explicitly structured unit details; never infer army-specific upgrades
 * or treat source base cost as the cost of the imported unit configuration.
 */
export function parseUnitProfile(html,url) {
  if(!new URL(url).pathname.startsWith('/unit/'))return null;
  if(typeof DOMParser==='undefined')throw Error('HTML parser unavailable');
  const doc=new DOMParser().parseFromString(html,'text/html');
  const main=doc.querySelector('main');
  const title=(main?.querySelector('h1')?.textContent||'').replace(/\s+/g,' ').trim();
  if(!title)return null;
  const tables=[...doc.querySelectorAll('table.unit-profile-table')];
  const models=[];
  const labels=['M','WS','BS','S','T','W','I','A','Ld'];
  for(const table of tables){
    const heads=[...table.querySelectorAll('thead th')].map(x=>(x.textContent||'').trim());
    if(!labels.every(label=>heads.includes(label)))continue;
    for(const tr of table.querySelectorAll('tbody tr')){
      const cells=[...tr.querySelectorAll('td')].map(x=>(x.textContent||'').replace(/\s+/g,' ').trim());
      if(cells.length!==heads.length)continue;
      const characteristics={};
      for(const key of labels)characteristics[key]=cells[heads.indexOf(key)];
      const name=cells[0];
      if(name&&Object.values(characteristics).some(Boolean))models.push({name,characteristics});
    }
  }
  const costText=main?.querySelector('.unit-profile__details--points')?.textContent||'';
  const baseCostMatch=costText.match(/\bCost:\s*(\d[\d,]*)\s*points?\b/i);
  const category=main?.querySelector('.unit-profile__details--unit-category')?.textContent?.replace(/^Unit Category:\s*/i,'').trim()||null;
  const troopType=main?.querySelector('.unit-profile__details--troop-type')?.textContent?.replace(/^Troop Type:\s*/i,'').trim()||null;
  return {title,url,models,baseCost:baseCostMatch?Number(baseCostMatch[1].replace(/,/g,'')):null,
    category,troopType};
}
export async function getCachedUnitProfiles(army){
  const urls=[...new Set((army.units||[]).map(u=>u.reference?.url).filter(Boolean))];
  const pairs=await Promise.all(urls.map(async url=>[url,(await cacheGet('page:'+url))?.profile||null]));
  return Object.fromEntries(pairs.filter(([url,profile])=>!!profile));
}
async function pageFingerprint(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const base=doc.querySelector('main')||doc.body;
  if(!base)return null;
  const clone=base.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,footer,nav,button').forEach(n=>n.remove());
  const text=(clone.textContent||'').replace(/\s+/g,' ').trim();
  if(text.length<35)return null;
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function checkPageChanges(army,{force=false,maxPages=12}={}){
  const refs=[];
  for(const u of army.units||[])if(u.reference?.url)refs.push(u.reference.url);
  for(const u of army.units||[])
    for(const s of walk(u.selections||[])){
      if(s.reference?.url)refs.push(s.reference.url);
    }
  const unique=[...new Set(refs.map(sourceUrl).filter(Boolean))];
  const records=await Promise.all(unique.map(async url=>({url,previous:await cacheGet('page:'+url)})));
  const due=records.filter(r=>force||!r.previous?.checkedAt||Date.now()-r.previous.checkedAt>=PAGE_AGE);
  let checked=0,changed=[],errors=[];
  // Serial, low-volume checks to respect the source site's resources.
  for(const {url,previous} of due.slice(0,maxPages)){
    try{
      const html=await fetchHTML(url,12000);
      const hash=await pageFingerprint(html);
      if(!hash)throw Error('Could not derive a stable page fingerprint');
      const isChanged=!!previous?.fingerprint&&previous.fingerprint!==hash;
      if(isChanged)changed.push(url);
      const profile=new URL(url).pathname.startsWith('/unit/')?parseUnitProfile(html,url):null;
      await cachePut({key:'page:'+url,url,fingerprint:hash,checkedAt:Date.now(),
        lastChanged:isChanged?Date.now():previous?.lastChanged||null,
        profile:profile||previous?.profile||null});
      checked++;
    }catch(error){errors.push(new URL(url).pathname+': '+(error?.message||error));}
  }
  return {checked,changed,errors,total:unique.length,pending:Math.max(0,due.length-maxPages)};
}

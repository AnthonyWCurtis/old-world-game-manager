/**
 * Offline-friendly, read-only reference to the independently source-extracted
 * unit JSON snapshot. Never treats a unit or option source link as legality.
 *
 * The small index loads once; only 32 deterministic JSON shards are possible,
 * and only shards containing units in the imported roster are requested.
 */
export const DATA_INDEX_URL='./unit-data/index.json';
export const UNIT_DATA_SOURCE='https://tow.whfb.app';
const DB_NAME='old-world-unit-reference-cache';
const STORE='snapshot';
const memory=new Map(),pending=new Map();
let indexPromise=null;

export function normalizeUnitLabel(value){
 return String(value||'').normalize('NFKC').toLowerCase()
  .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
}
function sourceUnitUrl(value){
 try{
  const u=new URL(value);
  if(u.origin!==UNIT_DATA_SOURCE||u.search||u.hash||
     !/^\/unit\/[a-z0-9-]+\/?$/.test(u.pathname))return null;
  return UNIT_DATA_SOURCE+u.pathname.replace(/\/$/,'');
 }catch{return null;}
}
function safeIndex(index){
 if(index?.schemaVersion!==1||index?.kind!=='game-manager-unit-data'||
    index?.counts?.units!==581||index?.counts?.armies!==19||
    index?.shards!==32||!/^[0-9a-f]{40}$/.test(index?.source?.commit||'')||
    !Array.isArray(index.entries)||index.entries.length!==581)
  throw Error('Incomplete or unexpected unit data index');
 const ids=new Set(),urls=new Set();
 for(const e of index.entries){
  if(!/^unit:[a-z0-9-]+$/.test(e.id)||
     !/^[0-9a-f]{2}$/.test(e.shard)||Number.parseInt(e.shard,16)>=32||
     !sourceUnitUrl(e.sourceUrl)||e.id!=='unit:'+new URL(e.sourceUrl).pathname.split('/')[2]||
     !String(e.name||'').trim()||ids.has(e.id)||urls.has(e.sourceUrl))
   throw Error('Invalid unit data index entry');
  ids.add(e.id);urls.add(e.sourceUrl);
 }
 return index;
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined')return reject(Error('No IndexedDB'));
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))
   req.result.createObjectStore(STORE,{keyPath:'key'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Cannot open cache'));
 });
}
async function cacheGet(key){
 if(memory.has(key))return memory.get(key);
 try{
  const db=await openDB();
  try{
   const row=await new Promise((resolve,reject)=>{
    const q=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
    q.onsuccess=()=>resolve(q.result);
    q.onerror=()=>reject(q.error);
   });
   if(row){memory.set(key,row.value);return row.value;}
  }finally{db.close();}
 }catch{/* Storage unavailable in Private Browsing; use transient memory. */}
 return null;
}
async function cachePut(key,value){
 memory.set(key,value);
 try{
  const db=await openDB();
  try{await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite'),req=tx.objectStore(STORE).put({key,value});
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
   req.onerror=()=>reject(req.error);
  });}finally{db.close();}
 }catch{/* Best-effort persistent offline cache. */}
}
async function getJson(url,fetcher){
 const r=await fetcher(url,{credentials:'omit',cache:'no-cache'});
 if(!r.ok)throw Error('Reference data unavailable (HTTP '+r.status+')');
 return await r.json();
}
/** Read the versioned manifest, falling back to a previously visited offline copy. */
export async function loadUnitDataIndex({fetcher=fetch,force=false}={}){
 if(!force&&indexPromise)return indexPromise;
 const task=(async()=>{
  const cached=await cacheGet('index');
  try{
   const index=safeIndex(await getJson(DATA_INDEX_URL,fetcher));
   await cachePut('index',index);
   return index;
  }catch(error){
   if(cached){
    try{return safeIndex(cached);}catch{/* Bad cache rejected. */}
   }
   throw error;
  }
 })();
 indexPromise=task;
 try{return await task;}
 catch(e){if(indexPromise===task)indexPromise=null;throw e;}
}
export function findIndexedUnit(unit,index){
 if(!unit||!index?.entries)return null;
 // Existing reviewed reference URLs are authoritative. Never replace them
 // with a different unit solely on a similar-sounding name.
 if(unit.reference?.url){
  const url=sourceUnitUrl(unit.reference.url);
  return url?index.entries.find(e=>e.sourceUrl===url)||null:null;
 }
 // Unique *exact* canonical name only: no loose pluralization/fuzzy matching.
 const key=normalizeUnitLabel(unit.name);
 const matches=index.entries.filter(e=>normalizeUnitLabel(e.name)===key);
 return matches.length===1?matches[0]:null;
}
export function applyUnitDataReferences(army,index){
 if(!army?.units||!index?.entries)return {added:0};
 let added=0;
 for(const unit of army.units){
  if(unit.reference&&unit.reference.source!=='published-unit-data')continue;
  const match=findIndexedUnit(unit,index);
  if(match){
   if(unit.matchStatus!=='matched')added++;
   unit.reference={
    id:match.id,name:match.name,url:match.sourceUrl,type:'unit',
    source:'published-unit-data',verificationStatus:'source-extracted'
   };
   unit.matchStatus='matched';
  }else if(unit.reference?.source==='published-unit-data'){
   unit.reference=null;unit.matchStatus='unmatched';
  }
 }
 army.stats.matchedUnits=army.units.filter(u=>u.matchStatus==='matched').length;
 army.stats.unmatchedUnits=army.units.length-army.stats.matchedUnits;
 return {added};
}
function validShard(shard,index,shardId){
 if(shard?.schemaVersion!==1||shard?.sourceCommit!==index.source.commit||
    shard?.shard!==shardId||!shard?.records||typeof shard.records!=='object')
  throw Error('Invalid unit data shard '+shardId);
 return shard;
}
async function getShard(index,id,fetcher){
 const key='shard:'+index.source.commit+':'+id;
 const hit=await cacheGet(key);
 // A version-pinned shard is immutable, so a valid local copy can be reused
 // immediately on later imports, including after going offline.
 if(hit){
  try{return validShard(hit,index,id);}catch{/* Corrupt cache ignored. */}
 }
 if(pending.has(key))return await pending.get(key);
 const task=(async()=>{
  try{
   const fresh=validShard(await getJson('./unit-data/shards/'+id+'.json',fetcher),index,id);
   await cachePut(key,fresh);
   return fresh;
  }catch(e){
   if(hit)return validShard(hit,index,id);
   throw e;
  }
 })();
 pending.set(key,task);
 try{return await task;}
 finally{pending.delete(key);}
}
/** Return records indexed by imported roster unit.id, preserving duplicates. */
export async function getUnitDetails(army,index,{fetcher=fetch}={}){
 if(!army?.units)return {records:{},matched:0,errors:[]};
 const pairs=army.units.map(unit=>({unit,entry:findIndexedUnit(unit,index)}))
  .filter(({entry})=>!!entry);
 const shards=[...new Set(pairs.map(p=>p.entry.shard))];
 const queue=[...shards],loaded=[];
 // Limit simultaneous shard requests on mobile/Safari and poor connections.
 const workers=Array.from({length:Math.min(4,queue.length)},async()=>{
  while(queue.length){
   const id=queue.shift();
   try{loaded.push({id,value:await getShard(index,id,fetcher)});}
   catch(e){loaded.push({id,error:String(e?.message||e)});}
  }
 });
 await Promise.all(workers);
 const byShard=new Map(loaded.filter(x=>x.value).map(x=>[x.id,x.value]));
 const errors=loaded.filter(x=>x.error).map(x=>x.id+': '+x.error);
 const records={};
 for(const {unit,entry} of pairs){
  const detail=byShard.get(entry.shard)?.records?.[entry.id];
  if(detail?.id===entry.id &&
     sourceUnitUrl(detail?.source?.sourceUrl)===entry.sourceUrl &&
     detail?.source?.verificationStatus==='source-extracted' &&
     Array.isArray(detail.modelProfiles))
   records[unit.id]=detail;
 }
 return {records,matched:Object.keys(records).length,errors};
}

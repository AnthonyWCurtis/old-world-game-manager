/**
 * Local-only reports of unmatched reference entries.
 * Stored in their own IndexedDB database, independent of saved army snapshots.
 * No automatic remote upload, and no whole army list or player identity.
 */
const DB='old-world-manager-unmatched-reports';
const STORE='reports';
function open(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined')return reject(Error('Browser storage unavailable'));
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains(STORE))
    request.result.createObjectStore(STORE,{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Could not open report database'));
 });
}
async function operation(mode,fn){
 const db=await open();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),request=fn(tx.objectStore(STORE));
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error('Report storage error'));
   tx.onerror=()=>reject(tx.error||Error('Report transaction failed'));
  });
 }finally{db.close();}
}
export const listUnmatchedReports=async()=>(
 (await operation('readonly',store=>store.getAll()))
 .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
);
export const deleteUnmatchedReport=id=>operation('readwrite',store=>store.delete(id));
export async function saveUnmatchedReport({format,entries,content,generatedAt=new Date().toISOString()}){
 if(!Array.isArray(entries)||!entries.length)throw Error('There are no unmatched references to report');
 if(typeof content!=='string'||!content.trim())throw Error('Debug report is empty');
 // Privacy: deliberately exclude full original source, player name and unit upgrades.
 const record={
  id:crypto.randomUUID(),createdAt:generatedAt,format:String(format||'unknown'),
  unmatchedCount:entries.length,content
 };
 await operation('readwrite',store=>store.put(record));
 return record;
}
export function reportFilename(report){
 const safe=report.createdAt.replace(/[^0-9]/g,'').slice(0,14);
 return 'unmatched-debug-'+safe+'.txt';
}

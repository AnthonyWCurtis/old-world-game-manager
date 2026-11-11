/** Player customisations are per imported unit instance, never rules/source mutations. */
export const MAX_UNIT_NAME_LENGTH=80;
const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const selections=unit=>{
 const entries=[];
 const visit=s=>{if(!s||typeof s!=='object')return;entries.push(s);for(const c of s.children||[])visit(c);};
 for(const s of unit?.selections||[])visit(s);
 for(const group of unit?.modelGroups||[])for(const s of group.selections||[])visit(s);
 return entries;
};
export function wizardDescriptor(unit,index=null){
 const entries=selections(unit),names=new Set(entries.map(s=>normalize(s.name)));
 const levelEntry=[...names].map(n=>n.match(/^level ([1-4]) wizard$/)).find(Boolean);
 if(!names.has('wizard')&&!levelEntry)return null;
 const loreNames=Array.isArray(index?.entries)?index.entries.filter(x=>x?.kind==='lore'&&typeof x.name==='string').map(x=>x.name):[];
 const lores=loreNames.filter(name=>names.has(normalize(name)));
 return {level:levelEntry?Number(levelEntry[1]):null,lores,
  importedSpellNames:new Set(entries.filter(s=>typeof s.name==='string').map(s=>normalize(s.name)))};
}
export function indexedSpells(index){
 if(index?.collectionType!=='source-reference-index'||index?.source?.origin!=='https://tow.whfb.app'||!Array.isArray(index.entries))return [];
 const seen=new Set();
 return index.entries.filter(entry=>{
  if(entry?.kind!=='spell'||typeof entry.name!=='string'||!/^[\w '-]{2,120}$/.test(entry.name))return false;
  if(typeof entry.id!=='string'||!/^magic-ref:\/spell\/[a-z0-9-]+$/.test(entry.id))return false;
  if(entry.url!=='https://tow.whfb.app/spell/'+entry.id.slice('magic-ref:/spell/'.length))return false;
  if(seen.has(entry.id))return false;
  seen.add(entry.id);return true;
 }).map(entry=>({id:entry.id,name:entry.name,url:entry.url,verificationStatus:entry.verificationStatus}))
 .sort((a,b)=>a.name.localeCompare(b.name));
}
export const isIndexedSpellId=id=>typeof id==='string'&&/^magic-ref:\/spell\/[a-z0-9-]+$/.test(id);
export function unitDisplayName(unit,session){
 return session?.unitNames?.[unit?.id]||unit?.nickname||unit?.name||'Unnamed unit';
}
/** Stored spell IDs must be source-shaped; the currently loaded index gates new selections. */
export function sanitizeKnownSpells(army,stored){
 const output={};
 if(!stored||typeof stored!=='object'||Array.isArray(stored))return output;
 const valid=new Set((army?.units||[]).filter(u=>wizardDescriptor(u)).map(u=>u.id));
 for(const [id,ids] of Object.entries(stored)){
  if(!valid.has(id)||!Array.isArray(ids))continue;
  const unique=[...new Set(ids.filter(isIndexedSpellId))].slice(0,150);
  if(unique.length)output[id]=unique;
 }
 return output;
}

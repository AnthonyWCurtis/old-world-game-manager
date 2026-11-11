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
  if(entry?.kind!=='spell'||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>160)return false;
  if(typeof entry.id!=='string'||!/^magic-ref:\/spell\/[a-z0-9-]+$/.test(entry.id))return false;
  if(entry.url!=='https://tow.whfb.app/spell/'+entry.id.slice('magic-ref:/spell/'.length))return false;
  if(seen.has(entry.id))return false;
  seen.add(entry.id);return true;
 }).map(entry=>({id:entry.id,name:entry.name,url:entry.url,verificationStatus:entry.verificationStatus}))
 .sort((a,b)=>a.name.localeCompare(b.name));
}

/**
 * Only the spells linked by the source lore pages chosen in THIS imported
 * wizard's selections. A source-lore link is not proof of generation, allowed
 * substitutions, or spell count; it is only the browsing/selection scope.
 */
export function spellsForWizard(unit,index){
 const wizard=wizardDescriptor(unit,index);
 if(!wizard||index?.loreLinks?.status!=='source-lore-page-indexed')return [];
 const chosen=new Set(wizard.lores.map(normalize));
 const loreEntries=(index.entries||[]).filter(e=>e?.kind==='lore'&&chosen.has(normalize(e.name))&&
  e.spellLinkStatus==='source-lore-page-indexed'&&Array.isArray(e.spellIds));
 const sources=new Map();
 for(const lore of loreEntries){
  for(const id of lore.spellIds){
   if(!isIndexedSpellId(id))continue;
   const item=sources.get(id)||{lores:[],signatureIn:[]};
   item.lores.push(lore.name);
   if(lore.signatureSpellIds?.includes(id))item.signatureIn.push(lore.name);
   sources.set(id,item);
  }
 }
 return indexedSpells(index).filter(s=>sources.has(s.id)).map(s=>({
  ...s,lores:sources.get(s.id).lores,signatureIn:sources.get(s.id).signatureIn
 }));
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

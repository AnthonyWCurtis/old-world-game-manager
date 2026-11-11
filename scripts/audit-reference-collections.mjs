/**
 * Read-only structural audit of the Rules, Magic and Magic Items sitemap
 * snapshots. No content or rules correctness is inferred from URL presence.
 */
const ORIGIN='https://tow.whfb.app';
const fail=(errors,code,collection,entry,detail)=>errors.push({
 code,collection,id:entry?.id||null,name:entry?.name||null,
 sourceUrl:entry?.url||null,detail
});
const safe=(url)=>{
 try{const u=new URL(url);return u.origin===ORIGIN&&!u.search&&!u.hash&&
 /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(u.pathname);}
 catch{return false;}
};
const specs={
 rules:{url:ORIGIN+'/sitemap/rules',prefix:'rule-ref:',groups:null},
 magic:{url:ORIGIN+'/sitemap/magic',prefix:'magic-ref:',
  groups:[['lore','lores','the-lores-of-magic'],['spell','spells','spell'],
   ['magic-reference','magicReferences','the-lores-of-magic']]},
 'magic-items':{url:ORIGIN+'/sitemap/magic-items',prefix:'magic-item-ref:',
  groups:[['type','types','magic-items'],['item-or-ability','itemsAndAbilities','magic-item']]}
};
export function auditReferenceCollections(collections){
 const errors=[],warnings=[],summaries={},allUrls=new Map();
 for(const [key,spec] of Object.entries(specs)){
  const data=collections?.[key],entries=Array.isArray(data?.entries)?data.entries:[];
  const label=key;
  if(!data){fail(errors,'MISSING_COLLECTION',label,null,'Index not provided');continue;}
  if(data?.source?.url!==spec.url)fail(errors,'SOURCE_MISMATCH',label,null,'Unexpected sitemap source');
  if(data?.source?.origin!==ORIGIN)fail(errors,'ORIGIN_MISMATCH',label,null,'Unexpected origin');
  if(data?.source?.verificationStatus!=='source-indexed')
   fail(errors,'SOURCE_NOT_INDEXED',label,null,'No verified sitemap index provenance');
  if(data?.counts?.entries!==entries.length)
   fail(errors,'ENTRY_COUNT_MISMATCH',label,null,'Declared count does not match entry count');
  const urls=new Set(),ids=new Set(),byId=new Map(),groups={};
  for(const entry of entries){
   if(!safe(entry.url))fail(errors,'INVALID_SOURCE_URL',label,entry,'Not a valid same-origin reference URL');
   if(urls.has(entry.url))fail(errors,'DUPLICATE_URL',label,entry,'Duplicate URL within collection');
   if(ids.has(entry.id))fail(errors,'DUPLICATE_ID',label,entry,'Duplicate ID within collection');
   urls.add(entry.url);ids.add(entry.id);byId.set(entry.id,entry);
   let path=null;
   try{path=new URL(entry.url).pathname;}catch{}
   if(entry.id!==spec.prefix+path)fail(errors,'ID_URL_MISMATCH',label,entry,'Reference ID does not match source URL');
   if(entry.path!==path)fail(errors,'PATH_MISMATCH',label,entry,'Saved path differs from URL path');
   if(!entry.name||!entry.name.trim())fail(errors,'MISSING_NAME',label,entry,'Empty source label');
   if(entry.verificationStatus!=='source-indexed')fail(errors,'ENTRY_NOT_INDEXED',label,entry,'Unexpected verification status');
   if(entry.kind)groups[entry.kind]=(groups[entry.kind]||0)+1;
   if(key==='rules'){
    const category=path?.split('/')[1];
    if(entry.categoryPath!==category)fail(errors,'CATEGORY_PATH_MISMATCH',label,entry,'Category does not match URL');
   }
   if(spec.groups){
    const group=spec.groups.find(g=>g[0]===entry.kind);
    if(!group)fail(errors,'UNEXPECTED_KIND',label,entry,'Unknown reference kind '+entry.kind);
    else if(path&&!path.startsWith('/'+group[2]+'/'))
     fail(errors,'KIND_PATH_MISMATCH',label,entry,'Reference path does not match kind');
   }
   if(allUrls.has(entry.url))allUrls.get(entry.url).push(key);
   else allUrls.set(entry.url,[key]);
  }
  if(spec.groups){
   for(const [kind,countField] of spec.groups)
    if((groups[kind]||0)!==(data.counts?.[countField]||0))
     fail(errors,'GROUP_COUNT_MISMATCH',label,null,kind+' differs from '+countField);
  }
  if(key==='magic'){
   const loreIds=new Set(entries.filter(e=>e.kind==='lore').map(e=>e.id));
   const spellIds=new Set(entries.filter(e=>e.kind==='spell').map(e=>e.id));
   for(const entry of entries){
    if(entry.kind==='lore'){
     for(const id of [...(entry.spellIds||[]),...(entry.signatureSpellIds||[])])
      if(!spellIds.has(id))fail(errors,'UNKNOWN_SPELL_LINK',label,entry,'Missing linked spell: '+id);
     for(const id of entry.signatureSpellIds||[])
      if(!(entry.spellIds||[]).includes(id))
       warnings.push({code:'SIGNATURE_NOT_IN_LORE_SPELLS',collection:key,
        id:entry.id,sourceUrl:entry.url,detail:id});
    }
    if(entry.kind==='spell')for(const id of entry.loreIds||[])
     if(!loreIds.has(id))fail(errors,'UNKNOWN_LORE_LINK',label,entry,'Missing linked lore: '+id);
   }
  }
  summaries[key]={
   entries:entries.length,
   sourceSnapshotCheckedAt:data.source?.checkedAt||null,
   kinds:groups,
   status:'source-indexed-only'
  };
 }
 const sharedUrls=[...allUrls].filter(([,collections])=>collections.length>1)
  .map(([url,collections])=>({url,collections}));
 return {summaries,sharedUrls,errors,warnings,
  scope:'Reference index integrity only; does not prove content extraction, points, eligibility, rules effects or source freshness.'};
}

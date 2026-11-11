/**
 * Display-only profile rows from a selected, exact-source-linked mount.
 * Keep the rider's original base profiles untouched. No stat combining.
 */
const validUrl=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+$/.test(url);
const columns=Object.freeze(['M','WS','BS','S','T','W','I','A','Ld']);
export function selectedMountProfileGroups(candidates=[],recordsByUrl={},fallbackProfiles={}){
 const groups=[];
 for(const candidate of candidates){
  const url=candidate?.sourceUrl;
  if(!validUrl(url))continue;
  const record=recordsByUrl[url];
  if(record?.source?.sourceUrl!==url||
     record.source.verificationStatus!=='source-extracted')continue;
  // The selection must already have been resolved by the strict mount matcher.
  if(!['chariot','riddenMonster','cavalry'].includes(candidate.mountType))continue;
  const raw=Array.isArray(record.modelProfiles)&&record.modelProfiles.length?
   record.modelProfiles:
   fallbackProfiles[url]?.url===url&&
   fallbackProfiles[url]?.verificationStatus==='source-extracted'&&
   Array.isArray(fallbackProfiles[url]?.models)?fallbackProfiles[url].models:[];
  const profiles=raw.filter(p=>p&&typeof p.name==='string'&&p.name.trim())
   .map(p=>({name:p.name,characteristics:Object.fromEntries(
    columns.filter(k=>p.characteristics?.[k]!==null&&
     p.characteristics?.[k]!==undefined&&p.characteristics?.[k]!=='')
     .map(k=>[k,p.characteristics[k]])
   )}));
  groups.push({sourceUrl:url,selectionName:candidate.name,mountType:candidate.mountType,
   profiles,verificationStatus:'source-linked; mount attachment not rules-verified'});
 }
 return groups;
}

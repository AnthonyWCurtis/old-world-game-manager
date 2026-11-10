/**
 * Renders read-only TOW unit source data. This is not a rules/legality checker.
 * Content uses textContent and source-origin checked hyperlinks: no HTML injection.
 */
const STAT_NAMES=['M','WS','BS','S','T','W','I','A','Ld'];
const ORIGIN='https://tow.whfb.app';
function el(doc,tag,cls='',label){
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
}
function link(doc,label,url){
 let trusted=false;
 try{
  const target=new URL(url);
  trusted=target.origin===ORIGIN&&!target.search&&!target.hash&&
   /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/.test(target.pathname);
 }catch{}
 if(!trusted)return el(doc,'span','',label);
 const anchor=el(doc,'a','',label);
 anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
 return anchor;
}
function detailGroup(doc,title,refs){
 if(!refs?.length)return null;
 const div=el(doc,'section','unit-ref-group');
 div.append(el(doc,'h4','',title));
 const ul=el(doc,'ul','unit-ref-list');
 for(const ref of refs){
  const li=el(doc,'li');
  li.append(link(doc,ref.name,ref.sourceUrl));
  if(ref.appliesToModel)li.append(el(doc,'small','unit-ref-note',' ('+ref.appliesToModel+')'));
  ul.append(li);
 }
 div.append(ul);
 return div;
}
export function renderUnitDataDetails(record,doc=document){
 const details=el(doc,'details','unit-data-details');
 const summary=el(doc,'summary','unit-data-summary','View unit source data');
 summary.append(el(doc,'span','unit-data-status',record.extractionWarnings?.length?'Source-extracted · review flags':'Source-extracted'));
 details.append(summary);
 const body=el(doc,'div','unit-data-body');
 body.append(el(doc,'p','unit-data-caveat',
  'Reference only. Source listings do not validate army legality, chosen upgrades or points totals.'));
 const row=[];
 const category=record.classification||{};
 const type=(category.unitCategory||[]).join(' / ');
 const troop=(category.troopType||[]).join(' / ');
 if(type)row.push(type);
 if(troop)row.push(troop);
 if(category.unitSize)row.push('Unit size: '+category.unitSize);
 if(category.baseSize)row.push('Base: '+category.baseSize);
 if(record.basePoints?.sourceText)row.push('Source cost: '+record.basePoints.sourceText);
 if(row.length)body.append(el(doc,'p','unit-data-meta',row.join(' · ')));
 if(record.modelProfiles?.length){
  const h=el(doc,'h4','', 'Model characteristics');
  body.append(h);
  const viewport=el(doc,'div','unit-data-stat-scroll');
  const table=el(doc,'table','unit-data-stats');
  const thead=el(doc,'thead'),header=el(doc,'tr');
  for(const column of ['Model',...STAT_NAMES])header.append(el(doc,'th','',column));
  thead.append(header);table.append(thead);
  const tbody=el(doc,'tbody');
  for(const model of record.modelProfiles){
   const tr=el(doc,'tr');
   tr.append(el(doc,'th','',model.name));
   for(const key of STAT_NAMES){
    const value=model.characteristics?.[key];
    tr.append(el(doc,'td','',value==null?'—':String(value)));
   }
   tbody.append(tr);
  }
  table.append(tbody);viewport.append(table);body.append(viewport);
 }
 for(const [title,refs] of [
  ['Starting equipment',record.startingEquipment],
  ['Standard special rules',record.startingRules],
  ['Optional rules (not automatically active)',record.optionalRules]
 ]){
  const group=detailGroup(doc,title,refs);
  if(group)body.append(group);
 }
 if(record.upgradeGroups?.length){
  const section=el(doc,'section','unit-data-upgrades');
  section.append(el(doc,'h4','', 'Published upgrade choices (not selected automatically)'));
  for(const [n,group] of record.upgradeGroups.entries()){
   const block=el(doc,'div','unit-data-upgrade-group');
   const eligibility=group.eligibilityClause||'Option '+(n+1);
   block.append(el(doc,'p','unit-data-eligibility',eligibility));
   const list=el(doc,'ul','unit-data-option-list');
   for(const option of group.options||[]){
    const li=el(doc,'li','unit-data-option');
    li.append(el(doc,'span','',option.description));
    if(option.linkedReferences?.length){
     const refs=el(doc,'span','unit-data-option-links');
     refs.append(el(doc,'span','', ' · References: '));
     for(const [i,ref] of option.linkedReferences.entries()){
      if(i)refs.append(el(doc,'span','',' · '));
      refs.append(link(doc,ref.name,ref.sourceUrl));
     }
     li.append(refs);
    }
    list.append(li);
   }
   block.append(list);section.append(block);
  }
  body.append(section);
 }
 if(record.listedInArmies?.length){
  body.append(el(doc,'p','unit-data-armies',
   'Listed on source army pages: '+record.listedInArmies.map(a=>a.name).join(', ')+
   ' (not a composition legality check)'));
 }
 const notes=[];
 if(record.source?.publicationCitation)notes.push(record.source.publicationCitation);
 if(record.source?.displayedUpdatedAt)notes.push(record.source.displayedUpdatedAt);
 else if(record.source?.sourceUpdatedAt)notes.push('Source updated: '+record.source.sourceUpdatedAt.slice(0,10));
 if(notes.length)body.append(el(doc,'p','unit-data-provenance',notes.join(' · ')));
 if(record.extractionWarnings?.length){
  const flags=el(doc,'div','unit-data-warnings');
  flags.append(el(doc,'strong','',record.extractionWarnings.length+' extraction review flag'+
   (record.extractionWarnings.length===1?'':'s')));
  const ul=el(doc,'ul');
  for(const warning of record.extractionWarnings)ul.append(el(doc,'li','',warning));
  flags.append(ul);body.append(flags);
 }
 const source=el(doc,'p','unit-data-footer');
 source.append(link(doc,'View original unit page',record.source?.sourceUrl));
 source.append(el(doc,'span','', ' · Source-extracted, not rules-verified'));
 body.append(source);
 details.append(body);
 return details;
}

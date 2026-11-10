import {createGameScreenModel} from './game-screen-model.js';
/**
 * Dedicated, mobile-first Army Roster screen.
 *
 * Renders the already-imported army and its version-pinned source profiles.
 * It does not calculate rules, infer missing quantities, apply upgraded stats,
 * alter saved imports, or fetch data independently. All source text is added
 * with textContent; external links are explicitly restricted to tow.whfb.app.
 */
export const PROFILE_COLUMNS=Object.freeze(['M','WS','BS','S','T','W','I','A','Ld']);
const SOURCE_ORIGIN='https://tow.whfb.app';
const valueOf=field=>field?.value??null;
const text=(v,fallback='Not stated')=>v===null||v===undefined||v===''?fallback:String(v);
const points=v=>Number.isFinite(v)?Number(v).toLocaleString('en-GB')+' pts':'Points not stated';

function el(doc,tag,cls='',label){
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
}
function safeLink(doc,label,url,cls=''){
 try{
  const parsed=new URL(url);
  if(parsed.origin!==SOURCE_ORIGIN||parsed.search||parsed.hash||
      !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/.test(parsed.pathname))
   return el(doc,'span',cls,label);
  const a=el(doc,'a',cls,label);
  a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';
  return a;
 }catch{return el(doc,'span',cls,label);}
}
function statProfile(record,fallback){
 if(Array.isArray(record?.modelProfiles)&&record.modelProfiles.length)
  return record.modelProfiles;
 if(Array.isArray(fallback?.models)&&fallback.models.length)
  return fallback.models;
 return [];
}
export function modelCountLabel(unit){
 const qty=valueOf(unit?.quantity);
 return Number.isSafeInteger(qty)&&qty>=0
  ?qty.toLocaleString('en-GB')+(qty===1?' model':' models')
  :'Count not stated';
}
export function rosterOverview(army,records={}){
 const units=army?.units||[];
 const known=units.filter(u=>Number.isSafeInteger(valueOf(u.quantity))&&valueOf(u.quantity)>=0);
 return {
  unitInstances:units.length,
  knownModelCount:known.reduce((n,u)=>n+u.quantity.value,0),
  unknownModelUnitCount:units.length-known.length,
  availableProfiles:units.filter(u=>!!records?.[u.id]?.modelProfiles?.length).length,
  displayedTotal:valueOf(army?.army?.derivedPoints)??valueOf(army?.army?.reportedPoints),
  declaredTotal:valueOf(army?.army?.reportedPoints)
 };
}
function collectSelections(input,depth=0,output=[]){
 for(const selection of input||[]){
  output.push({text:selection.name||selection.raw||'Unnamed selection',depth,
   informational:selection.matchStatus==='informational'});
  collectSelections(selection.children||[],depth+1,output);
 }
 return output;
}
function sourceRefRow(doc,title,refs){
 if(!refs?.length)return null;
 const group=el(doc,'div','army-ref-group');
 group.append(el(doc,'strong','',title));
 const items=el(doc,'div','army-ref-items');
 for(const ref of refs)items.append(safeLink(doc,ref.name,ref.sourceUrl,'army-ref-pill'));
 group.append(items);
 return group;
}
function unitCard(doc,unit,index,record,fallback,wasOpen){
 const card=el(doc,'article','army-unit-card');
 card.dataset.unitId=unit.id;
 const header=el(doc,'header','army-unit-head');
 const identity=el(doc,'div','army-unit-identity');
 identity.append(el(doc,'span','army-unit-index',String(index).padStart(2,'0')));
 const main=el(doc,'div','army-unit-names');
 main.append(el(doc,'h3','',unit.name));
 if(unit.nickname)main.append(el(doc,'span','army-unit-nickname',unit.nickname));
 const headingMeta=el(doc,'div','army-unit-meta');
 headingMeta.append(el(doc,'span','army-model-number',modelCountLabel(unit)));
 if(unit.quantity?.origin==='derived')
  headingMeta.append(el(doc,'span','army-quantity-note','From imported model groups'));
 main.append(headingMeta);
 identity.append(main);
 header.append(identity);
 const price=el(doc,'div','army-unit-points');
 price.append(el(doc,'strong','',points(valueOf(unit.reportedPoints))));
 price.append(el(doc,'span','','Imported unit cost'));
 header.append(price);
 card.append(header);

 const profiles=statProfile(record,fallback);
 const details=el(doc,'div','army-unit-card-body');
 if(profiles.length){
  const caption=el(doc,'div','army-profile-caption');
  caption.append(el(doc,'strong','','Model characteristics'));
  const note=record?'Published base profiles':'Cached source base profiles';
  caption.append(el(doc,'span','',note+' · selected options not applied'));
  details.append(caption);
  const scroller=el(doc,'div','army-profile-scroll');
  scroller.setAttribute('role','region');
  scroller.setAttribute('aria-label',unit.name+' model characteristics');
  scroller.tabIndex=0;
  const table=el(doc,'table','army-profile-table');
  const thead=el(doc,'thead'),head=el(doc,'tr');
  head.append(el(doc,'th','','Model'));
  for(const stat of PROFILE_COLUMNS)head.append(el(doc,'th','',stat));
  thead.append(head);table.append(thead);
  const tbody=el(doc,'tbody');
  for(const profile of profiles){
   const tr=el(doc,'tr');
   tr.append(el(doc,'th','',text(profile.name,'Model')));
   for(const stat of PROFILE_COLUMNS){
    const cell=el(doc,'td','',
     profile.characteristics?.[stat]===undefined?'—':String(profile.characteristics[stat]??'—'));
    tr.append(cell);
   }
   tbody.append(tr);
  }
  table.append(tbody);scroller.append(table);details.append(scroller);
 }else{
  const missing=el(doc,'div','army-profile-missing');
  missing.append(el(doc,'strong','','Profile not available'));
  missing.append(el(doc,'p','','The imported unit and points are preserved. No model characteristics have been guessed. Source data may still be loading or this profile may be unavailable offline.'));
  details.append(missing);
 }

 if(record){
  const sourceNotes=el(doc,'div','army-unit-source-meta');
  const bits=[];
  if(record.classification?.troopType?.length)bits.push(record.classification.troopType.join(' / '));
  if(record.classification?.baseSize)bits.push('Base '+record.classification.baseSize);
  if(record.basePoints?.sourceText)bits.push('Source: '+record.basePoints.sourceText);
  if(bits.length)sourceNotes.append(el(doc,'span','',bits.join(' · ')));
  sourceNotes.append(el(doc,'span','army-source-status',
   (record.extractionWarnings?.length?'Source data has '+record.extractionWarnings.length+' review flag(s)':'Source-extracted · not rules-verified')));
  details.append(sourceNotes);
 }

 const selections=collectSelections(unit.selections);
 const chosen=el(doc,'div','army-import-selections');
 chosen.append(el(doc,'h4','','Imported selections'));
 if(selections.length){
  const list=el(doc,'ul','army-selection-list');
  for(const item of selections){
   const li=el(doc,'li',item.informational?'army-selection-informational':'');
   if(item.depth)li.classList.add('army-selection-nested');
   li.append(el(doc,'span','',item.text));
   if(item.informational)li.append(el(doc,'small','','Info only'));
   list.append(li);
  }
  chosen.append(list);
 }else{
  chosen.append(el(doc,'p','army-quiet','No selections were included in this export.'));
 }
 for(const group of unit.modelGroups||[]){
  const groupArea=el(doc,'div','army-model-group');
  groupArea.append(el(doc,'strong','',group.quantity+'× '+group.name));
  if(group.pointsPerModel!=null)groupArea.append(el(doc,'span','', ' · listed '+points(group.pointsPerModel)+' each'));
  const list=el(doc,'ul','army-selection-list');
  for(const option of collectSelections(group.selections)){
   const li=el(doc,'li','',option.text);
   if(option.depth)li.classList.add('army-selection-nested');
   list.append(li);
  }
  if(list.children.length)groupArea.append(list);
  chosen.append(groupArea);
 }
 details.append(chosen);

 if(record?.startingEquipment?.length||record?.startingRules?.length||record?.optionalRules?.length){
  const extra=el(doc,'details','army-unit-source-details');
  if(wasOpen)extra.open=true;
  extra.append(el(doc,'summary','','Published equipment & rules'));
  const content=el(doc,'div','army-unit-source-body');
  for(const [heading,refs] of [
   ['Starting equipment',record.startingEquipment],
   ['Standard special rules',record.startingRules],
   ['Optional rules — not active automatically',record.optionalRules]
  ]){
   const row=sourceRefRow(doc,heading,refs);
   if(row)content.append(row);
  }
  extra.append(content);
  details.append(extra);
 }

 const url=record?.source?.sourceUrl||unit.reference?.url||fallback?.url;
 if(url){
  const footer=el(doc,'div','army-unit-footer');
  footer.append(safeLink(doc,'View published unit page',url,'army-source-link'));
  details.append(footer);
 }
 card.append(details);
 return card;
}

/**
 * Re-render into the roster screen, preserving expanded published-rule panels
 * as async source references arrive and unit cards are updated.
 * Returns an overview for display and test assertions.
 */
export function renderArmyRosterPage(container,army,records={},fallbackProfiles={}){
 const doc=container.ownerDocument||document;
 const opened=new Set([...container.querySelectorAll('article[data-unit-id] details.army-unit-source-details[open]')]
  .map(node=>node.closest('article[data-unit-id]')?.dataset.unitId).filter(Boolean));
 const model=createGameScreenModel(army,records,fallbackProfiles);
 const overview=rosterOverview(army,records);
 const byId=new Map((army.units||[]).map(unit=>[unit.id,unit]));
 container.replaceChildren();

 // A character remains an independent imported instance until an explicitly
 // verified joining workflow is implemented (Stage 3). No inferred assignment.
 const characters=el(doc,'section','game-character-group');
 characters.id='gameCharacters';
 const charHead=el(doc,'div','army-section-heading game-section-header');
 charHead.append(el(doc,'h2','','Characters'),el(doc,'span','',model.characters.length+' imported'));
 characters.append(charHead);
 if(!model.characters.length)
  characters.append(el(doc,'p','army-quiet','No separate Characters section was provided by this export.'));
 for(const entry of model.characters){
  const imported=byId.get(entry.id);
  if(!imported)continue;
  const card=unitCard(doc,imported,entry.index,records[entry.id],
   fallbackProfiles[imported.reference?.url],opened.has(entry.id));
  card.classList.add('game-character-card');
  characters.append(card);
 }
 container.append(characters);

 const regiments=el(doc,'section','game-regiments-group');
 regiments.id='gameRegiments';
 const regHead=el(doc,'div','army-section-heading game-section-header');
 regHead.append(el(doc,'h2','','Regiments & other units'),
  el(doc,'span','',model.regiments.length+' imported'));
 regiments.append(regHead);
 const sections=new Map((army.sections||[]).map(section=>[section.id,section]));
 for(const group of model.groups){
  const members=group.units.filter(unit=>!unit.isCharacter);
  if(!members.length)continue;
  const section=sections.get(group.id);
  const head=el(doc,'div','army-section-heading game-subsection');
  head.append(el(doc,'h2','',group.name));
  head.append(el(doc,'span','',members.length+(members.length===1?' unit entry':' unit entries')));
  if(section?.reportedPoints?.value!=null)
   head.append(el(doc,'span','army-section-points',
    'Export section: '+points(section.reportedPoints.value)));
  regiments.append(head);
  for(const entry of members){
   const imported=byId.get(entry.id);
   if(!imported)continue;
   regiments.append(unitCard(doc,imported,entry.index,records[entry.id],
    fallbackProfiles[imported.reference?.url],opened.has(entry.id)));
  }
 }
 if(!model.regiments.length)
  regiments.append(el(doc,'p','army-quiet','No additional units were identified in this import.'));
 container.append(regiments);
 return overview;
}

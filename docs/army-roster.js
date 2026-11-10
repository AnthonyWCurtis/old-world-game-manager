import {
 ROSTER_SESSION_KEY,validateRosterSnapshot
} from './army-roster-snapshot.js?v=0.4.7';
import {
 loadUnitDataIndex,applyUnitDataReferences,getUnitDetails
} from './unit-data.js?v=0.4.0';

const $=id=>document.getElementById(id);
const STAT_NAMES=['M','WS','BS','S','T','W','I','A','Ld'];
const make=(tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
};
const amount=n=>n==null?'—':Number(n).toLocaleString('en-GB');
const points=n=>n==null?'—':amount(n)+' pts';
const knownCount=u=>Number.isInteger(u.quantity)&&u.quantity>0?u.quantity:null;
const totalProfiles=records=>Object.values(records).reduce((a,record)=>
 a+(record.modelProfiles?.length||0),0);
const verifiedSourceUrl=url=>{
 try{
  const u=new URL(url);
  return u.origin==='https://tow.whfb.app'&&!u.search&&!u.hash&&
   /^\/unit\/[a-z0-9-]+$/.test(u.pathname)?u.href:null;
 }catch{return null;}
};

function statCell(key,value){
 const outer=make('div','stat'),label=make('dt','',key);
 const display=value===undefined||value===null?'—':String(value);
 outer.append(label,make('dd','',display));
 return outer;
}
function profileCard(profile){
 const article=make('section','profile');
 article.append(make('h4','profile-name',profile.name||'Published model profile'));
 const grid=make('dl','stat-grid');
 for(const name of STAT_NAMES)grid.append(statCell(name,profile.characteristics?.[name]));
 article.append(grid);
 return article;
}
function printRefs(target,title,refs){
 if(!Array.isArray(refs)||!refs.length)return;
 target.append(make('h4','',title));
 const container=make('div','reference-tags');
 for(const ref of refs){
  if(ref?.name)container.append(make('span','',ref.name));
 }
 target.append(container);
}
function unitCard(unit,record){
 const article=make('article','unit-card');
 article.dataset.search=(unit.name+' '+(unit.nickname||'')+' '+unit.sectionName)
  .normalize('NFKC').toLowerCase();
 const heading=make('div','unit-card-header');
 const identity=make('div','unit-identity');
 identity.append(make('span','unit-index',String(unit.ordinal).padStart(2,'0')));
 const group=make('div','unit-title-group');
 group.append(make('h3','unit-name',unit.name));
 const subtitle=make('div','unit-subtitle');
 subtitle.append(make('span','',unit.sectionName));
 if(unit.nickname)subtitle.append(make('span','unit-nickname','“'+unit.nickname+'”'));
 group.append(subtitle);identity.append(group);heading.append(identity);
 const cost=make('div','unit-cost');
 cost.append(make('strong','',points(unit.points)),make('span','','Imported unit points'));
 heading.append(cost);article.append(heading);

 const meta=make('div','unit-meta-row');
 const qty=knownCount(unit);
 meta.append(make('span','model-pill',qty===null?
  'Model count not supplied':qty+' '+(qty===1?'model':'models')));
 if(record){
  const n=record.modelProfiles?.length||0;
  meta.append(make('span','profile-caption',n+' published '+(n===1?'profile':'profiles')));
 }else{
  meta.append(make('span','source-missing','Profile unavailable'));
 }
 article.append(meta);

 const profileArea=make('div','unit-profiles');
 if(record?.modelProfiles?.length){
  for(const profile of record.modelProfiles)profileArea.append(profileCard(profile));
 }else{
  profileArea.append(make('div','profile-placeholder',
   'No published characteristics loaded for this unit. Imported name, model count and points are unchanged.'));
 }
 article.append(profileArea);

 if(unit.selections.length||unit.modelGroups.length){
  const selections=make('div','unit-options');
  if(unit.selections.length){
   selections.append(make('span','block-label','Imported selections'));
   const tags=make('div','option-list');
   for(const opt of unit.selections)tags.append(make('span','option-tag',opt.text));
   selections.append(tags);
  }
  if(unit.modelGroups.length){
   selections.append(make('span','block-label','Model groups'));
   for(const m of unit.modelGroups){
    const name=m.quantity==null?m.name:m.quantity+'× '+m.name;
    const tail=m.text||m.selections.join(' · ');
    selections.append(make('div','model-group',name+(tail?' · '+tail:'')));
   }
  }
  article.append(selections);
 }
 if(record){
  const details=make('details','unit-extra');
  details.append(make('summary','','Published equipment & special rules'));
  const body=make('div','unit-extra-content');
  printRefs(body,'Starting equipment',record.startingEquipment);
  printRefs(body,'Standard special rules',record.startingRules);
  printRefs(body,'Optional rules (not automatically active)',record.optionalRules);
  const footer=make('div','source-footer');
  footer.append(make('span','',
   'Source-extracted base profile · Not a legality or upgrade calculation'));
  const url=verifiedSourceUrl(record.source?.sourceUrl);
  if(url){
   const link=make('a','','View original unit page');
   link.href=url;link.target='_blank';link.rel='noopener noreferrer';
   footer.append(link);
  }
  body.append(footer);
  details.append(body);
  article.append(details);
 }
 return article;
}
function updateCounts(snapshot,records){
 const units=snapshot.units;
 $('totalPoints').textContent=amount(snapshot.army.calculatedPoints??snapshot.army.reportedPoints);
 $('totalUnits').textContent=String(units.length);
 const known=units.map(knownCount).filter(x=>x!==null);
 $('knownModels').textContent=known.length?amount(known.reduce((a,b)=>a+b,0)):'—';
 $('knownModels').title=known.length===units.length?
  'All model counts come from the imported list.':
  'Sum of model counts explicitly supplied or derived from the imported list. Missing counts are excluded.';
 $('sourceProfiles').textContent=String(totalProfiles(records));
}
function render(snapshot,records={}){
 $('armyName').textContent=snapshot.army.name;
 $('armyFaction').textContent=snapshot.army.faction;
 updateCounts(snapshot,records);
 const target=$('rosterUnits');
 target.replaceChildren();
 let previous=Symbol('none'),sectionContainer=null;
 for(const unit of snapshot.units){
  if(unit.sectionId!==previous){
   previous=unit.sectionId;
   const section=make('section','roster-section');
   const sectionName=make('h3','',unit.sectionName);
   const count=snapshot.units.filter(u=>u.sectionId===unit.sectionId).length;
   sectionName.append(make('small','', ' · '+count+' '+(count===1?'unit':'units')));
   section.append(sectionName);
   sectionContainer=make('div','section-cards');
   target.append(section,sectionContainer);
  }
  sectionContainer.append(unitCard(unit,records[unit.id]||null));
 }
 filterUnits();
}
function filterUnits(){
 const value=$('unitSearch').value.normalize('NFKC').toLowerCase().trim();
 let visible=0;
 const sections=[...$('rosterUnits').querySelectorAll('.unit-section')];
 for(const heading of sections){
  const group=heading.nextElementSibling;
  let shown=0;
  for(const card of group.querySelectorAll('.unit-card')){
   const pass=card.dataset.search.includes(value);
   card.hidden=!pass;
   if(pass){shown++;visible++;}
  }
  heading.hidden=shown===0;group.hidden=shown===0;
 }
 $('noSearchResults').hidden=visible>0;
}
async function main(){
 let snapshot;
 try{
  const raw=sessionStorage.getItem(ROSTER_SESSION_KEY);
  snapshot=validateRosterSnapshot(JSON.parse(raw));
 }catch(error){
  $('emptyRoster').hidden=false;
  return;
 }
 $('rosterContent').hidden=false;
 render(snapshot);
 $('rosterStatus').textContent='Loading published unit characteristics from the versioned source database…';
 try{
  const index=await loadUnitDataIndex();
  const army={units:snapshot.units.map(u=>({
   id:u.id,name:u.name,reference:u.reference,
   matchStatus:u.reference?'matched':'unmatched'
  }))};
  applyUnitDataReferences(army,index);
  const result=await getUnitDetails(army,index);
  render(snapshot,result.records);
  const n=result.matched;
  const total=snapshot.units.length;
  $('rosterStatus').textContent=n+'/'+total+' unit entries have source-backed profiles.'+
   (result.errors.length?' Some source files were unavailable; previously loaded data was used when possible.':'')+
   ' Published characteristics do not automatically reflect imported upgrades.';
 }catch(error){
  $('sourceProfiles').textContent='—';
  $('rosterStatus').textContent='Source profiles unavailable: '+
   String(error?.message||error)+'. The imported roster and points remain visible.';
 }
}
$('unitSearch').addEventListener('input',filterUnits);
$('printRoster').addEventListener('click',()=>window.print());
void main();

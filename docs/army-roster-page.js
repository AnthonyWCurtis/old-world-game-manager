import {createGameScreenModel} from './game-screen-model.js';
import {evaluateDefences} from './defence-engine.js';
import {unitDisplayName} from './player-customization.js';
import {sourcePrintedArmour} from './source-printed-armour.js';
import {sourceDefensiveRules,sourceArmourCap} from './source-defensive-rules.js';
import {selectedArmourSourceCandidates} from './selected-armour-candidates.js';
import {resolveSelectedMountProfiles} from './resolve-selected-mount-profiles.js';
import {selectedMountProfileGroups} from './selected-mount-profile-rows.js';
import {displayModelProfiles,selectedPublishedOptionalRules} from './imported-unit-display.js';
import {unitEquipmentAndRules} from './unit-equipment-and-rules.js';
import {MOUNT_ARMOUR_RULES} from './mount-armour-choice.js';
import {renderWizardSpellbook} from './wizard-spellbook-ui.js';
import {renderUnitEffects} from './effects-ui.js';
import {renderUnitAttackPanel,unitAttackSummary} from './unit-attack-panel.js';
/**
 * Dedicated, mobile-first Army Roster screen.
 *
 * Renders the already-imported army and its version-pinned source profiles.
 * It does not calculate rules, infer missing quantities, apply upgraded stats,
 * alter saved imports, or fetch data independently. All source text is added
 * with textContent; external links are explicitly restricted to tow.whfb.app.
 */
/** Visible, independent version of the unit profile display (not the importer). */
export const UNIT_PROFILES_VERSION='0.10';
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
function unitCard(doc,unit,index,record,fallback,wasOpen,session=null,onRename=null,expanded=false,onToggle=()=>{},mountProfileGroups=[],effects=[]){
 const card=el(doc,'article','army-unit-card');
 card.dataset.unitId=unit.id;
 const header=el(doc,'header','army-unit-head');
 const identity=el(doc,'div','army-unit-identity');
 identity.append(el(doc,'span','army-unit-index',String(index).padStart(2,'0')));
 const main=el(doc,'div','army-unit-names');
 const customName=unitDisplayName(unit,session);
 main.append(el(doc,'h3','',customName));
 if(customName!==unit.name)main.append(el(doc,'span','army-unit-nickname','Official: '+unit.name));
 if(unit.nickname&&customName!==unit.nickname)
  main.append(el(doc,'span','army-unit-nickname','Imported label: '+unit.nickname));
 if(onRename){
  const toggle=el(doc,'button','game-rename-toggle','Rename');
  toggle.type='button';
  toggle.setAttribute('aria-label','Rename '+customName);
  const form=el(doc,'form','game-unit-rename');
  form.hidden=true;
  const input=el(doc,'input','game-unit-rename-input');
  input.type='text';input.maxLength=80;input.value=session?.unitNames?.[unit.id]||'';
  input.placeholder=unit.nickname||unit.name;
  input.setAttribute('aria-label','Personal name for '+unit.name+' entry '+index);
  const save=el(doc,'button','game-unit-rename-save','Save name');
  save.type='submit';
  const reset=el(doc,'button','game-unit-rename-reset','Use imported name');
  reset.type='button';
  reset.addEventListener('click',()=>onRename(unit.id,null));
  form.addEventListener('submit',event=>{event.preventDefault();onRename(unit.id,input.value);});
  toggle.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)input.focus();});
  form.append(input,save,reset);main.append(toggle,form);
 }
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
 const expandable=el(doc,'div','game-unit-expandable');
 expandable.hidden=!expanded;
 expandable.id='game-unit-content-'+index;
 const toggle=el(doc,'button','game-unit-expand-toggle',expanded?'Hide details':'Show details');
 toggle.type='button';
 toggle.setAttribute('aria-label',(expanded?'Collapse ':'Expand ')+customName+' details');
 toggle.setAttribute('aria-expanded',String(expanded));
 toggle.setAttribute('aria-controls',expandable.id);
 toggle.addEventListener('click',()=>{
  const open=expandable.hidden;
  expandable.hidden=!open;
  card.classList.toggle('game-unit-open',open);
  toggle.textContent=open?'Hide details':'Show details';
  toggle.setAttribute('aria-label',(open?'Collapse ':'Expand ')+customName+' details');
  toggle.setAttribute('aria-expanded',String(open));
  onToggle(unit.id,open);
 });
 header.append(toggle);
 header.addEventListener('click',event=>{
  if(event.target.closest('button,a,input,select,label,form'))return;
  toggle.click();
 });
 card.classList.toggle('game-unit-open',expanded);
 card.append(header,expandable);

 const profiles=displayModelProfiles(unit,record,fallback);
 const details=el(doc,'div','army-unit-card-body');
 if(profiles.length||mountProfileGroups.length){
  const caption=el(doc,'div','army-profile-caption');
  caption.append(el(doc,'strong','','Model characteristics'));
  const note=profiles.length?(record?'Published base profiles':'Cached source base profiles'):'Rider profile unavailable';
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
  for(const group of mountProfileGroups){
   const groupHeader=el(doc,'tr','army-profile-mount-heading');
   const heading=el(doc,'th','','Selected mount: '+group.selectionName);
   heading.colSpan=PROFILE_COLUMNS.length+1;
   groupHeader.append(heading);tbody.append(groupHeader);
   if(!group.profiles.length){
    const blank=el(doc,'tr','army-profile-mount-row');
    const cell=el(doc,'td','','Published mount model characteristics not established');
    cell.colSpan=PROFILE_COLUMNS.length+1;blank.append(cell);tbody.append(blank);
   }
   for(const profile of group.profiles){
    const tr=el(doc,'tr','army-profile-mount-row');
    tr.append(el(doc,'th','','↳ '+text(profile.name,'Mount model')));
    for(const stat of PROFILE_COLUMNS)
     tr.append(el(doc,'td','',
      profile.characteristics?.[stat]===undefined?'—':String(profile.characteristics[stat]??'—')));
    tbody.append(tr);
   }
  }
  table.append(tbody);scroller.append(table);details.append(scroller);
  if(record){
   const quickFacts=[];
   if(record.classification?.troopType?.length)
    quickFacts.push(record.classification.troopType.join(' / '));
   if(record.classification?.baseSize)quickFacts.push('Base '+record.classification.baseSize);
   if(quickFacts.length)
    details.append(el(doc,'p','army-unit-quick-facts',quickFacts.join(' · ')));
  }
  for(const group of mountProfileGroups){
   const reference=el(doc,'div','army-unit-source-meta');
   reference.append(el(doc,'span','','Selected mount source profiles · rider characteristics unchanged · eligibility not verified'));
   reference.append(safeLink(doc,'Mount source',group.sourceUrl,'army-source-link'));
   details.append(reference);
  }

 }else{
  const missing=el(doc,'div','army-profile-missing');
  missing.append(el(doc,'strong','','Profile not available'));
  missing.append(el(doc,'p','','The imported unit and points are preserved. No model characteristics have been guessed. Source data may still be loading or this profile may be unavailable offline.'));
  details.append(missing);
 }

 // Independently refreshed source-page facts; do not treat an available
 // upgrade as selected or a lore as known by this imported unit instance.
 const magic=fallback?.wizardMagic;
 if(magic?.verificationStatus==='source-page-extracted'&&
    magic.sourceUrl===record?.source?.sourceUrl&&
    Number.isInteger(magic.baseLevel)&&magic.baseLevel>=1&&magic.baseLevel<=4){
  const group=el(doc,'details','army-unit-compact-details');
  group.append(el(doc,'summary','','Additional wizard source information'));
  group.append(el(doc,'p','','Source base level: '+magic.baseLevel));
  if(magic.availableLores?.length){
   const links=el(doc,'div','army-ref-items');
   for(const lore of magic.availableLores)
    links.append(safeLink(doc,lore.name,lore.url,'army-ref-pill'));
   group.append(el(doc,'p','','Source-listed lore alternatives (not imported selections):'));
   group.append(links);
  }
  if(magic.levelUpgrades?.length)
   group.append(el(doc,'p','','Available upgrades (not selected): '+
    magic.levelUpgrades.map(u=>'Level '+u.level+' (+'+u.additionalPoints+' pts)').join(' · ')));
  details.append(group);
 }
 // A printed chassis/unit value is not an equipment-derived or attack-specific save.
 // Never transfer it to an attached rider, crew model, or regiment.
 const printedArmour=sourcePrintedArmour(record,fallback);
 if(printedArmour){
  const section=el(doc,'details','army-unit-compact-details');
  section.append(el(doc,'summary','','Published unit/chassis armour reference · '+printedArmour.value+'+'));
  section.append(el(doc,'p','','Published unit/chassis value only. Model scope, rider equipment, armour modifiers and final saves are not calculated.'));
  section.append(safeLink(doc,'Original armour source',printedArmour.sourceUrl,'army-ref-pill'));
  details.append(section);
 }
 // Only flag incomplete published records; keep technical metadata in the
 // source snapshot and existing diagnostics, not every battle-ready unit card.
 if(record?.extractionWarnings?.length){
  details.append(el(doc,'p','army-unit-source-warning',
   'Published profile may be incomplete ('+record.extractionWarnings.length+
   ' source review flag(s)).'));
 }

 const loadout=unitEquipmentAndRules(unit,record);
 // The army importer still retains every original selection; in battle view
 // suppress only an exact, source-backed mundane missile weapon superseded
 // by a magic weapon carried by the same shooter.
 const inactiveWeaponUrls=new Set(unitAttackSummary(unit,record,fallback,effects)
  .supersededShootingWeapons.map(w=>w.sourceUrl));
 const shownEquipment=loadout.groups.equipment.filter(item=>
  !inactiveWeaponUrls.has(item.sourceUrl));
 const shownCount=shownEquipment.length+loadout.groups.rules.length+
  loadout.groups.upgrades.length;
 if(shownCount){
  const panel=el(doc,'section','army-unit-unified-loadout');
  const heading=el(doc,'div','army-unit-loadout-heading');
  heading.append(el(doc,'h4','','Equipment & special rules'));
  heading.append(el(doc,'span','',shownCount+' entries'));
  panel.append(heading);
  for(const [key,label] of [
   ['equipment','Equipment & items'],
   ['rules','Special rules'],
   ['upgrades','Command & other selections']
  ]){
   const items=key==='equipment'?shownEquipment:loadout.groups[key];
   if(!items?.length)continue;
   const group=el(doc,'div','army-unit-loadout-group');
   group.append(el(doc,'strong','',label));
   const chips=el(doc,'div','army-ref-items army-unit-loadout-items');
   for(const item of items){
    const caption=(item.scope?item.scope+': ':'')+item.name;
    const chip=safeLink(doc,caption,item.sourceUrl,'army-ref-pill army-unit-loadout-pill');
    chip.title=item.commandRole?'Open '+item.ruleTitle+' rules on tow.whfb.app':
     item.origin==='published-default'?'Published standard equipment/rule':
     'Imported selection; source matching and conditions may require review';
    if(item.origin==='published-default')chip.classList.add('army-unit-loadout-default');
    if(item.status==='unmatched')chip.classList.add('army-unit-loadout-unmatched');
    chips.append(chip);
   }
   group.append(chips);
   panel.append(group);
  }
  panel.append(el(doc,'p','army-quiet army-unit-loadout-note',
   loadout.sourceVerified?
   'Imported choices and published defaults shown together. Selected effects and legality are not automatically verified.':
   'Imported choices shown; source defaults are unavailable or still loading.'));
  details.append(panel);
 }
 
 const url=record?.source?.sourceUrl||unit.reference?.url||fallback?.url;
 if(url){
  const footer=el(doc,'div','army-unit-footer');
  footer.append(safeLink(doc,'View published unit page',url,'army-source-link'));
  details.append(footer);
 }
 expandable.append(details);
 return card;
}

/** Show important status without opening the card; source effects remain in its details. */
function appendCompactStatus(doc,card,defence,assignedCount=0,effects=[]){
 const header=card.querySelector('.army-unit-head');
 if(!header)return;
 const status=el(doc,'div','game-card-status');
 if(assignedCount)status.append(el(doc,'span','game-card-chip',
  assignedCount+' assigned character'+(assignedCount===1?'':'s')));
 const ongoing=new Set((defence?.activeSpellEffects||[]).map(e=>e.name).filter(Boolean));
 for(const name of [...ongoing].slice(0,3))
  status.append(el(doc,'span','game-card-chip game-card-chip-magic','Active: '+name));
 for(const note of (defence?.spellMovementNotes||[]).slice(0,2))
  status.append(el(doc,'span','game-card-chip game-card-chip-movement',
   'Movement: '+note.name));
 const items=effects.filter(e=>e.kind!=='Spell');
 for(const effect of items.filter(e=>e.effectGroup==='offensive'&&e.quickLabel)){
  const chip=el(doc,'span','game-card-chip game-card-chip-offensive',effect.quickLabel);
  chip.title=effect.quickDetail||effect.description;
  status.append(chip);
 }
 for(const [statusName,label,className] of [
  ['equipped','equipped','game-card-chip-item'],
  ['conditional','conditional','game-card-chip-item'],
  ['ready','one-use ready','game-card-chip-item'],
  ['spent','spent','game-card-chip-spent']
 ]){
  const count=items.filter(e=>e.status===statusName).length;
  if(count)status.append(el(doc,'span','game-card-chip '+className,
   count+' '+label));
 }
 for(const item of items.filter(e=>e.status==='active').slice(0,2))
  status.append(el(doc,'span','game-card-chip game-card-chip-magic',
   'Active: '+item.name));
 for(const item of items.filter(e=>e.status==='bound-spell').slice(0,1))
  status.append(el(doc,'span','game-card-chip game-card-chip-item',
   'Bound: '+(item.boundSpell?.name||item.name)));
 if(status.childNodes.length)header.querySelector('.army-unit-names')?.append(status);
}

/**
 * Re-render into the roster screen, preserving expanded published-rule panels
 * as async source references arrive and unit cards are updated.
 * Returns an overview for display and test assertions.
 */

/** Player-controlled membership. A recorded join is NOT rules-verified. */
function assignmentEditor(doc,character,regiments,currentUnitId,onAssignment,session){
 const row=el(doc,'div','game-assignment-editor');
 const label=el(doc,'label','',currentUnitId?'Change Unit / Remove':'Assign to Unit');
 const picker=el(doc,'select','character-unit-picker');
 picker.id='character-unit-'+character.id;
 picker.setAttribute('aria-label','Assign '+character.name+' to a unit');
 label.htmlFor=picker.id;
 const none=el(doc,'option','','Not assigned — independent');
 none.value='';picker.append(none);
 for(const regiment of regiments){
  const option=el(doc,'option','',unitDisplayName(regiment,session)+' · entry '+regiment.index);
  option.value=regiment.id;picker.append(option);
 }
 picker.value=currentUnitId||'';
 picker.addEventListener('change',()=>onAssignment(character.id,picker.value||null));
 row.append(label,picker);
 return row;
}

function regimentEditor(doc,regiment,characters,assignments,byId,onAssignment,session){
 const row=el(doc,'div','game-assignment-editor');
 const label=el(doc,'label','','Add Character');
 const picker=el(doc,'select','regiment-character-picker');
 picker.id='regiment-character-'+regiment.id;
 picker.setAttribute('aria-label','Add a character to '+regiment.name);
 label.htmlFor=picker.id;
 const empty=el(doc,'option','','Choose a character…');
 empty.value='';picker.append(empty);
 for(const character of characters){
  const prior=assignments[character.id];
  const source=prior&&byId.get(prior);
  const suffix=source?' · currently with '+unitDisplayName(source,session):'';
  const option=el(doc,'option','',unitDisplayName(character,session)+' · entry '+character.index+suffix);
  option.value=character.id;picker.append(option);
 }
 picker.value='';
 picker.addEventListener('change',()=>{
  if(picker.value)onAssignment(picker.value,regiment.id);
 });
 row.append(label,picker);
 return row;
}

function attachedCharacter(doc,character,imported,record,fallback,unitId,open,onAssignment,defence,onShieldUse,session,effects=[],effectActions={},mountProfileGroups=[]){
 const panel=el(doc,'details','game-attached-character');
 panel.dataset.characterId=character.id;
 panel.dataset.regimentId=unitId;
 panel.open=open;
 const summary=el(doc,'summary');
 summary.append(el(doc,'span','',unitDisplayName(character,session)+' · entry '+character.index));
 summary.append(el(doc,'small','',points(character.points)));
 panel.append(summary);
 const body=el(doc,'div','game-attached-character-body');
 const sourceCard=unitCard(doc,imported,character.index,record,fallback,false,session,null,false,()=>{},mountProfileGroups,effects);
 const profile=sourceCard.querySelector('.army-unit-card-body');
 if(profile)body.append(profile);
 body.append(renderUnitAttackPanel(doc,imported,record,fallback,effects));
 body.append(renderDefencePanel(doc,defence,onShieldUse,sourcePrintedArmour(record,fallback),record,[],[],imported));
 body.append(renderUnitEffects(doc,effects,effectActions));
 const remove=el(doc,'button','game-character-remove','Remove from unit');
 remove.type='button';
 remove.addEventListener('click',()=>onAssignment(character.id,null));
 body.append(remove);
 panel.append(body);
 return panel;
}


/**
 * A defence panel never conflates an equipped model's save with that of a
 * different character, or a Magic Missile-only Ward with an all-purpose Ward.
 */
function renderDefencePanel(doc,defence,onShieldUse=()=>{},printedArmour=null,record=null,armourCandidates=[],mountProfiles=[],importedUnit=null){
 const panel=el(doc,'section','game-defence-panel');
 panel.dataset.unitId=defence.id;
 const heading=el(doc,'div','game-defence-heading');
 heading.append(el(doc,'strong','','Defence'));
 heading.append(el(doc,'span','','Equipment-only armour · source-backed conditional saves'));
 panel.append(heading);

 const activeWard=[...defence.ward,...defence.sharedWard].filter(entry=>entry.available);
 const wardPreview=activeWard.length?
  activeWard.map(entry=>entry.label+' · '+entry.condition).join(' / '):
  defence.ward.some(entry=>entry.available===false)?'Spent or not currently available':'Not established';
 const regenPreview=defence.regeneration.length?
  defence.regeneration.map(entry=>entry.label+' · bearer only').join(' / '):'Not established';
 const metrics=el(doc,'div','game-defence-values');
 for(const [name,display,key] of [
  ['Armour',defence.armour.label,'armour'],
  ['Ward',wardPreview,'ward'],
  ['Regeneration',regenPreview,'regeneration']
 ]){
  const item=el(doc,'div','game-defence-stat');
  item.dataset.save=key;
  item.append(el(doc,'span','',name),el(doc,'strong','',display));
  metrics.append(item);
 }
 panel.append(metrics);
 const specialRules=sourceDefensiveRules(record,importedUnit);
 const armourCap=sourceArmourCap(record);
 if(armourCap||specialRules.length){
  const context=el(doc,'div','game-defence-detail-body');
  context.append(el(doc,'strong','','Published defensive references (not applied automatically)'));
  if(armourCap){
   context.append(el(doc,'span','','Source troop-type armour ceiling: '+armourCap.cap+
    '+ (model/mount scope unverified).'));
   context.append(safeLink(doc,'Armour limits rule',armourCap.sourceUrl,'game-defence-source'));
  }
  for(const rule of specialRules){
   context.append(el(doc,'span','',rule.name+' — '+rule.classification+
    '. Save value, affected model and eligibility require verification.'));
   context.append(safeLink(doc,'Rule source',rule.sourceUrl,'game-defence-source'));
  }
  panel.append(context);
 }
 if(printedArmour){
  const sourceValue=el(doc,'div','game-defence-detail-body');
  sourceValue.append(el(doc,'strong','','Published unit/chassis armour: '+printedArmour.label));
  sourceValue.append(el(doc,'span','','Source reference only. Model scope is unresolved; this does not replace the equipment-only Armour value above or determine a final save.'));
  sourceValue.append(safeLink(doc,'Original source page',printedArmour.sourceUrl,'game-defence-source'));
  panel.append(sourceValue);
 }
 if(armourCandidates.length){
  const mount=el(doc,'div','game-defence-detail-body');
  mount.append(el(doc,'strong','','Selected-option armour references — mount role unresolved'));
  for(const candidate of armourCandidates){
   mount.append(el(doc,'span','',candidate.selectionName+': source-printed '+candidate.label+
    '. This may be a mount or other selected entry; no rider/chariot relationship inferred.'));
   mount.append(safeLink(doc,'Option source',candidate.sourceUrl,'game-defence-source'));
  }
  mount.append(el(doc,'span','',
   'Chariot/ridden-monster armour may offer a rider-or-mount choice; cavalry uses rider armour. Character shields do not improve chariot armour; magic armour benefits require using that magic armour.'));
  for(const [name,url] of [['Chariot split profile',MOUNT_ARMOUR_RULES.chariot],
   ['Ridden monster',MOUNT_ARMOUR_RULES.riddenMonster],
   ['Cavalry split profile',MOUNT_ARMOUR_RULES.cavalry],['Official FAQ',MOUNT_ARMOUR_RULES.faq]])
   mount.append(safeLink(doc,name,url,'game-defence-source'));
  panel.append(mount);
 }
 if(mountProfiles.length){
  const linked=el(doc,'div','game-defence-detail-body');
  linked.append(el(doc,'strong','','Linked selected mount profiles — source evidence'));
  for(const candidate of mountProfiles){
   linked.append(el(doc,'span','',candidate.name+' · '+
    (candidate.mountType==='riddenMonster'?'Ridden monster':candidate.mountType)+
    ' · published mount armour '+(candidate.printedArmour?.label||'not established')+
    '. Mounted-model association and legality not yet verified.'));
   linked.append(safeLink(doc,'Published mount record',candidate.sourceUrl,'game-defence-source'));
   if(candidate.ruleUrl)linked.append(safeLink(doc,'Applicable split-profile reference',
    candidate.ruleUrl,'game-defence-source'));
   if(candidate.publishedBenefits){
    const benefits=candidate.publishedBenefits;
    const group=el(doc,'div','game-defence-detail-body');
    group.append(el(doc,'strong','','Mount effects and possible rider benefits — conditional'));
    for(const item of benefits.benefits){
     group.append(el(doc,'span','',item.name+' ('+item.scope+'): '+item.detail));
     group.append(safeLink(doc,'Rule source',item.sourceUrl,'game-defence-source'));
    }
    if(benefits.specialRules.length){
     group.append(el(doc,'strong','','Published mount special rules'));
     for(const item of benefits.specialRules){
      group.append(el(doc,'span','',item.name+' — '+item.classification+
       ' — '+item.appliesTo+'. Not granted to the rider automatically.'));
      group.append(safeLink(doc,'Special rule',item.sourceUrl,'game-defence-source'));
     }
    }
    group.append(el(doc,'span','',benefits.weaponRuleExclusion.detail));
    group.append(safeLink(doc,'Weapon-rule FAQ',
     benefits.weaponRuleExclusion.sourceUrl,'game-defence-source'));
    group.append(el(doc,'p','game-defence-disclaimer',
     'Source rules describe the combined mounted model, but exact rider transfer, eligibility and optional upgrades remain unverified.'));
    linked.append(group);
   }
  }
  panel.append(linked);
 }
 if(defence.activeSpellEffects?.length||defence.spellMovementNotes?.length){
  const banner=el(doc,'div','game-unit-active-magic');
  banner.append(el(doc,'strong','','Magic affecting this unit'));
  for(const effect of defence.activeSpellEffects||[])
   banner.append(el(doc,'span','game-unit-magic-chip','Active: '+effect.name));
  for(const note of defence.spellMovementNotes||[])
   banner.append(el(doc,'span','game-unit-magic-chip game-unit-magic-movement',
    'Movement resolved: '+note.name));
  panel.append(banner);
 }
 // Incoming hit modifiers are NOT Ward saves and must be visible separately.
 if(defence.attackModifiers?.length){
  const incoming=el(doc,'div','game-defence-incoming');
  const value=defence.attackModifiers.map(e=>e.label+' · '+e.name).join(' / ');
  incoming.append(el(doc,'strong','','Incoming To Hit: '+value));
  incoming.append(el(doc,'span','','Enemy attacks against affected models; not a saving throw.'));
  panel.append(incoming);
 }
 if(defence.movementRestrictions?.length){
  const movement=el(doc,'div','game-defence-movement');
  movement.append(el(doc,'strong','','Active movement/charge restrictions'));
  const list=el(doc,'ul');
  for(const rule of defence.movementRestrictions)
   list.append(el(doc,'li','',rule.detail));
  movement.append(list);panel.append(movement);
 }
 for(const warning of defence.spellWarnings||[])
  panel.append(el(doc,'p','game-spell-warning',warning));
 const notes=el(doc,'details','game-defence-details');
 const sum=el(doc,'summary','','Sources, scope and conditions');
 notes.append(sum);
 const body=el(doc,'div','game-defence-detail-body');
 body.append(el(doc,'p','',defence.armour.note));
 body.append(safeLink(doc,'Armour value',defence.armour.sources[0],'game-defence-source'));
 if(defence.armour.sources.length>1)
  body.append(safeLink(doc,'Shield rules',defence.armour.sources[1],'game-defence-source'));
 const addRule=(entry,cssClass='game-defence-conditional')=>{
  const block=el(doc,'div',cssClass);
  block.append(el(doc,'strong','',entry.name+' — '+(entry.label||'defensive rule')));
  block.append(el(doc,'p','',entry.condition+' · '+entry.scope+
   (entry.available===false?' · Already used — no longer available':'')+
   (entry.status?.includes('joining')?' · Join legality not verified':'')));
  block.append(safeLink(doc,'View source rule',entry.sourceUrl,'game-defence-source'));
  body.append(block);
 };
 for(const entry of defence.ward)addRule(entry);
 for(const entry of defence.regeneration)addRule(entry);
 for(const entry of defence.sharedWard){
  addRule({...entry,name:entry.name+' (from '+entry.fromCharacterName+')'});
 }
 for(const champion of defence.champions){
  for(const entry of champion.ward){
   addRule({...entry,name:champion.name+': '+entry.name},'game-defence-champion');
  }
 }
 for(const rule of defence.otherEffects)addRule(rule,'game-defence-conditional');
 for(const rule of defence.attackModifiers||[])
  addRule({...rule,condition:'Enemy To Hit modifier; not an armour or Ward save'},'game-defence-conditional');
 for(const rule of defence.movementRestrictions||[])
  addRule({...rule,name:rule.name+' — '+rule.detail,condition:rule.detail},'game-defence-conditional');
 body.append(el(doc,'p','game-defence-disclaimer',
  'These values exclude enemy Armour Piercing and unverified special rules. Spell effects require confirmed player declarations. Conditional saves are not universal saves. Joined-character legality and precise phase/range are not validated.'));
 notes.append(body);panel.append(notes);
 const charmed=defence.ward.find(w=>w.name==='Charmed Shield');
 if(defence.isCharacter&&charmed){
  const wrap=el(doc,'label','game-defence-shield-used');
  const checkbox=el(doc,'input');
  checkbox.type='checkbox';
  checkbox.checked=charmed.available===false;
  checkbox.setAttribute('aria-label','Charmed Shield has been used for '+defence.name);
  checkbox.addEventListener('change',()=>onShieldUse(defence.id,checkbox.checked));
  wrap.append(checkbox,el(doc,'span','',
   'Charmed Shield already used (once per game)'));
  panel.append(wrap);
 }
 return panel;
}

export function renderArmyRosterPage(container,army,records={},fallbackProfiles={},session=null,onAssignment=()=>{},onShieldUse=()=>{},onRename=()=>{},onKnownSpell=()=>{},magicIndex=null,expandedCardIds=null,onToggle=()=>{},effectProjection={byUnit:{}},onItemState=()=>{},selectedUnitRecords={}){
 const doc=container.ownerDocument||document;
 const openCards=new Set(Array.isArray(expandedCardIds)?expandedCardIds:
  [...container.querySelectorAll('article[data-unit-id].game-unit-open')]
   .map(node=>node.dataset.unitId));
 const opened=new Set([...container.querySelectorAll('article[data-unit-id] details.army-unit-source-details[open]')]
  .map(node=>node.closest('article[data-unit-id]')?.dataset.unitId).filter(Boolean));
 const openMembers=new Set([...container.querySelectorAll('details.game-attached-character[open]')]
  .map(d=>d.dataset.regimentId+':'+d.dataset.characterId));
 const openWizards=new Set([...container.querySelectorAll('details.game-wizard-spellbook[open]')]
  .map(d=>d.dataset.wizardId));
 const model=createGameScreenModel(army,records,fallbackProfiles);
 const overview=rosterOverview(army,records);
 const byId=new Map((army.units||[]).map(unit=>[unit.id,unit]));
 const displayId=new Map(model.units.map(entry=>[entry.id,entry]));
 const assignments=session?.assignments||{};
 const itemActions={onItemState,onShieldUse};
 container.replaceChildren();

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
  const linkedMounts=resolveSelectedMountProfiles(imported,selectedUnitRecords,fallbackProfiles);
  const mountRows=selectedMountProfileGroups(linkedMounts,selectedUnitRecords,fallbackProfiles,imported);
  const effects=effectProjection.byUnit?.[entry.id]||[];
  const card=unitCard(doc,imported,entry.index,records[entry.id],
   fallbackProfiles[imported.reference?.url],opened.has(entry.id),session,onRename,
   openCards.has(entry.id),onToggle,mountRows,effects);
  card.classList.add('game-character-card');
  const defence=evaluateDefences(army,session,entry.id);
  appendCompactStatus(doc,card,defence,0,effects);
  const content=card.querySelector('.game-unit-expandable');
  content.append(renderUnitAttackPanel(doc,imported,records[entry.id],
   fallbackProfiles[imported.reference?.url],effects));
  content.append(renderDefencePanel(doc,defence,onShieldUse,
   sourcePrintedArmour(records[entry.id],fallbackProfiles[imported.reference?.url]),
    records[entry.id],selectedArmourSourceCandidates(imported,fallbackProfiles),
    resolveSelectedMountProfiles(imported,selectedUnitRecords,fallbackProfiles,defence.armour?.value),imported));
  content.append(renderUnitEffects(doc,effects,itemActions));
  const spellbook=renderWizardSpellbook(doc,imported,session,magicIndex,onKnownSpell);
  if(spellbook){spellbook.open=openWizards.has(entry.id);content.append(spellbook);}
  const target=displayId.get(assignments[entry.id]);
  content.append(el(doc,'p','game-membership-label',
   target?'Assigned to '+unitDisplayName(target,session)+' · entry '+target.index:'Independent · no regiment assigned'));
  if(model.regiments.length)
   content.append(assignmentEditor(doc,entry,model.regiments,target?.id||null,onAssignment,session));
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
   const linkedMounts=resolveSelectedMountProfiles(imported,selectedUnitRecords,fallbackProfiles);
   const mountRows=selectedMountProfileGroups(linkedMounts,selectedUnitRecords,fallbackProfiles,imported);
   const effects=effectProjection.byUnit?.[entry.id]||[];
   const card=unitCard(doc,imported,entry.index,records[entry.id],
    fallbackProfiles[imported.reference?.url],opened.has(entry.id),session,onRename,
    openCards.has(entry.id),onToggle,mountRows,effects);
   const memberList=model.characters.filter(c=>assignments[c.id]===entry.id);
   const defence=evaluateDefences(army,session,entry.id);
   appendCompactStatus(doc,card,defence,memberList.length,effects);
   const content=card.querySelector('.game-unit-expandable');
   content.append(renderUnitAttackPanel(doc,imported,records[entry.id],
    fallbackProfiles[imported.reference?.url],effects));
   content.append(renderDefencePanel(doc,defence,onShieldUse,
    sourcePrintedArmour(records[entry.id],fallbackProfiles[imported.reference?.url]),
    records[entry.id],[],[],imported));
   content.append(renderUnitEffects(doc,effects,itemActions));
   const spellbook=renderWizardSpellbook(doc,imported,session,magicIndex,onKnownSpell);
   if(spellbook){spellbook.open=openWizards.has(entry.id);content.append(spellbook);}
   const memberArea=el(doc,'section','game-assigned-characters');
   memberArea.append(el(doc,'h4','','Assigned characters ('+memberList.length+')'));
   if(!memberList.length)
    memberArea.append(el(doc,'p','army-quiet','No characters assigned.'));
   for(const character of memberList){
    const original=byId.get(character.id);
    if(!original)continue;
    memberArea.append(attachedCharacter(doc,character,original,records[character.id],
     fallbackProfiles[original.reference?.url],entry.id,
     openMembers.has(entry.id+':'+character.id),onAssignment,
      evaluateDefences(army,session,character.id),onShieldUse,session,
      effectProjection.byUnit?.[character.id]||[],itemActions,
      selectedMountProfileGroups(
       resolveSelectedMountProfiles(original,selectedUnitRecords,fallbackProfiles),
       selectedUnitRecords,fallbackProfiles,original)));
   }
   if(model.characters.length)
    memberArea.append(regimentEditor(doc,entry,model.characters,assignments,displayId,onAssignment,session));
   content.append(memberArea);
   regiments.append(card);
  }
 }
 if(!model.regiments.length)
  regiments.append(el(doc,'p','army-quiet','No additional units were identified in this import.'));
 container.append(regiments);
 return overview;
}

/**
 * Matches imported selections only when the exact PARENT unit source record
 * contains evidence for the selection. These are source *references*, not
 * confirmed paid upgrades or army-legality assertions.
 *
 * Original selections, quantities and point values are NEVER changed.
 */
import {isInformationalSelection,recountReferenceStats} from './selection-information.js?v=0.4.2';
const SOURCE_ORIGIN='https://tow.whfb.app';
const clean=s=>String(s||'').normalize('NFKC').toLowerCase()
  .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const normalized=s=>clean(s).replace(/\*+$/,'').trim();

/**
 * Some source unit-page fields (notably "Magic:") were not retained in the
 * initial 581-unit JSON export. These facts are deliberately explicit and
 * limited to pages checked individually, rather than inferred from names or
 * army/faction identity.
 *
 * Archmage: https://tow.whfb.app/unit/archmage
 * Magic: "Archmage is a Level 3 Wizard"; optional "Be a Level 4 Wizard".
 */
export const SOURCE_VERIFIED_WIZARDS=Object.freeze({
  'unit:archmage': Object.freeze({
    sourceUrl:'https://tow.whfb.app/unit/archmage',
    verifiedOn:'2026-11-10',
    baseWizardLevel:3,
    upgradeWizardLevels:[4],
    evidenceSection:'Magic',
    evidenceText:'Archmage is a Level 3 Wizard'
  })
});

const flatten=items=>(items||[]).flatMap(x=>[x,...flatten(x.children||[])]);
function selectionsOf(unit){
 return flatten(unit.selections||[]).concat(
  (unit.modelGroups||[]).flatMap(g=>flatten(g.selections||[]))
 );
}
function validParent(record){
 if(!record?.id?.startsWith('unit:')||
    record.source?.verificationStatus!=='source-extracted'||
    record.legalityVerified!==false||
    !Array.isArray(record.modelProfiles))return null;
 try{
  const u=new URL(record.source.sourceUrl);
  if(u.origin!==SOURCE_ORIGIN||u.search||u.hash||
     !/^\/unit\/[a-z0-9-]+$/.test(u.pathname)||
     record.id!=='unit:'+u.pathname.slice('/unit/'.length))return null;
  return u.href;
 }catch{return null;}
}
function safeRef(ref){
 try{
  const u=new URL(ref.sourceUrl);
  if(u.origin!==SOURCE_ORIGIN||u.search||u.hash||
     !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(u.pathname))return false;
  return !!ref.name;
 }catch{return false;}
}
function findUniqueStartingEquipment(record,selection){
 const key=normalized(selection.name);
 if(!key)return null;
 const found=(record.startingEquipment||[]).filter(ref=>safeRef(ref)&&normalized(ref.name)===key);
 const urls=new Set(found.map(r=>r.sourceUrl));
 return urls.size===1?found[0]:null;
}
function directCommand(record,selection){
 const wanted=normalized(selection.name);
 if(!['standard bearer','musician'].includes(wanted))return null;
 const options=(record.upgradeGroups||[]).flatMap(g=>g.options||[]);
 const matched=options.filter(o=>{
  const m=String(o.description||'').match(/^upgrade one model to an?\s+(standard bearer|musician)(?=\s|\(|$)/i);
  return m&&normalized(m[1])===wanted;
 });
 return matched.length===1?matched[0]:null;
}
function wizardEvidence(record,selection){
 const fact=SOURCE_VERIFIED_WIZARDS[record.id];
 if(!fact||fact.sourceUrl!==record.source.sourceUrl)return null;
 if(!record.modelProfiles.some(m=>normalized(m.name)==='archmage'))return null;
 const name=normalized(selection.name);
 if(name==='wizard')return {type:'wizard',basis:'source-page-magic-clause',
   note:'The source page identifies this unit as a Level 3 Wizard; Level 4 is an optional upgrade.'};
 const match=name.match(/^level ([1-4]) wizard$/);
 if(!match)return null;
 const level=Number(match[1]);
 if(level===fact.baseWizardLevel)return {type:'wizard-level',
   basis:'source-page-default-wizard-level',
   note:'This is the published default wizard level, not a purchased upgrade.'};
 if(fact.upgradeWizardLevels.includes(level)){
  const matching=(record.upgradeGroups||[]).flatMap(g=>g.options||[]).filter(o=>
   new RegExp('^Be a Level '+level+' Wizard(?:\\s|$)','i').test(o.description||''));
  if(matching.length===1)return {type:'wizard-level',basis:'published-wizard-upgrade',
   note:'The source lists this upgrade; roster legality and point totals are not evaluated.'};
 }
 return null;
}
function referenceForSelection(unit,record,selection){
 if(isInformationalSelection(selection))return null;
 const url=validParent(record);
 if(!url || unit.reference?.url!==url)return null;
 const gear=findUniqueStartingEquipment(record,selection);
 if(gear){
  return {id:'unit-scoped:'+record.id+':equipment:'+normalized(gear.name),
    name:selection.name,url:gear.sourceUrl,type:'equipment',
    source:'unit-scoped-data',parentSourceUrl:url,
    verificationStatus:'source-extracted',evidence:'starting-equipment'};
 }
 const command=directCommand(record,selection);
 if(command){
  return {id:'unit-scoped:'+record.id+':command:'+normalized(selection.name),
   name:selection.name,url,type:'command',source:'unit-scoped-data',
   verificationStatus:'source-extracted',evidence:'published-command-upgrade',
   note:'This unit page lists the command option; selection legality and costs are not verified.'};
 }
 const wizard=wizardEvidence(record,selection);
 if(wizard){
  return {id:'unit-scoped:'+record.id+':wizard:'+normalized(selection.name),
   name:selection.name,url,type:wizard.type,source:'unit-scoped-data',
   verificationStatus:'source-extracted',evidence:wizard.basis,note:wizard.note};
 }
 return null;
}
/** Exported to test exactly what was proven for an imported selection. */
export const findSourceScopedSelectionReference=referenceForSelection;

function recount(army){recountReferenceStats(army);}
export function applySourceScopedSelectionReferences(army,records){
 if(!army?.units||!records)return {added:0};
 let added=0;
 for(const unit of army.units){
  const record=records[unit.id];
  if(!validParent(record)||record.source.sourceUrl!==unit.reference?.url)continue;
  for(const selection of selectionsOf(unit)){
   if(isInformationalSelection(selection)){
    selection.matchStatus='informational';selection.reference=null;
    continue;
   }
   // Reviewed references, manual mappings and model-profile evidence win.
   if(selection.reference&&
      !['live-index','unit-scoped-data'].includes(selection.reference.source))continue;
   const match=referenceForSelection(unit,record,selection);
   if(match){
    if(selection.matchStatus!=='matched')added++;
    selection.reference=match;
    selection.matchStatus='matched';
   }else if(selection.reference?.source==='unit-scoped-data'){
    selection.reference=null;selection.matchStatus='unmatched';
   }
  }
 }
 recount(army);
 return {added};
}

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
 * Mage: https://tow.whfb.app/unit/mage
 * Magic: "Mage is a Level 1 Wizard"; optional "Be a Level 2 Wizard +30 points".
 *
 * A wizard selection is reference-matched only to a page-verified parent,
 * and upgraded levels additionally require the exact parent option text.
 */
export const SOURCE_VERIFIED_WIZARDS=Object.freeze({
  'unit:archmage': Object.freeze({
    sourceUrl:'https://tow.whfb.app/unit/archmage',
    verifiedOn:'2026-11-10',
    baseWizardLevel:3,
    upgradeWizardLevels:[4],
    evidenceSection:'Magic',
    evidenceText:'Archmage is a Level 3 Wizard'
  }),
  'unit:mage': Object.freeze({
    sourceUrl:'https://tow.whfb.app/unit/mage',
    verifiedOn:'2026-11-10',
    baseWizardLevel:1,
    upgradeWizardLevels:[2],
    evidenceSection:'Magic',
    evidenceText:'Mage is a Level 1 Wizard'
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
/**
 * A model-specific equipment choice from the actual unit's Options section.
 * "9x Additional hand weapon" identifies a *reference* to the unit's option,
 * not proof that nine models may take it or a validation of paid points.
 */
function modelCountEquipmentOption(record,selection){
 const m=String(selection.name||'').trim().match(/^([1-9]\d*)\s*[x×]\s+(.+)$/i);
 if(!m)return null;
 const quantity=Number(m[1]),name=normalized(m[2]);
 if(!Number.isSafeInteger(quantity)||quantity<1||!name)return null;
 const hits=[];
 for(const group of record.upgradeGroups||[]){
  if(!/^any model in the unit may take one of the following:/i.test(group.eligibilityClause||''))continue;
  for(const option of group.options||[]){
   if(option.points?.basis!=='per_model')continue;
   for(const ref of option.linkedReferences||[]){
    if(safeRef(ref)&&normalized(ref.name)===name)hits.push({ref,option});
   }
  }
 }
 return hits.length===1?{...hits[0],quantity}:null;
}

/**
 * Some exporters pluralise champion titles (Lord's Bowmen) while the source
 * profile and unit upgrade both use the singular (Lord's Bowman).
 * An exact champion title *and* an explicit upgrade are mandatory.
 */
function publishedChampionOption(record,selection){
 const provided=normalized(selection.name);
 if(!provided)return null;
 const canonical=provided.endsWith('bowmen')?
  provided.slice(0,-'bowmen'.length)+'bowman':provided;
 if(!record.modelProfiles?.some(m=>normalized(m.name)===canonical))return null;
 const matching=(record.upgradeGroups||[]).flatMap(g=>g.options||[]).filter(o=>{
  const m=String(o.description||'').match(
   /^upgrade one model to an?\s+(.+?)\s*\(champion\)\s*\(\+\d+ points? per unit\)/i);
  return m && normalized(m[1])===canonical;
 });
 return matching.length===1?{option:matching[0],sourceName:canonical}:null;
}

/** Require an explicit paid Wizard level option on this exact source unit. */
function optionalWizardLevelOption(record,selection){
 const m=normalized(selection.name).match(/^level ([1-4]) wizard$/);
 if(!m)return null;
 const level=Number(m[1]);
 const hits=(record.upgradeGroups||[]).flatMap(g=>g.options||[]).filter(o=>
  new RegExp('^May be a Level '+level+' Wizard\\s*\\(\\+\\d+ points?\\)','i')
   .test(String(o.description||'')));
 return hits.length===1?{level,option:hits[0]}:null;
}

function wizardEvidence(record,selection){
 const fact=SOURCE_VERIFIED_WIZARDS[record.id];
 if(!fact||fact.sourceUrl!==record.source.sourceUrl)return null;
 // A verified source page and its corresponding model profile are both
 // required: a Wizard option on an unrelated unit must not gain a match.
 if(!record.modelProfiles.some(m=>normalized(m.name)===normalized(record.name)))return null;
 const name=normalized(selection.name);
 if(name==='wizard')return {type:'wizard',basis:'source-page-magic-clause',
   note:record.name+' is a Level '+fact.baseWizardLevel+
    ' Wizard by default. Upgraded levels are separate optional choices.'};
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
 const modelGear=modelCountEquipmentOption(record,selection);
 if(modelGear){
  return {id:'unit-scoped:'+record.id+':model-gear:'+normalized(modelGear.ref.name),
   name:selection.name,url:modelGear.ref.sourceUrl,type:'equipment',
   source:'unit-scoped-data',parentSourceUrl:url,
   verificationStatus:'source-extracted',evidence:'per-model-equipment-option',
   sourceQuantity:modelGear.quantity,
   note:'The unit page lists this per-model equipment option. The imported count ('+
    modelGear.quantity+') and paid points have not been verified.'};
 }
 const champion=publishedChampionOption(record,selection);
 if(champion){
  return {id:'unit-scoped:'+record.id+':champion:'+champion.sourceName,
   name:selection.name,url,type:'command',source:'unit-scoped-data',
   verificationStatus:'source-extracted',evidence:'published-champion-upgrade',
   note:'The parent unit lists the '+champion.option.description+
    '. Champion eligibility and points are not independently verified.'};
 }
 const optionalWizard=optionalWizardLevelOption(record,selection);
 if(optionalWizard){
  return {id:'unit-scoped:'+record.id+':wizard-level:'+optionalWizard.level,
   name:selection.name,url,type:'wizard-level',source:'unit-scoped-data',
   verificationStatus:'source-extracted',evidence:'published-wizard-upgrade',
   note:'The unit page lists '+optionalWizard.option.description+
    '. This is an optional upgrade, not a default wizard level.'};
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

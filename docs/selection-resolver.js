/**
 * Stage 2: one read-only evidence boundary for selected equipment and items.
 * A source URL and an imported name must agree before a reviewed item may
 * contribute an effect. Recorded model roles do not establish list legality.
 */
import {createGameScreenModel} from './game-screen-model.js';

const HOST='https://tow.whfb.app';
export const normalizeSelectionName=value=>String(value??'').normalize('NFKC')
 .toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const canonicalUrl=url=>{
 if(typeof url!=='string')return null;
 try{
  const u=new URL(url);
  if(u.origin!==HOST||u.search||u.hash||!/^\/[a-z0-9/-]+\/?$/.test(u.pathname))return null;
  return HOST+u.pathname.replace(/\/$/,'');
 }catch{return null;}
};
const list=value=>Array.isArray(value)?value:[];
const singular=value=>{
 const name=normalizeSelectionName(value);
 return name.endsWith('ies')?name.slice(0,-3)+'y':name.endsWith('s')&&!name.endsWith('ss')?name.slice(0,-1):name;
};
const childrenRole=selection=>{
 const role=selection?.modelRole||selection?.role;
 if(role==='champion'||role==='standardBearer'||role==='musician'||role==='rider'||role==='mount'||role==='crew')return role;
 // Parser's explicit, structured command qualifier, independent of faction titles.
 if(selection?.kind==='command'&&normalizeSelectionName(selection.qualifier)==='champion')return 'champion';
 if(selection?.kind==='command'&&normalizeSelectionName(selection.name)==='standard bearer')return 'standardBearer';
 if(selection?.reference?.id==='role:battle-standard-bearer')return 'standardBearer';
 return null;
};

// A magic standard needs an independently recorded bearer. The imported
// role and the matching source reference establish evidence of the selection,
// but do not establish army-list legality or that a joined character is legal.
function hasRecordedStandardBearer(unit,isCharacter){
 const seen=new Set();
 const unitUrl=canonicalUrl(unit.reference?.url);
 const visit=items=>list(items).some(selection=>{
  if(!selection||typeof selection!=='object'||seen.has(selection))return false;
  seen.add(selection);
  const role=childrenRole(selection);
  const reference=selection.reference;
  const matched=selection.matchStatus!=='unmatched';
  const explicit=(selection.modelRole==='standardBearer'||selection.role==='standardBearer')&&
   (isCharacter?
    reference?.id==='role:battle-standard-bearer'&&
     canonicalUrl(reference?.url)==='https://tow.whfb.app/characters/the-battle-standard-bearer-model':
    !!unitUrl&&canonicalUrl(reference?.url)===unitUrl);
  const bsb=reference?.id==='role:battle-standard-bearer'&&
   canonicalUrl(reference.url)==='https://tow.whfb.app/characters/the-battle-standard-bearer-model';
  const unitCommand=selection.kind==='command'&&role==='standardBearer'&&
   !!unitUrl&&canonicalUrl(reference?.url)===unitUrl;
  return matched&&(isCharacter?(explicit||bsb):(explicit||unitCommand))||visit(selection.children);
 });
 return visit(unit.selections)||list(unit.modelGroups).some(group=>visit(group.selections));
}

const hasRecordedMount=unit=>{
 const visit=selections=>list(selections).some(selection=>
  selection?.kind==='mount-or-component'&&selection?.reference?.type==='mount'||
  visit(selection?.children));
 return visit(unit.selections);
};

// This whitelist describes only the mundane pieces already used by the
// equipment-only Defence display; it does not infer any optional selections.
const MUNDANE=Object.freeze({
 'light armour':'light-armour','heavy armour':'heavy-armour',
 'full plate armour':'full-plate-armour','shield':'shield','shields':'shield',
 'great weapon':'great-weapon','great weapons':'great-weapon',
 'halberd':'halberd','halberds':'halberd','flail':'flail','flails':'flail',
 'double-handed weapon':'great-weapon','two-handed weapon':'great-weapon'
});

function identity(selection,catalogue,unit){
 const importedName=normalizeSelectionName(selection.name||selection.raw);
 const byName=Object.values(catalogue).filter(rule=>normalizeSelectionName(rule.name)===importedName);
 const ref=selection?.reference;
 const explicit=ref?.url!==undefined&&ref?.url!==null;
 const url=canonicalUrl(ref?.url);
 const candidate=byName.length===1?byName[0]:null;
 // A source URL does not overrule the importer's explicit rejected or
 // informational status. Unlabelled synthetic published defaults are allowed.
 if(selection.matchStatus&&selection.matchStatus!=='matched')
  return {status:'unresolved',reason:'Importer did not verify this selection reference',rule:null,url};
 if(byName.length>1)return {status:'ambiguous',reason:'Multiple canonical rules match the imported name',rule:null,url};
 if(candidate){
  const expected=canonicalUrl(candidate.sourceUrl);
  if(explicit&&url!==expected)return {status:'conflict',reason:'Imported name and source URL refer to different items',rule:null,url};
  // The importer has an established short ID for leading-article names,
  // e.g. item:loremasters-cloak, while its canonical URL includes "the-".
  const legacyArticleId=candidate.id.startsWith('the-')&&
   ref?.id==='item:'+candidate.id.slice(4);
  if(ref?.id&&ref.id!=='item:'+candidate.id&&!legacyArticleId)
   return {status:'conflict',reason:'Imported source ID and item name disagree',rule:null,url};
  if(!url)return {status:'unresolved',reason:'Reviewed item name has no canonical source URL',rule:null,url};
  return {status:'verified',reason:null,rule:candidate,url};
 }
 if(url?.startsWith(HOST+'/magic-item/'))return {status:'conflict',reason:'Source identifies a magic item whose imported name is not its canonical name',rule:null,url};
 const key=MUNDANE[importedName];
 if(key){
  const expected=HOST+'/weapons-of-war/'+key;
  // A selected unit option may link its source unit rather than the generic
  // Shield rule. Retain this provenance; the unit option is not a global item.
  const unitOption=key==='shield'&&url&&url===canonicalUrl(unit?.reference?.url)&&ref?.type==='option';
  if(url===expected||unitOption)return {status:'verified',reason:null,rule:{id:'equipment:'+key,name:selection.name,sourceUrl:expected,kind:'equipment'},url};
  return {status:explicit?'conflict':'unresolved',reason:'Mundane equipment lacks a consistent source reference',rule:null,url};
 }
 return {status:url?'unresolved':'unmatched',reason:'No reviewed effect identity established',rule:null,url};
}

/** A default can be removed only by a selected option and a matching,
 * verified source-extracted replacement instruction for this exact unit. */
function verifiedReplacedDefaults(unit,record){
 const removed=new Set();
 const defaults=list(record?.startingEquipment);
 const imported=[];
 // A model upgrade cannot replace starting equipment on the whole unit.
 // Scope remains constrained even when the same published option is named.
 const walk=(selections,modelScoped=false)=>{for(const selection of list(selections)){
  const scoped=modelScoped||!!childrenRole(selection);
  if(!scoped&&(!selection.matchStatus||selection.matchStatus==='matched'))imported.push(selection);
  walk(selection.children,scoped);
 }};
 walk(unit.selections);
 for(const group of list(record?.upgradeGroups)){
  const clause=normalizeSelectionName(group.eligibilityClause);
  const fromClause=clause.match(/\breplace\s+(?:its\s+|their\s+|the\s+)?(.+?)\s+with\b/);
  for(const option of list(group.options)){
   const refs=list(option.linkedReferences);
   const introduced=refs.filter(ref=>!defaults.some(d=>singular(d.name)===singular(ref.name)));
   // Both the selected item and the source option must identify the same URL.
   const selected=introduced.length>0&&introduced.every(ref=>{
    const expected=canonicalUrl(ref.sourceUrl||ref.reference?.url);
    return expected&&imported.some(s=>canonicalUrl(s.reference?.url)===expected&&
     singular(s.name||s.raw)===singular(ref.name));
   });
   if(!selected)continue;
   const description=normalizeSelectionName(option.description);
   if(!/\breplace\b.*\bwith\b/.test(clause+' '+description))continue;
   const replaced=refs.filter(ref=>defaults.some(d=>singular(d.name)===singular(ref.name)));
   for(const def of defaults){
    if((fromClause&&singular(fromClause[1])===singular(def.name))||
       replaced.some(ref=>singular(ref.name)===singular(def.name)&&
        canonicalUrl(ref.sourceUrl||ref.reference?.url)===canonicalUrl(def.sourceUrl)))
     removed.add(singular(def.name));
   }
  }
 }
 return removed;
}

function scope(unit,model,ancestors,group,selection){
 // A structured role may belong to the item itself or to a containing
 // command/model component group. Both are explicit ownership evidence.
 const role=[...ancestors,selection].reverse().map(childrenRole).find(Boolean)||null;
 const isCharacter=model?.isCharacter===true;
 if(role==='champion'||role==='standardBearer'||role==='musician')
  return {kind:'model-role',role,modelId:null,componentId:null,recipientId:unit.id,
   eligibility:'recorded-command-role',legalityVerified:false};
 if(role==='rider'||role==='mount'||role==='crew')
  return {kind:'component',role,modelId:null,componentId:null,recipientId:unit.id,
   eligibility:'component-identity-unresolved',legalityVerified:false};
 if(group){
  return {kind:'model-group',role:group.role||null,modelId:null,
   componentId:group.componentId||null,modelGroupId:group.id||null,recipientId:unit.id,
   eligibility:'group-known-individual-bearer-unresolved',legalityVerified:false};
 }
 if(isCharacter)return {kind:'character',role:'character',modelId:unit.id,componentId:null,
  recipientId:unit.id,eligibility:'imported-character',legalityVerified:false,
  mountedArmourChoice:hasRecordedMount(unit)?'unresolved':null};
 return {kind:'unit',role:null,modelId:null,componentId:null,recipientId:unit.id,
  eligibility:'individual-bearer-not-established',legalityVerified:false};
}

/**
 * @param {object} army Original parsed army
 * @param {object} options {catalogue: reviewed descriptors, unitRecords: verified source-extracted records}
 * @returns {Array<object>} One result per occurrence, including conflicts and duplicates.
 */
export function resolveSelections(army,{catalogue={},unitRecords={}}={}){
 const models=new Map(createGameScreenModel(army).units.map(model=>[model.id,model]));
 const result=[];
 for(const unit of list(army?.units)){
  const record=unitRecords[unit.id];
  const recordUrl=canonicalUrl(record?.source?.sourceUrl);
  const sourceVerified=record?.source?.verificationStatus==='source-extracted'&&
   !!recordUrl&&recordUrl.startsWith(HOST+'/unit/')&&
   recordUrl===canonicalUrl(unit?.reference?.url)&&
   (!record?.id||record.id==='unit:'+recordUrl.slice((HOST+'/unit/').length));
  const recordedBearer=hasRecordedStandardBearer(unit,models.get(unit.id)?.isCharacter===true);
  const replaced=sourceVerified?verifiedReplacedDefaults(unit,record):new Set();
  const visited=new Set();
  const seen=new Map();
  const walk=(selections,ancestors=[],group=null,origin='explicit')=>{
   for(const selection of list(selections)){
    if(!selection||typeof selection!=='object'||visited.has(selection))continue;
    visited.add(selection);
    const id=identity(selection,catalogue,unit);
    let owner=scope(unit,models.get(unit.id),ancestors,group,selection);
    if(id.rule?.scope==='standard'&&recordedBearer&&owner.kind==='unit')
     owner={...owner,kind:'model-role',role:'standardBearer',
      eligibility:'recorded-command-role',legalityVerified:false};
    const role=owner.role;
    const ownerUnknown=id.rule&&id.rule.kind!=='equipment'&&
     ((owner.kind==='unit'&&id.rule.scope!=='standard')||
      owner.kind==='model-group'||owner.kind==='component');
    const scopeMismatch=id.rule?.scope==='standard'&&owner.kind==='model-role'&&
     owner.role!=='standardBearer';
    const missingBearer=id.rule?.scope==='standard'&&!recordedBearer;
    const status=id.status==='verified'&&(ownerUnknown||scopeMismatch||missingBearer)?'unresolved':id.status;
    const reason=id.status==='verified'&&scopeMismatch?'Standard assigned to an incompatible command role':
     missingBearer&&id.status==='verified'?'Magic standard requires a recorded standard bearer or Battle Standard Bearer':
     ownerUnknown&&id.status==='verified'?'Individual item bearer or component not established':id.reason;
    const fingerprint=[id.rule?.id||id.url||normalizeSelectionName(selection.name),
     id.rule?.scope==='standard'?'standard':owner.kind,
     id.rule?.scope==='standard'?'':owner.role||'',group?.id||'',origin].join('|');
    const duplicateOf=id.rule&&status==='verified'&&seen.has(fingerprint)?seen.get(fingerprint):null;
    const entry={canonicalIdentity:id.rule?.id||null,canonicalSourceUrl:id.rule?.sourceUrl||null,
     sourceUrl:id.url,original:selection,selectedItem:id.rule||null,
     selection,selectionPath:[...ancestors.map(s=>s.name||s.raw),selection.name||selection.raw],
     ownerUnitId:unit.id,ownerUnitName:unit.name,ownerModel:owner,
     scope:owner,verificationStatus:status,conflict:status==='conflict'?reason:null,
     unresolved:status==='unresolved'||status==='ambiguous'?reason:null,
     duplicateOf,origin,sourceProvenance:{importedUrl:selection.reference?.url||null,
      importedId:selection.reference?.id||null,canonicalUrl:id.rule?.sourceUrl||null,
      recordUrl:sourceVerified?record.source.sourceUrl:null,matchStatus:selection.matchStatus||null},
     replacementOf:list(selection.replaces).map(ref=>ref.url||ref.name||ref).filter(Boolean)};
    result.push(entry);
    if(status==='verified'&&!duplicateOf)seen.set(fingerprint,selection.id||String(result.length));
    walk(selection.children,[...ancestors,selection],group,origin);
   }
  };
  walk(unit.selections);
  for(const group of list(unit.modelGroups))walk(group.selections,[],group);
  // Published defaults require a matching, source-extracted unit record. Do
  // not traverse optional rules, upgrade groups or raw catalogue options.
  if(sourceVerified){
   for(const published of list(record.startingEquipment)){
    const name=published.name;
    if(!name||replaced.has(singular(name))||result.some(r=>r.ownerUnitId===unit.id&&
     r.verificationStatus==='verified'&&r.scope.kind!=='model-group'&&
     r.scope.kind!=='component'&&r.origin==='explicit'&&
     (r.canonicalSourceUrl===canonicalUrl(published.sourceUrl)||
       normalizeSelectionName(r.selection.name)===normalizeSelectionName(name))))continue;
    const defaultSel={name,kind:'published-default',reference:{url:published.sourceUrl}};
    walk([defaultSel],[],null,'verified-published-default');
   }
  }
 }
 return result;
}

/** Whether a resolved item can actually be projected for its own bearer. */
export function itemEligible(entry){
 return entry?.verificationStatus==='verified'&&!entry.duplicateOf&&
  (entry.scope.kind==='character'||
   (entry.scope.kind==='model-role'&&
    (entry.selectedItem?.scope!=='standard'||entry.scope.role==='standardBearer'))||
   (entry.scope.kind==='unit'&&entry.selectedItem?.scope==='standard'));
}

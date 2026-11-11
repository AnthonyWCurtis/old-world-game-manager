/**
 * Accessible DOM-created Game Screen controls for player-confirmed spells.
 * A wizard's selected lore is NOT evidence of learned spells or a successful cast.
 */
import {SPELL_RULES,eligibleWizardSpells,spellEffectsFor} from './spell-engine.js';
import {createGameScreenModel} from './game-screen-model.js';
import {unitDisplayName} from './player-customization.js';

const node=(doc,tag,cls='',value)=>{
 const result=doc.createElement(tag);
 if(cls)result.className=cls;
 if(value!==undefined)result.textContent=value;
 return result;
};
const safeSource=(doc,rule)=>{
 const anchor=node(doc,'a','game-spell-source','Source: '+rule.name);
 anchor.href=rule.sourceUrl;
 anchor.target='_blank';
 anchor.rel='noopener noreferrer';
 return anchor;
};
const nameFor=(id,map,session)=>unitDisplayName(map.get(id),session);

export function renderSpellControls(container,army,session,{onCast=()=>{},onEnd=()=>{},onExpire=()=>{}}={}){
 const doc=container.ownerDocument||document;
 const roster=createGameScreenModel(army);
 const entries=new Map(roster.units.map(unit=>[unit.id,unit]));
 const assignments=session?.assignments||{};
 const casters=eligibleWizardSpells(army);
 const active=session?.activeSpells||[];
 container.replaceChildren();
 const head=node(doc,'div','game-spell-heading');
 head.append(node(doc,'h2','','Magic & active effects'));
 head.append(node(doc,'span','',active.length+' active'));
 container.append(head);
 container.append(node(doc,'p','game-spell-disclosure',
  'Player-confirmed tracking only. A selected lore is not proof a Wizard knows a spell. Confirm spell knowledge, successful casting, range, eligible target and phase at the table.'));
 if(active.length){
  const activeList=node(doc,'div','game-active-spells');
  activeList.append(node(doc,'h3','','Currently recorded'));
  for(const spell of active){
   const rule=SPELL_RULES[spell.spellId];
   if(!rule)continue;
   const area=node(doc,'div','game-active-spell');
   area.dataset.spellId=spell.spellId;
   area.dataset.casterId=spell.casterId;
   area.append(node(doc,'strong','',rule.name));
   const target=spell.spellId==='earthen-ramparts'
    ?'Target: '+nameFor(spell.targetId,entries,session)
    :'Self: '+nameFor(spell.casterId,entries,session)+
     (spell.joinedUnitId?' + joined '+nameFor(spell.joinedUnitId,entries):' (independent)');
   area.append(node(doc,'div','game-spell-activity',target));
   area.append(node(doc,'div','game-spell-activity',
    'Caster: '+nameFor(spell.casterId,entries,session)+' · until your next Start of Turn · player-declared'));
   const warnings=spellEffectsFor(army,session,spell.casterId).warnings;
   for(const warning of warnings)area.append(node(doc,'p','game-spell-warning',warning));
   area.append(safeSource(doc,rule));
   const button=node(doc,'button','game-spell-end','End / dispelled');
   button.type='button';
   button.setAttribute('aria-label','End '+rule.name+' cast by '+nameFor(spell.casterId,entries,session));
   button.addEventListener('click',()=>onEnd({spellId:spell.spellId,casterId:spell.casterId}));
   area.append(button);
   activeList.append(area);
  }
  const expire=node(doc,'button','game-spell-expire','Expire at my next Start of Turn');
  expire.type='button';
  expire.addEventListener('click',()=>onExpire());
  activeList.append(expire);
  container.append(activeList);
 }else{
  container.append(node(doc,'p','game-spell-empty','No active enchantments recorded.'));
 }
 if(!casters.length){
  container.append(node(doc,'p','game-spell-empty','No imported Wizard with Elementalism or Illusion was identified. Nothing is activated automatically.'));
  return;
 }
 const candidates=node(doc,'div','game-spell-candidates');
 for(const caster of casters){
  const rule=SPELL_RULES[caster.spellId];
  const card=node(doc,'details','game-spell-caster');
  card.dataset.casterId=caster.casterId;
  card.dataset.spellId=rule.id;
  const summary=node(doc,'summary','',rule.name+' · '+unitDisplayName(entries.get(caster.casterId),session)+' (entry '+caster.casterIndex+')');
  card.append(summary);
  const body=node(doc,'div','game-spell-caster-body');
  body.append(node(doc,'p','game-spell-activity',
   rule.lore+' · Enchantment · cast '+rule.castingValue+' · range '+rule.range+
   ' · until your next Start of Turn'));
  if(caster.knownStatus==='requires-player-confirmation'){
   body.append(node(doc,'p','game-spell-warning',
    'Lore selected; the export does not confirm this particular spell was generated or learned.'));
  }
  body.append(safeSource(doc,rule));
  let picker=null;
  if(rule.targeting==='friendly-unit'){
   const selectLabel=node(doc,'label','game-spell-target-label','Friendly target unit');
   picker=node(doc,'select','game-spell-target');
   picker.id='spell-target-'+caster.casterId+'-'+rule.id;
   selectLabel.htmlFor=picker.id;
   picker.setAttribute('aria-label','Target for '+rule.name+' cast by '+caster.casterName);
   const targetChoices=[
    ...roster.regiments,
    ...roster.characters.filter(c=>!assignments[c.id])
   ];
   for(const unit of targetChoices){
    const option=node(doc,'option','',unitDisplayName(unit,session)+' · entry '+unit.index);
    option.value=unit.id;picker.append(option);
   }
   body.append(selectLabel,picker);
  }else{
   body.append(node(doc,'p','game-spell-activity',
    'Range Self — targets the caster and, when applicable, the unit they have joined. No target selector.'));
  }
  const confirmation=node(doc,'label','game-spell-confirm-label');
  const checkbox=node(doc,'input','game-spell-confirm');
  checkbox.type='checkbox';
  checkbox.setAttribute('aria-label','I confirm '+caster.casterName+' knows '+rule.name+' and successfully cast it');
  confirmation.append(checkbox,node(doc,'span','',
   'I confirm this Wizard knows the spell, successfully cast it, and valid range, target and phase were checked.'));
  body.append(confirmation);
  const activate=node(doc,'button','game-spell-cast','Record successful cast');
  activate.type='button';
  activate.disabled=true;
  checkbox.addEventListener('change',()=>{activate.disabled=!checkbox.checked;});
  activate.addEventListener('click',()=>{
   if(!checkbox.checked)return;
   onCast({spellId:rule.id,casterId:caster.casterId,
    targetId:picker?.value||null,confirmed:true});
  });
  body.append(activate);
  card.append(body);candidates.append(card);
 }
 container.append(candidates);
}

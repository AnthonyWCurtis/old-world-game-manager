/** Player-declared spell controls, sourced from each wizard's saved known spells. */
import {SPELL_RULES,selectedWizardSpells,spellEffectsFor} from './spell-engine.js';
import {createGameScreenModel} from './game-screen-model.js';
import {unitDisplayName} from './player-customization.js';
import {renderEffectRow} from './effects-ui.js';

const node=(doc,tag,cls='',value)=>{
 const result=doc.createElement(tag);
 if(cls)result.className=cls;
 if(value!==undefined)result.textContent=String(value);
 return result;
};
const safeSource=(doc,rule)=>{
 const anchor=node(doc,'a','game-spell-source','View spell rule');
 anchor.href=rule.sourceUrl||rule.spellUrl;
 anchor.target='_blank';anchor.rel='noopener noreferrer';
 return anchor;
};
const nameFor=(id,map,session)=>unitDisplayName(map.get(id),session);
const phases={Enchantment:'Strategy · Conjuration',Hex:'Strategy · Conjuration',
 Conveyance:'Movement · Remaining Moves', 'Magic Missile':'Shooting',
 'Magical Vortex':'Shooting',Assailment:'Combat'};
const openKey=(spellId,casterId)=>spellId+':'+casterId;


/**
 * Wizard profiles use one compact spell list. An ongoing effect is displayed
 * in its spell row, never again in a separate "Currently in play" section.
 * Mechanics and persistence remain delegated to the existing spell engine.
 */
const compactEffectCopy=Object.freeze({
 'earthen-ramparts':'Ward 5+ · Cannot march/charge',
 'glittering-robe':'−1 enemy To Hit',
 'plague-of-rust':'−2 armour value',
 'travel-mystical-pathway':'Movement recorded',
 'drain-magic':'+2 enemy casting value'
});

function appendWizardCastForm(doc,parent,rule,caster,roster,assignments,session,onCast){
 let picker=null,enemyInput=null;
 if(rule.targeting==='friendly-unit'){
  const label=node(doc,'label','game-spell-target-label','Friendly target unit');
  picker=node(doc,'select','game-spell-target');
  picker.id='spell-target-'+caster.casterId+'-'+rule.id;
  label.htmlFor=picker.id;
  picker.setAttribute('aria-label','Target for '+rule.name+' cast by '+caster.casterName);
  const choices=[...roster.regiments,...roster.characters.filter(u=>!assignments[u.id])];
  for(const unit of choices){
   const option=node(doc,'option','',unitDisplayName(unit,session)+' · entry '+unit.index);
   option.value=unit.id;picker.append(option);
  }
  parent.append(label,picker);
 }else if(rule.targeting==='enemy-unit'){
  const label=node(doc,'label','game-spell-target-label','Enemy target unit');
  enemyInput=node(doc,'input','game-spell-enemy-name');
  enemyInput.type='text';enemyInput.maxLength=100;
  enemyInput.placeholder='Enemy unit name';
  enemyInput.setAttribute('aria-label','Enemy unit targeted by '+rule.name);
  label.append(enemyInput);parent.append(label);
 }else{
  parent.append(node(doc,'p','game-spell-activity',
   rule.id==='drain-magic'?'Range Self · Remains in Play; check Wizards within 24".':
   'Range Self · affects the caster and eligible joined unit.'));
 }
 if(rule.id==='travel-mystical-pathway'){
  parent.append(node(doc,'p','game-spell-warning',
   'Movement is immediate. Confirm the target has not moved or fled, its placement limits and the restriction on further movement.'));
 }
 const confirmation=node(doc,'label','game-spell-confirm-label');
 const checkbox=node(doc,'input','game-spell-confirm');
 checkbox.type='checkbox';
 checkbox.setAttribute('aria-label','I confirm '+caster.casterName+' knows '+rule.name+' and successfully cast it');
 confirmation.append(checkbox,node(doc,'span','',
  'I confirm a successful cast and checked range, phase and target.'));
 parent.append(confirmation);
 const activate=node(doc,'button','game-spell-cast',
  rule.lifecycle==='instant'?'Record completed movement':
  rule.lifecycle==='remains-in-play'?'Mark Remains in Play':'Mark active on target');
 activate.type='button';activate.disabled=true;
 const update=()=>{activate.disabled=!checkbox.checked||
  (rule.targeting==='friendly-unit'&&!picker?.value)||
  (rule.targeting==='enemy-unit'&&!enemyInput?.value.trim());};
 checkbox.addEventListener('change',update);
 enemyInput?.addEventListener('input',update);
 activate.addEventListener('click',()=>{
  if(activate.disabled||!checkbox.checked)return;
  onCast({spellId:rule.id,casterId:caster.casterId,targetId:picker?.value||null,
   enemyName:enemyInput?.value.trim()||null,confirmed:true});
 });
 parent.append(activate);
}

function renderCompactWizardSpells(container,army,session,actions,magicIndex,wizardId,openedKeys){
 const {onCast=()=>{},onEnd=()=>{},onExpire=()=>{},onClearEvent=()=>{}}=actions;
 const doc=container.ownerDocument||document;
 const roster=createGameScreenModel(army);
 const entries=new Map(roster.units.map(u=>[u.id,u]));
 const assignments=session?.assignments||{};
 const chosen=selectedWizardSpells(army,session,magicIndex)
  .filter(spell=>spell.casterId===wizardId).map(spell=>({...spell,isKnown:true}));
 const active=(session?.activeSpells||[]).filter(effect=>effect.casterId===wizardId);
 const events=(session?.spellEvents||[]).filter(event=>event.casterId===wizardId);
 const opened=new Set(openedKeys||[...container.querySelectorAll('.game-spell-caster[open]')]
  .map(el=>openKey(el.dataset.spellId,el.dataset.casterId)));
 container.replaceChildren();
 // Retain a way to end an effect or clear movement even if its former known
 // spell was unchecked afterwards. Such rows are never automatically castable.
 const all=[...chosen],seen=new Set(chosen.map(s=>s.spellId||s.spellName));
 for(const record of [...active,...events]){
  if(seen.has(record.spellId))continue;
  const rule=SPELL_RULES[record.spellId];
  if(!rule)continue;
  all.push({casterId:wizardId,casterName:nameFor(wizardId,entries,session),
   spellName:rule.name,spellId:rule.id,rule,spellUrl:rule.sourceUrl,isKnown:false});
  seen.add(record.spellId);
 }
 if(!all.length){
  container.append(node(doc,'p','owc-magic-empty','No known spells yet. Select them in Edit spells below.'));
  return;
 }
 const list=node(doc,'div','owc-magic-spells');
 for(const caster of all){
  const rule=caster.rule;
  const id=rule?.id||caster.spellId||caster.spellName;
  const effect=active.find(e=>e.spellId===id);
  const event=events.find(e=>e.spellId===id);
  const card=node(doc,'details','game-spell-caster owc-magic-spell'+
   (effect?' owc-magic-active':'')+(event?' owc-magic-recorded':''));
  card.dataset.casterId=wizardId;card.dataset.spellId=id;
  card.open=opened.has(openKey(id,wizardId));
  const summary=node(doc,'summary','owc-magic-spell-summary');
  const headline=node(doc,'span','owc-magic-spell-headline');
  headline.append(node(doc,'span','owc-magic-spell-name',caster.spellName));
  headline.append(node(doc,'span','owc-magic-spell-state'+
   (effect?' owc-magic-state-active':''),effect?'ACTIVE':event?'RECORDED':
   !rule?'RULES ONLY':'Cast'));
  summary.append(headline);
  if(effect&&rule){
   const target=rule.targeting==='friendly-unit'?nameFor(effect.targetId,entries,session):
    rule.targeting==='enemy-unit'?effect.enemyName:
    nameFor(effect.casterId,entries,session)+
     (effect.joinedUnitId?' + '+nameFor(effect.joinedUnitId,entries,session):'');
   summary.append(node(doc,'span','owc-magic-spell-note',
    target+' · '+(compactEffectCopy[rule.id]||rule.type)));
  }else if(event&&rule){
   summary.append(node(doc,'span','owc-magic-spell-note',
    nameFor(event.targetId,entries,session)+' · Cannot move again this Movement phase'));
  }
  card.append(summary);
  const body=node(doc,'div','game-spell-caster-body owc-magic-spell-body');
  if(!rule){
   body.append(node(doc,'p','game-spell-warning',
    'This selected spell has a source link, but no reviewed battle effect. No effect is applied automatically.'));
   body.append(safeSource(doc,caster));
   card.append(body);list.append(card);continue;
  }
  body.append(node(doc,'p','game-spell-activity',
   rule.lore+' · '+rule.type+' · cast '+rule.castingValue+' · range '+rule.range+
   ' · '+rule.duration));
  body.append(node(doc,'p','game-spell-activity',
   'Phase: '+(phases[rule.type]||'Check published rules')));
  if(rule.effectSummary)body.append(node(doc,'p','game-spell-policy',rule.effectSummary));
  const warnings=effect?spellEffectsFor(army,session,wizardId).warnings:[];
  for(const warning of warnings)body.append(node(doc,'p','game-spell-warning',warning));
  body.append(safeSource(doc,rule));
  if(effect){
   const end=node(doc,'button','game-spell-end','End / dispelled');
   end.type='button';
   end.setAttribute('aria-label','End '+rule.name+' cast by '+caster.casterName);
   end.addEventListener('click',()=>onEnd({spellId:id,casterId:wizardId}));
   body.append(end);
   if(rule.lifecycle==='duration'){
    const expire=node(doc,'button','game-spell-expire',
     'Next Start of Turn · expire all temporary spells');
    expire.type='button';
    expire.title='This expires temporary spells for all Wizards. Remains in Play spells are not ended.';
    expire.addEventListener('click',()=>onExpire());
    body.append(expire);
   }
  }
  if(event){
   const clear=node(doc,'button','game-spell-clear-event','Clear movement record');
   clear.type='button';
   clear.addEventListener('click',()=>onClearEvent({
    spellId:event.spellId,casterId:wizardId,targetId:event.targetId}));
   body.append(clear);
  }
  if(caster.isKnown){
   if(effect||event){
    const again=node(doc,'details','owc-magic-record-again');
    again.append(node(doc,'summary','','Record another cast'));
    const fields=node(doc,'div','owc-magic-record-again-body');
    appendWizardCastForm(doc,fields,rule,caster,roster,assignments,session,onCast);
    again.append(fields);body.append(again);
   }else{
    appendWizardCastForm(doc,body,rule,caster,roster,assignments,session,onCast);
   }
  }else{
   body.append(node(doc,'p','game-spell-disclosure',
    'Not currently selected as known. Open Edit spells to restore it to this Wizard’s spellbook.'));
  }
  card.append(body);list.append(card);
 }
 container.append(list);
}

export function renderSpellControls(container,army,session,
 {onCast=()=>{},onEnd=()=>{},onExpire=()=>{},onClearEvent=()=>{},
  onItemState=()=>{},onShieldUse=()=>{}}={},magicIndex=null,effectProjection=null,
 {wizardId=null,openedKeys=null}={}){
 if(wizardId)return renderCompactWizardSpells(container,army,session,
  {onCast,onEnd,onExpire,onClearEvent},magicIndex,wizardId,openedKeys);
 const doc=container.ownerDocument||document;
 const roster=createGameScreenModel(army),entries=new Map(roster.units.map(u=>[u.id,u]));
 const assignments=session?.assignments||{};
 const casters=selectedWizardSpells(army,session,magicIndex)
  .filter(spell=>!wizardId||spell.casterId===wizardId);
 const active=(session?.activeSpells||[]).filter(effect=>!wizardId||effect.casterId===wizardId);
 const events=(session?.spellEvents||[]).filter(event=>!wizardId||event.casterId===wizardId);
 const activeItems=(effectProjection?.owned||[])
  .filter(item=>!wizardId&&item.status==='active');
 const opened=new Set(openedKeys||[...container.querySelectorAll('.game-spell-caster[open]')]
  .map(el=>openKey(el.dataset.spellId,el.dataset.casterId)));
 container.replaceChildren();
 if(wizardId){
  const head=node(doc,'div','owc-wizard-casting-heading');
  head.append(node(doc,'h4','','Cast known spells'));
  head.append(node(doc,'span','',active.length+' active · '+events.length+' movement recorded'));
  container.append(head);
 }else{
  const head=node(doc,'div','game-spell-heading');
  head.append(node(doc,'h2','','Magic & active effects'));
  head.append(node(doc,'span','',active.length+' spells active · '+activeItems.length+
   ' items active · '+events.length+' movement'));
  container.append(head);
  container.append(node(doc,'p','game-spell-disclosure',
   'Choose known spells, confirm a successful legal cast, then record targets and effects. Dice, range, phase and eligibility remain player-confirmed.'));
 }

 const activeList=node(doc,'div','game-active-spells');
 activeList.append(node(doc,'h3','','Currently in play'));
 for(const effect of active){
  const rule=SPELL_RULES[effect.spellId];
  if(!rule)continue;
  const area=node(doc,'div','game-active-spell');
  area.dataset.spellId=effect.spellId;
  area.dataset.casterId=effect.casterId;
  area.append(node(doc,'strong','',rule.name+' · ACTIVE'));
  let target;
  if(rule.targeting==='friendly-unit')target='Friendly unit: '+nameFor(effect.targetId,entries,session);
  else if(rule.targeting==='enemy-unit')target='Enemy unit: '+effect.enemyName;
  else target='Caster: '+nameFor(effect.casterId,entries,session)+
   (effect.joinedUnitId&&rule.id==='glittering-robe'?
    ' + joined '+nameFor(effect.joinedUnitId,entries,session):'');
  area.append(node(doc,'div','game-spell-activity',target));
  area.append(node(doc,'div','game-spell-activity',
   'Cast by '+nameFor(effect.casterId,entries,session)+' · '+rule.duration));
  if(rule.effectSummary)area.append(node(doc,'p','game-spell-activity',rule.effectSummary));
  const warnings=spellEffectsFor(army,session,effect.casterId).warnings;
  for(const warning of warnings)area.append(node(doc,'p','game-spell-warning',warning));
  area.append(safeSource(doc,rule));
  const end=node(doc,'button','game-spell-end','End / dispelled');
  end.type='button';
  end.setAttribute('aria-label','End '+rule.name+' cast by '+nameFor(effect.casterId,entries,session));
  end.addEventListener('click',()=>onEnd({spellId:effect.spellId,casterId:effect.casterId}));
  area.append(end);activeList.append(area);
 }
 if(!active.length&&!wizardId)activeList.append(node(doc,'p','game-spell-empty','No ongoing spell effects recorded.'));
 if(activeItems.length){
  const itemPanel=node(doc,'section','game-active-items');
  itemPanel.append(node(doc,'h4','','Active item buffs'));
  for(const item of activeItems)
   itemPanel.append(renderEffectRow(doc,item,{onItemState,onShieldUse}));
  activeList.append(itemPanel);
 }
 if(events.length){
  const resolved=node(doc,'div','game-spell-events');
  resolved.append(node(doc,'h3','','Movement phase — already resolved'));
  for(const event of events){
   if(event.spellId!=='travel-mystical-pathway')continue;
   const item=node(doc,'div','game-spell-event');
   item.append(node(doc,'strong','','Travel Mystical Pathway · movement recorded'));
   item.append(node(doc,'p','game-spell-activity',
    'Unit: '+nameFor(event.targetId,entries,session)+' · cast by '+nameFor(event.casterId,entries,session)+
    ' · cannot move again this Movement phase'));
   item.append(safeSource(doc,SPELL_RULES['travel-mystical-pathway']));
   const clear=node(doc,'button','game-spell-clear-event','Clear movement record');
   clear.type='button';
   clear.addEventListener('click',()=>onClearEvent({
    spellId:event.spellId,casterId:event.casterId,targetId:event.targetId}));
   item.append(clear);resolved.append(item);
  }
  activeList.append(resolved);
 }
 if(active.some(s=>SPELL_RULES[s.spellId]?.lifecycle==='duration')||events.length){
  const expire=node(doc,'button','game-spell-expire',wizardId?
   'Next Start of Turn · expire all temporary spells':
   'Expire temporary spells at my next Start of Turn');
  expire.type='button';expire.addEventListener('click',()=>onExpire());
  activeList.append(expire);
  activeList.append(node(doc,'p','game-spell-disclosure',
   'Drain Magic remains in play and is NOT cleared by this turn-expiry button. End it individually when appropriate.'));
 }
 if(active.length||events.length||activeItems.length)container.append(activeList);
 if(!casters.length){
  container.append(node(doc,'p','game-spell-empty',wizardId?
   'Choose a known spell above to enable casting. Selecting a spell does not cast it.':
   'No selectable known spells yet. Choose spells inside each Wizard profile.'));
  return;
 }
 const grouped=new Map();
 for(const spell of casters){
  const list=grouped.get(spell.casterId)||[];
  list.push(spell);grouped.set(spell.casterId,list);
 }
 for(const [casterId,known] of grouped){
  const group=node(doc,'section','game-wizard-casting-group');
  group.dataset.casterId=casterId;
  if(!wizardId)group.append(node(doc,'h3','',nameFor(casterId,entries,session)+' · '+known.length+' known spells'));
  const candidates=node(doc,'div','game-spell-candidates');
  for(const caster of known){
   const rule=caster.rule;
   const card=node(doc,'details','game-spell-caster');
   card.dataset.casterId=caster.casterId;
   card.dataset.spellId=rule?.id||caster.spellName;
   card.open=opened.has(openKey(card.dataset.spellId,caster.casterId));
   const isActive=active.some(e=>e.spellId===rule?.id&&e.casterId===casterId);
   const summary=node(doc,'summary','',caster.spellName+
    (isActive?' · ACTIVE':'')+(wizardId?'':' · '+nameFor(caster.casterId,entries,session)));
   card.append(summary);
   const body=node(doc,'div','game-spell-caster-body');
   if(!rule){
    body.append(node(doc,'p','game-spell-warning',
     'This known spell has a source reference, but no reviewed battle-effect implementation yet. No automatic effect is applied.'));
    body.append(safeSource(doc,caster));card.append(body);candidates.append(card);
    continue;
   }
   body.append(node(doc,'p','game-spell-activity',
    rule.lore+' · '+rule.type+' · cast '+rule.castingValue+' · range '+rule.range+
    ' · '+rule.duration));
   body.append(node(doc,'p','game-spell-activity','Phase: '+(phases[rule.type]||'Check published rules')));
   if(rule.effectSummary)body.append(node(doc,'p','game-spell-policy',rule.effectSummary));
   body.append(safeSource(doc,rule));
   let picker=null,enemyInput=null;
   if(rule.targeting==='friendly-unit'){
    const label=node(doc,'label','game-spell-target-label','Friendly target unit');
    picker=node(doc,'select','game-spell-target');
    picker.id='spell-target-'+caster.casterId+'-'+rule.id;
    label.htmlFor=picker.id;
    picker.setAttribute('aria-label','Target for '+rule.name+' cast by '+caster.casterName);
    const choices=[...roster.regiments,...roster.characters.filter(u=>!assignments[u.id])];
    for(const unit of choices){
     const option=node(doc,'option','',unitDisplayName(unit,session)+' · entry '+unit.index);
     option.value=unit.id;picker.append(option);
    }
    body.append(label,picker);
   }else if(rule.targeting==='enemy-unit'){
    const label=node(doc,'label','game-spell-target-label','Enemy target unit (manual name)');
    enemyInput=node(doc,'input','game-spell-enemy-name');
    enemyInput.type='text';enemyInput.maxLength=100;
    enemyInput.placeholder='e.g. Enemy Knights';
    enemyInput.setAttribute('aria-label','Enemy unit targeted by '+rule.name);
    body.append(label,enemyInput);
    label.append(enemyInput);
    body.append(node(doc,'p','game-spell-disclosure',
     'This enemy is not in your imported friendly roster; type its name and confirm the target at the table.'));
   }else{
    body.append(node(doc,'p','game-spell-activity',
     rule.id==='drain-magic'?'Range Self — a Remains in Play effect centred on this Wizard; enemy Wizards within 24" are affected.':
     'Range Self — affects this caster and, when applicable, the unit they have joined.'));
   }
   if(rule.id==='travel-mystical-pathway')
    body.append(node(doc,'p','game-spell-warning',
     'This is immediate movement, not an ongoing enchantment. Check the unit has not already moved or fled, and the 12" / 6" placement limits. The target cannot move again this Movement phase.'));
   const confirmation=node(doc,'label','game-spell-confirm-label');
   const checkbox=node(doc,'input','game-spell-confirm');
   checkbox.type='checkbox';
   checkbox.setAttribute('aria-label','I confirm '+caster.casterName+' knows '+rule.name+' and successfully cast it');
   confirmation.append(checkbox,node(doc,'span','',
    'I confirm a successful cast and checked range, phase and target restrictions.'));
   body.append(confirmation);
   const activate=node(doc,'button','game-spell-cast',
    rule.lifecycle==='instant'?'Record completed movement':
    rule.lifecycle==='remains-in-play'?'Mark Remains in Play':'Mark active on target');
   activate.type='button';activate.disabled=true;
   const update=()=>{activate.disabled=!checkbox.checked||
    (rule.targeting==='friendly-unit'&&!picker?.value)||
    (rule.targeting==='enemy-unit'&&!enemyInput?.value.trim());};
   checkbox.addEventListener('change',update);
   enemyInput?.addEventListener('input',update);
   activate.addEventListener('click',()=>{
    if(activate.disabled||!checkbox.checked)return;
    onCast({spellId:rule.id,casterId:caster.casterId,targetId:picker?.value||null,
     enemyName:enemyInput?.value.trim()||null,confirmed:true});
   });
   body.append(activate);
   card.append(body);candidates.append(card);
  }
  group.append(candidates);container.append(group);
 }
}

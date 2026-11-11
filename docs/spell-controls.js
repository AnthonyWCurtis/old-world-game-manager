/** Player-declared spell controls, sourced from each wizard's saved known spells. */
import {SPELL_RULES,selectedWizardSpells,spellEffectsFor} from './spell-engine.js';
import {createGameScreenModel} from './game-screen-model.js';
import {unitDisplayName} from './player-customization.js';

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

export function renderSpellControls(container,army,session,
 {onCast=()=>{},onEnd=()=>{},onExpire=()=>{},onClearEvent=()=>{}}={},magicIndex=null){
 const doc=container.ownerDocument||document;
 const roster=createGameScreenModel(army),entries=new Map(roster.units.map(u=>[u.id,u]));
 const assignments=session?.assignments||{};
 const casters=selectedWizardSpells(army,session,magicIndex);
 const active=session?.activeSpells||[],events=session?.spellEvents||[];
 const opened=new Set([...container.querySelectorAll('.game-spell-caster[open]')]
  .map(el=>openKey(el.dataset.spellId,el.dataset.casterId)));
 container.replaceChildren();
 const head=node(doc,'div','game-spell-heading');
 head.append(node(doc,'h2','','Magic & active effects'));
 head.append(node(doc,'span','',active.length+' active · '+events.length+' movement'));
 container.append(head);
 container.append(node(doc,'p','game-spell-disclosure',
  'These are the spells you selected in each Wizard’s spellbook. Tap a spell, choose its target where required, confirm a successful legal cast, then record it. Known does not mean active. Dice, range, phase and eligibility remain player-confirmed.'));

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
 if(!active.length)activeList.append(node(doc,'p','game-spell-empty','No ongoing spell effects recorded.'));
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
  const expire=node(doc,'button','game-spell-expire','Expire temporary spells at my next Start of Turn');
  expire.type='button';expire.addEventListener('click',()=>onExpire());
  activeList.append(expire);
  activeList.append(node(doc,'p','game-spell-disclosure',
   'Drain Magic remains in play and is NOT cleared by this turn-expiry button. End it individually when appropriate.'));
 }
 container.append(activeList);

 if(!casters.length){
  container.append(node(doc,'p','game-spell-empty',
   'No selectable known spells yet. Open the Wizard cards below and tick their spells in Known spells. Once saved, they appear here. The magic index must be available to verify their lores.'));
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
  group.append(node(doc,'h3','',nameFor(casterId,entries,session)+' · '+known.length+' known spells'));
  const candidates=node(doc,'div','game-spell-candidates');
  for(const caster of known){
   const rule=caster.rule;
   const card=node(doc,'details','game-spell-caster');
   card.dataset.casterId=caster.casterId;
   card.dataset.spellId=rule?.id||caster.spellName;
   card.open=opened.has(openKey(card.dataset.spellId,caster.casterId));
   const isActive=active.some(e=>e.spellId===rule?.id&&e.casterId===casterId);
   const summary=node(doc,'summary','',caster.spellName+
    (isActive?' · ACTIVE':'')+' · '+nameFor(caster.casterId,entries,session));
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

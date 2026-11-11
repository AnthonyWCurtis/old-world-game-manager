/** Compact, read-only battle dashboard. Facts come from imported data and
 * player-confirmed battle state, never from guessed outcomes or rules. */
import {SPELL_RULES,selectedWizardSpells} from './spell-engine.js';
import {unitDisplayName} from './player-customization.js';
import {createGameScreenModel} from './game-screen-model.js';

const el=(doc,tag,cls='',value)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(value!==undefined)node.textContent=String(value);
 return node;
};
function action(doc,tab,label){
 const b=el(doc,'button','game-overview-action',label);
 b.type='button';b.dataset.gameTab=tab;
 return b;
}
const fmtName=(unit,session)=>unit?unitDisplayName(unit,session):'Unknown unit';
function effectTarget(effect,rule,byId,session){
 if(rule?.targeting==='enemy-unit')return effect.enemyName||'Enemy target not named';
 if(rule?.targeting==='friendly-unit')return fmtName(byId.get(effect.targetId),session);
 const unit=byId.get(effect.casterId);
 const joined=effect.joinedUnitId?byId.get(effect.joinedUnitId):null;
 return fmtName(unit,session)+(joined?' + '+fmtName(joined,session):'');
}
export function renderGameOverview(container,army,session,magicIndex,effects=null){
 const doc=container.ownerDocument||document;
 const roster=createGameScreenModel(army);
 const byId=new Map((army?.units||[]).map(u=>[u.id,u]));
 const assigned=Object.keys(session?.assignments||{}).length;
 const ongoing=(session?.activeSpells||[]).filter(x=>SPELL_RULES[x.spellId]);
 const movement=(session?.spellEvents||[]).filter(x=>x.spellId==='travel-mystical-pathway');
 const casters=new Set(selectedWizardSpells(army,session,magicIndex).map(s=>s.casterId));
 container.replaceChildren();
 const head=el(doc,'div','game-overview-heading');
 head.append(el(doc,'h2','','Battle overview'));
 head.append(el(doc,'p','game-overview-caption',
  'Quick reference to your imported army and player-recorded battle activity.'));
 container.append(head);
 const metrics=el(doc,'div','game-overview-grid');
 for(const [value,label] of [
  [roster.units.length,'Unit entries'],
  [assigned,'Characters assigned'],
  [ongoing.length,'Ongoing spells'],
  [movement.length,'Movement records'],
  [effects?.owned?.length||0,'Reviewed items'],
  [effects?.counts?.active||0,'Active item effects']
 ]){
  const tile=el(doc,'div','game-overview-metric');
  tile.append(el(doc,'strong','',value),el(doc,'span','',label));
  metrics.append(tile);
 }
 container.append(metrics);
 const spells=el(doc,'section','game-overview-section');
 spells.append(el(doc,'h3','','Magic in play'));
 if(!ongoing.length){
  spells.append(el(doc,'p','game-overview-empty',
   'No ongoing spell effects recorded. Choosing a spell does not automatically cast it.'));
 }else{
  const list=el(doc,'ul','game-overview-effect-list');
  for(const effect of ongoing){
   const rule=SPELL_RULES[effect.spellId];
   const row=el(doc,'li','game-overview-effect');
   row.append(el(doc,'strong','',rule.name));
   row.append(el(doc,'span','',effectTarget(effect,rule,byId,session)));
   row.append(el(doc,'small','',rule.duration));
   list.append(row);
  }
  spells.append(list);
 }
 if(movement.length){
  spells.append(el(doc,'h4','','Movement already resolved'));
  const list=el(doc,'ul','game-overview-effect-list');
  for(const event of movement){
   const row=el(doc,'li','game-overview-effect');
   row.append(el(doc,'strong','','Travel Mystical Pathway'));
   row.append(el(doc,'span','',fmtName(byId.get(event.targetId),session)));
   row.append(el(doc,'small','','Already moved in this Movement phase'));
   list.append(row);
  }
  spells.append(list);
 }
 spells.append(action(doc,'magic','Manage magic & active effects'));
 container.append(spells);
 const itemSection=el(doc,'section','game-overview-section game-overview-item-section');
 itemSection.append(el(doc,'h3','','Equipment, banners & item effects'));
 const allItems=effects?.owned||[];
 if(!allItems.length){
  itemSection.append(el(doc,'p','game-overview-empty',
   'No supported equipment effects were found in this imported roster. Unreviewed selections are not assigned guessed benefits.'));
 }else{
  const activeItems=allItems.filter(x=>x.status==='active');
  if(activeItems.length){
   const activeHead=el(doc,'h4','','Player-recorded active items');
   itemSection.append(activeHead);
   const activeList=el(doc,'ul','game-overview-effect-list');
   for(const item of activeItems){
    const row=el(doc,'li','game-overview-effect');
    row.append(el(doc,'strong','',item.name));
    row.append(el(doc,'span','',fmtName(byId.get(item.ownerId),session)));
    row.append(el(doc,'small','',item.description));
    activeList.append(row);
   }
   itemSection.append(activeList);
  }
  const counts=effects.counts||{};
  itemSection.append(el(doc,'p','game-overview-caption',
   (counts.equipped||0)+' equipped/passive · '+(counts.conditional||0)+
   ' conditional · '+(counts.ready||0)+' one-use ready · '+
   (counts.spent||0)+' spent · '+(counts.boundSpells||0)+' Bound spells'));
  const drawer=el(doc,'details','game-overview-item-drawer');
  drawer.append(el(doc,'summary','','Review all '+allItems.length+' source-linked item effects'));
  const list=el(doc,'ul','game-overview-item-list');
  for(const item of allItems){
   const row=el(doc,'li','game-overview-item');
   row.append(el(doc,'strong','',item.name));
   row.append(el(doc,'span','',fmtName(byId.get(item.ownerId),session)));
   const badge=el(doc,'small','',
    item.status==='equipped'?'Equipped':item.status==='conditional'?'Conditional':
    item.status==='ready'?'Ready':item.status==='spent'?'Spent':
    item.status==='active'?'Active':item.status==='bound-spell'?'Bound spell':item.status);
   row.append(badge);
   const link=el(doc,'a','','Source');
   link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   row.append(link);list.append(row);
  }
  drawer.append(list);itemSection.append(drawer);
 }
 itemSection.append(action(doc,'units','Review unit effects & item controls'));
 container.append(itemSection);
 const units=el(doc,'section','game-overview-section');
 units.append(el(doc,'h3','','Your army'));
 units.append(el(doc,'p','game-overview-caption',
  roster.characters.length+' character entries · '+roster.regiments.length+
  ' other unit entries · '+casters.size+' Wizards with selected spells.'));
 units.append(action(doc,'units','Open collapsible unit list'));
 container.append(units);
 const caution=el(doc,'p','game-overview-caution',
  'Battle effects and assignments are player-confirmed records, not proof of legal targets, ranges, spell generation or combat results. Imported points and base profiles are not recalculated.');
 container.append(caution);
}

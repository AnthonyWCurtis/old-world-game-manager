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
export function renderGameOverview(container,army,session,magicIndex){
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
  [movement.length,'Movement records']
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

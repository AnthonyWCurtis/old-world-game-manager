/**
 * Source-backed, read-only attack summary for imported unit instances.
 * Does not resolve dice, model contact, Wizard spells, selected weapons'
 * profiles, or legality. Never adds a bound spell to the Attacks stat.
 */
import {displayModelProfiles} from './imported-unit-display.js';
import {renderUnitOffensiveEffects} from './effects-ui.js';

const el=(doc,tag,cls='',label)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
};
const sourceLink=(doc,label,url)=>{
 try{
  const u=new URL(url);
  if(u.origin!=='https://tow.whfb.app'||u.search||u.hash)
   return el(doc,'span','game-attack-source',label);
  const link=el(doc,'a','game-attack-source',label);
  link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';
  return link;
 }catch{return el(doc,'span','game-attack-source',label);}
};
const hasValue=v=>v!==null&&v!==undefined&&v!=='';
const safeStat=v=>hasValue(v)?String(v):'—';

/** Pure projection: no mutation of the source, imported unit or effect rows. */
export function unitAttackSummary(unit,record,fallback,effects=[]){
 const profiles=displayModelProfiles(unit,record,fallback);
 const melee=profiles.map(profile=>({
  name:profile.name,
  weaponSkill:safeStat(profile.characteristics?.WS),
  strength:safeStat(profile.characteristics?.S),
  attacks:safeStat(profile.characteristics?.A),
  sourceUrl:record?.source?.sourceUrl||fallback?.url||null
 }));
 // Bound spells belong to their actual owner, never automatically to a joined
 // regiment. The effect projection handles selection and source verification.
 const attacking=Array.isArray(effects)?effects.filter(effect=>
  effect?.ownerId===unit?.id&&!effect.shared&&effect.status!=='spent'):[];
 const boundSpells=attacking.filter(e=>e.boundSpell?.url&&
  e.boundSpell.type==='Magic Missile').map(e=>({
   name:e.name,status:e.status,scope:e.scope,sourceUrl:e.sourceUrl,
   spell:{...e.boundSpell}
  }));
 const otherBoundSpells=attacking.filter(e=>e.boundSpell?.url&&
  e.boundSpell.type!=='Magic Missile').map(e=>({
   name:e.name,status:e.status,scope:e.scope,sourceUrl:e.sourceUrl,
   spell:{...e.boundSpell}
  }));
 const magicWeapons=attacking.filter(e=>e.kind==='Magic weapon').map(e=>({
  name:e.name,description:e.description,sourceUrl:e.sourceUrl,scope:e.scope
 }));
 return {melee,boundSpells,otherBoundSpells,magicWeapons,
  offensiveEffects:attacking.filter(e=>e.effectGroup==='offensive'&&
   e.quickLabel&&e.quickDetail)};
}
const stat=(doc,label,value)=>{
 const box=el(doc,'div','game-attack-stat');
 box.append(el(doc,'span','',label),el(doc,'strong','',safeStat(value)));
 return box;
};
const detailsOf=spell=>{
 const parts=[];
 if(spell.phase)parts.push(spell.phase+' phase');
 if(spell.type)parts.push(spell.type);
 if(hasValue(spell.powerLevel))parts.push('Power Level '+spell.powerLevel);
 return parts.join(' · ');
};
export function renderUnitAttackPanel(doc,unit,record,fallback,effects=[]){
 const data=unitAttackSummary(unit,record,fallback,effects);
 const section=el(doc,'section','game-attack-panel');
 section.setAttribute('aria-label','Attacks');
 section.append(el(doc,'h4','','Attacks'));

 if(data.melee.length){
  const melee=el(doc,'div','game-attack-group');
  melee.append(el(doc,'strong','','Base melee characteristics'));
  const rows=el(doc,'div','game-attack-models');
  for(const profile of data.melee){
   const row=el(doc,'div','game-attack-model');
   row.append(el(doc,'span','game-attack-model-name',profile.name));
   const stats=el(doc,'div','game-attack-stats');
   stats.append(stat(doc,'WS',profile.weaponSkill),stat(doc,'S',profile.strength),
    stat(doc,'A',profile.attacks));
   row.append(stats);
   rows.append(row);
  }
  melee.append(rows);
  section.append(melee);
 }
 // A bound spell can be an attack or another type of spell. Only confirmed
 // offensive magic missiles are in this attack section.
 for(const entry of data.boundSpells){
  const spell=entry.spell,group=el(doc,'div','game-attack-bound');
  group.append(el(doc,'strong','',entry.name+' — '+spell.name));
  group.append(el(doc,'p','game-attack-subtitle',detailsOf(spell)));
  const metrics=el(doc,'div','game-attack-stats game-attack-bound-stats');
  for(const [name,value] of [
   ['Casting',spell.castingValue],['Range',spell.range],['Hits',spell.hits],
   ['Strength',spell.strength],['AP',spell.armourPiercing]
  ])if(hasValue(value))metrics.append(stat(doc,name,value));
  if(metrics.childNodes.length)group.append(metrics);
  if(spell.specialRules?.length)
   group.append(el(doc,'p','game-attack-subtitle',spell.specialRules.join(' · ')));
  group.append(el(doc,'p','game-attack-caution',
   'Casting requires a successful roll; targets, dispels and damage are not resolved automatically. Not a normal weapon attack.'));
  const links=el(doc,'div','game-attack-links');
  links.append(sourceLink(doc,'Spell rules',spell.url));
  links.append(sourceLink(doc,'Item rules',entry.sourceUrl));
  group.append(links);
  section.append(group);
 }
 if(data.magicWeapons.length){
  const group=el(doc,'div','game-attack-group');
  group.append(el(doc,'strong','','Selected magic weapons'));
  for(const entry of data.magicWeapons){
   const line=el(doc,'div','game-attack-weapon');
   line.append(sourceLink(doc,entry.name,entry.sourceUrl));
   line.append(el(doc,'p','',entry.description));
   group.append(line);
  }
  section.append(group);
 }
 if(data.offensiveEffects.length){
  const effectsPanel=renderUnitOffensiveEffects(doc,data.offensiveEffects);
  if(effectsPanel)section.append(effectsPanel);
 }
 if(!data.melee.length&&!data.boundSpells.length&&!data.magicWeapons.length&&
    !data.offensiveEffects.length)
  section.append(el(doc,'p','game-attack-caution',
   'No source-backed attack profile established for this imported unit.'));
 section.append(el(doc,'p','game-attack-caution',
  'Base attacks are not adjusted for weapon choice, fighting rank or model contact. Ordinary missile weapon profiles are linked under Equipment & special rules; no attack rolls or damage are calculated here.'));
 return section;
}

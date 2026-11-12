/**
 * Source-backed, read-only attack summary for imported unit instances.
 * Does not resolve dice, model contact, Wizard spells, selected weapons'
 * profiles, or legality. Never adds a bound spell to the Attacks stat.
 */
import {displayModelProfiles} from './imported-unit-display.js';
import {renderUnitOffensiveEffects} from './effects-ui.js';
import {selectedMissileWeapons} from './source-missile-profiles.js';

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
 const availableMundaneWeapons=selectedMissileWeapons(unit,record);
 // Keep Ballistic Skill tied to its published model profile. A champion or
 // crew can have a different BS, and no weapon To Hit roll is inferred here.
 const shootingModels=profiles.map(profile=>({
  name:profile.name,ballisticSkill:safeStat(profile.characteristics?.BS)
 }));
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
  name:e.name,description:e.description,sourceUrl:e.sourceUrl,scope:e.scope,
  attackPhase:e.attackPhase||null,weaponFamily:e.weaponFamily||null,
  attackProfile:e.attackProfile?{...e.attackProfile}:null,
  ownerIsCharacter:e.ownerIsCharacter===true
 }));
 // The magic weapon is mandatory over its mundane equivalent for its bearer.
 // Apply replacement to a whole unit only when it is a single character or a
 // confirmed single-model entry: champion-only upgrades cannot remove the
 // bows belonging to ordinary models in a larger regiment.
 const soleShooter=magicWeapons.some(e=>e.ownerIsCharacter)||
  (unit?.quantity?.value===1&&!unit?.modelGroups?.length);
 const magicFamilies=new Set(soleShooter?magicWeapons
  .filter(e=>e.attackPhase==='Shooting'&&e.weaponFamily)
  .map(e=>e.weaponFamily):[]);
 const shootingWeapons=availableMundaneWeapons.filter(weapon=>
  !weapon.weaponFamily||!magicFamilies.has(weapon.weaponFamily));
 const supersededShootingWeapons=availableMundaneWeapons.filter(weapon=>
  weapon.weaponFamily&&magicFamilies.has(weapon.weaponFamily));
 return {melee,shootingModels,shootingWeapons,supersededShootingWeapons,
  boundSpells,otherBoundSpells,magicWeapons,
  offensiveEffects:(Array.isArray(effects)?effects:[]).filter(e=>
   e.effectGroup==='offensive'&&e.quickLabel&&e.quickDetail&&e.status!=='spent')};
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
/** Visible hierarchy follows the Shooting and Combat phases in tow.whfb.app. */
export function renderUnitAttackPanel(doc,unit,record,fallback,effects=[]){
 const data=unitAttackSummary(unit,record,fallback,effects);
 const section=el(doc,'section','game-attack-panel');
 section.setAttribute('aria-label','Attacks');
 section.append(el(doc,'h4','','Attacks'));
 const shooting=el(doc,'div','game-attack-phase game-attack-shooting');
 shooting.dataset.attackPhase='shooting';
 shooting.append(el(doc,'h5','','Shooting'));
 const combat=el(doc,'div','game-attack-phase game-attack-combat');
 combat.dataset.attackPhase='combat';
 combat.append(el(doc,'h5','','Combat'));
 let shootingCount=0,combatCount=0;

 // BS is a model characteristic, not a weapon characteristic. Keep it
 // visible for every source-backed profile with a published BS, including
 // troops with an as-yet unreviewed shooting weapon. Magic Missiles use
 // casting rather than the displayed Ballistic Skill.
 if(data.shootingModels.some(profile=>profile.ballisticSkill!=='—')){
  const group=el(doc,'div','game-attack-group game-attack-ballistic-skill');
  group.append(el(doc,'strong','','Base Ballistic Skill'));
  const rows=el(doc,'div','game-attack-models');
  for(const profile of data.shootingModels){
   const row=el(doc,'div','game-attack-model');
   row.append(el(doc,'span','game-attack-model-name',profile.name));
   const stats=el(doc,'div','game-attack-stats');
   stats.append(stat(doc,'BS',profile.ballisticSkill));
   row.append(stats);
   rows.append(row);
  }
  group.append(rows);
  group.append(el(doc,'p','game-attack-caution',
   'Published base BS for weapon shooting; Bound Spells use casting instead.'));
  shooting.append(group);
 }

 if(data.shootingWeapons.length){
  const group=el(doc,'div','game-attack-group');
  group.append(el(doc,'strong','','Missile weapons'));
  for(const weapon of data.shootingWeapons){
   const line=el(doc,'div','game-attack-weapon');
   line.append(sourceLink(doc,weapon.name,weapon.sourceUrl));
   const metrics=el(doc,'div','game-attack-stats');
   metrics.append(stat(doc,'Range',weapon.range),stat(doc,'S',weapon.strength),
    stat(doc,'AP',weapon.armourPiercing));
   line.append(metrics);
   group.append(line);
   shootingCount++;
  }
  shooting.append(group);
 }

 const weaponSection=(entries,container)=>{
  if(!entries.length)return 0;
  const group=el(doc,'div','game-attack-group');
  group.append(el(doc,'strong','','Selected magic weapons'));
  for(const entry of entries){
   const line=el(doc,'div','game-attack-weapon');
   line.append(sourceLink(doc,entry.name,entry.sourceUrl));
   const profile=entry.attackProfile;
   if(profile&&profile.sourceUrl===entry.sourceUrl){
    const metrics=el(doc,'div','game-attack-stats game-attack-magic-weapon-stats');
    metrics.append(stat(doc,'Range',profile.range),stat(doc,'Strength',profile.strength),
     stat(doc,'AP',profile.armourPiercing));
    line.append(metrics);
    const extra=el(doc,'details','game-attack-weapon-conditions');
    extra.append(el(doc,'summary','','Rules & conditions'));
    extra.append(el(doc,'p','',entry.description));
    line.append(extra);
   }else{
    line.append(el(doc,'p','',entry.description));
   }
   group.append(line);
  }
  container.append(group);
  return entries.length;
 };
 shootingCount+=weaponSection(data.magicWeapons.filter(x=>x.attackPhase==='Shooting'),shooting);

 // Bound Magic Missiles are attacks in Shooting, not extra Attacks or an
 // ordinary missile weapon. Unknown bound spell types are not classified.
 for(const entry of data.boundSpells.filter(e=>e.spell?.phase==='Shooting')){
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
   'Requires casting and may be dispelled. Magic Missiles cannot be cast after marching or as a Stand & Shoot reaction. Targeting and damage are not resolved automatically; this is not a normal weapon attack.'));
  const links=el(doc,'div','game-attack-links');
  links.append(sourceLink(doc,'Spell rules',spell.url));
  links.append(sourceLink(doc,'Item rules',entry.sourceUrl));
  group.append(links);
  shooting.append(group);
  shootingCount++;
 }



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
   combatCount++;
  }
  melee.append(rows);
  combat.append(melee);
 }
 combatCount+=weaponSection(data.magicWeapons.filter(x=>x.attackPhase==='Combat'),combat);

 // No guessed phase for a source-listed weapon lacking phase verification.
 const unclassified=data.magicWeapons.filter(x=>!['Shooting','Combat'].includes(x.attackPhase));
 if(!shootingCount)
  shooting.append(el(doc,'p','game-attack-caution',
   'No source-reviewed shooting attack established for this unit.'));
 if(!combatCount)
  combat.append(el(doc,'p','game-attack-caution',
   'No published melee characteristics or source-reviewed combat weapon established.'));
 section.append(shooting,combat);
 if(unclassified.length){
  const unknown=el(doc,'div','game-attack-group game-attack-unclassified');
  unknown.append(el(doc,'strong','','Weapon references — phase not yet verified'));
  weaponSection(unclassified,unknown);
  section.append(unknown);
 }
 if(data.offensiveEffects.length){
  const effectsPanel=renderUnitOffensiveEffects(doc,data.offensiveEffects);
  if(effectsPanel)section.append(effectsPanel);
 }
 section.append(el(doc,'p','game-attack-caution',
  'Shown BS and Combat characteristics are published base values. Weapon selection, line of sight, eligible shooters, fighting ranks and contact are not resolved automatically; no attack rolls or damage are calculated here.'));
 return section;
}

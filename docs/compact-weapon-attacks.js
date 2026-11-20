/** Compact, read-only weapon rows. Only reviewed profiles and their explicit shot rules. */
import {unitAttackSummary} from './unit-attack-panel.js';

const ROOT='https://tow.whfb.app/';
const missileRules=Object.freeze({
 'warbow':{shots:'1 shot'},'shortbow':{shots:'1 shot'},
 'longbow':{shots:'1 shot'},'crossbow':{shots:'1 shot',rules:['Move or Shoot']},
 'reaver-bow':{shotKind:'bearer-attacks',rules:['AB (1)','Magical','Volley Fire']},
 'hunters-scorn':{shots:'1 shot',alternative:'2 shots (Multiple Shots (2))',rules:['AB (1)','Magical','Multiple Shots (2)']},
 'bow-of-the-seafarer':{shots:'1 shot',rules:['Cumbersome','Magical','MW (D3)','Through & Through']}
});
const BOLT_PROFILES=Object.freeze([
 {phase:'SHOOTING · SINGLE BOLT',name:'Bolt Thrower',url:ROOT+'war-machines/bolt-throwers',
  shots:'1 shot',range:'48″',strength:'S6',ap:'−3',rules:['Cumbersome','Move or Shoot','MW (2)','Through & Through']},
 {phase:'SHOOTING · NORMAL FIRE',name:'Repeater Bolt Thrower',url:ROOT+'war-machines/bolt-throwers',
  shots:'1 shot',range:'48″',strength:'S6',ap:'−3',rules:['Cumbersome','Move or Shoot','MW (2)','Through & Through']},
 {phase:'SHOOTING · RAPID FIRE',name:'Rapid Fire',url:ROOT+'war-machines/rapid-fire',
  shots:'D3+3 shots',range:'48″',strength:'S4',ap:'−1',rules:['AB (1)','Cumbersome','Move or Shoot']}
]);
const node=(doc,tag,cls='',label)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=String(label);return n;};
const safeLink=(doc,name,sourceUrl)=>{
 try{const u=new URL(sourceUrl);if(u.origin===ROOT.slice(0,-1)&&!u.search&&!u.hash){
  const a=node(doc,'a','owc-weapon-link',name);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;
 }}catch{/* Keep plain text for unverified links. */}
 return node(doc,'span','',name);
};
const slug=url=>{try{return new URL(url).pathname.split('/').filter(Boolean).at(-1)||'';}catch{return '';}};
const suffix=v=>v==null?'':String(v).replace(/"/g,'″');
const shootingCount=(profile,baseAttacks)=>{
 if(profile.shotKind==='bearer-attacks')return /^\d+$/.test(String(baseAttacks))?baseAttacks+' shots':'A shots (bearer)';
 return profile.shots||'Shots not verified';
};
const ownAttacks=(data)=>{
 const models=data.melee.filter(m=>/^\d+$/.test(m.attacks));
 return models.length===1?models[0].attacks:null;
};
export function compactWeaponRows(unit,record,fallback,effects=[],mountGroups=[]){
 const data=unitAttackSummary(unit,record,fallback,effects),rows=[];
 const attacks=ownAttacks(data);
 for(const weapon of data.shootingWeapons){
  const definition=missileRules[slug(weapon.sourceUrl)];
  if(!definition)continue;
  rows.push({phase:'SHOOTING',name:weapon.name,url:weapon.sourceUrl,
   shots:shootingCount(definition,attacks),range:suffix(weapon.range),
   strength:'S'+weapon.strength.replace(/^S/,''),
   ap:weapon.armourPiercing,rules:definition.rules||[]});
 }
 for(const weapon of data.magicWeapons.filter(w=>w.attackPhase==='Shooting')){
  const definition=missileRules[slug(weapon.sourceUrl)],profile=weapon.attackProfile;
  if(!definition||!profile||profile.sourceUrl!==weapon.sourceUrl)continue;
  rows.push({phase:'SHOOTING',name:weapon.name,url:weapon.sourceUrl,
   shots:shootingCount(definition,attacks),range:suffix(profile.range),
   strength:'S'+String(profile.strength).replace(/^S/,''),
   ap:profile.armourPiercing,rules:definition.rules||[]});
  if(definition.alternative)rows.push({phase:'SHOOTING · ALTERNATIVE',name:weapon.name,
   url:weapon.sourceUrl,shots:definition.alternative,range:suffix(profile.range),
   strength:'S'+String(profile.strength).replace(/^S/,''),
   ap:profile.armourPiercing,rules:definition.rules.filter(r=>r!=='Multiple Shots (2)')});
 }
 // Reviewed source-unit profile: show all three *published reference profiles*
 // as requested. They are not three independently usable firing attacks.
 const source=record?.source?.sourceUrl||unit?.reference?.url||fallback?.url||'';
 if(slug(source)==='eagle-claw-bolt-thrower')rows.push(...BOLT_PROFILES);
 const melee=[...data.melee,...(mountGroups||[]).flatMap(g=>(g.profiles||[]).map(p=>({
  name:p.name,attacks:p.characteristics?.A,weaponSkill:p.characteristics?.WS,
  strength:p.characteristics?.S,sourceUrl:g.sourceUrl
 })))];
 for(const model of melee){
  if(!/^\d+$/.test(String(model.attacks)))continue;
  rows.push({phase:'COMBAT · BASE PROFILE',name:model.name,url:model.sourceUrl,
   shots:model.attacks+' attacks',range:null,strength:'S'+model.strength,
   ap:null,rules:[]});
 }
 return rows;
}
export function renderCompactWeaponAttacks(doc,unit,record,fallback,effects=[],mountGroups=[]){
 const rows=compactWeaponRows(unit,record,fallback,effects,mountGroups);
 if(!rows.length)return null;
 const section=node(doc,'section','owc-compact-weapon-attacks');
 section.setAttribute('aria-label','Weapon Attacks');
 section.append(node(doc,'h4','owc-compact-label','⚔ Weapon Attacks'));
 for(const row of rows){
  const line=node(doc,'div','owc-weapon-row');
  line.append(node(doc,'div','owc-weapon-phase',row.phase));
  const sentence=node(doc,'div','owc-weapon-sentence');
  sentence.append(safeLink(doc,row.name,row.url));
  sentence.append(node(doc,'span','',' · '));
  sentence.append(node(doc,'strong','',row.shots));
  for(const field of [row.range,row.strength,row.ap!=null?'AP '+row.ap:null,...row.rules])
   if(field)sentence.append(node(doc,'span','',' · '+field));
  line.append(sentence);section.append(line);
 }
 if(rows.some(r=>r.name==='Repeater Bolt Thrower'))
  section.append(node(doc,'p','owc-weapon-note','Three published reference profiles; not three attacks to fire together. Rapid Fire shots share one target.'));
 return section;
}

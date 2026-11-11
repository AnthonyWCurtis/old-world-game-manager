/** Touch-friendly source-linked effects, items and bound-spell references.
 * Rule effects are rendered from the reviewed registry, never from free text.
 */
const el=(doc,tag,cls='',label)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
};
const statusLabel={
 equipped:'Equipped',conditional:'Conditional',ready:'Ready to use',
 active:'Active — recorded',spent:'Used / spent','bound-spell':'Bound spell',
 resolved:'Resolved movement'
};
function sourceLink(doc,name,url){
 const node=el(doc,'a','game-effect-source',name);
 // Registry URLs are fixed to tow.whfb.app, still defend against accidental
 // future copies of this component with user-controlled URLs.
 try{
  const safe=new URL(url);
  if(safe.origin!=='https://tow.whfb.app'||safe.search||safe.hash)return el(doc,'span','',name);
  node.href=safe.href;node.target='_blank';node.rel='noopener noreferrer';
  return node;
 }catch{return el(doc,'span','',name);}
}
function button(doc,name,fn){
 const b=el(doc,'button','game-effect-action',name);
 b.type='button';b.addEventListener('click',fn);
 return b;
}
function actions(doc,row,onItemState,onShieldUse){
 if(row.shared||row.kind==='Spell')return null;
 const area=el(doc,'div','game-effect-actions');
 const fire=status=>onItemState(row.ownerId,row.id,status);
 if(row.usesExistingShieldState){
  area.append(button(doc,row.status==='spent'?'Undo shield use':'Mark shield used',()=>{
   onShieldUse(row.ownerId,row.status!=='spent');
  }));
 }else if(row.trackUse){
  if(row.status==='ready'){
   area.append(button(doc,row.mode==='timed-single-use'?
    'Confirm consumed — activate':'Mark used',()=>{
    fire(row.mode==='timed-single-use'?'active':'spent');
   }));
  }else if(row.status==='active'){
   area.append(button(doc,'Finish effect — mark spent',()=>fire('spent')));
   area.append(button(doc,'Undo activation',()=>fire('ready')));
   area.append(el(doc,'p','game-effect-caution',
    'When the Elixir ends, apply the lost Wound manually. This tracker does not change model Wounds or saves.'));
  }else if(row.status==='spent'){
   area.append(button(doc,'Undo used status',()=>fire('ready')));
  }
 }
 return area.childNodes.length?area:null;
}
export function renderEffectRow(doc,row,{onItemState=()=>{},onShieldUse=()=>{}}={}){
 const card=el(doc,'details','game-effect-card');
 card.dataset.effectId=row.id;
 card.dataset.ownerId=row.ownerId;
 card.dataset.status=row.status;
 if(row.shared)card.dataset.shared='true';
 const summary=el(doc,'summary','game-effect-summary');
 const identity=el(doc,'span','game-effect-title');
 identity.append(el(doc,'strong','',row.name));
 identity.append(el(doc,'span','game-effect-kind',row.kind));
 const tag=el(doc,'span','game-effect-badge game-effect-badge-'+row.status,
  statusLabel[row.status]||row.status);
 summary.append(identity,tag);
 card.append(summary);
 const body=el(doc,'div','game-effect-details');
 body.append(el(doc,'p','game-effect-description',row.description));
 const info=el(doc,'p','game-effect-scope',row.scope);
 body.append(info);
 if(row.shared)
  body.append(el(doc,'p','game-effect-caution',
   'Shared from another imported model/unit. Joining was recorded manually and is not rules-verified.'));
 if(row.duration)body.append(el(doc,'p','game-effect-scope','Duration: '+row.duration));
 if(row.status==='conditional')
  body.append(el(doc,'p','game-effect-caution',
   'Conditional benefit: apply only when its stated conditions are met. It is not a permanently activated buff.'));
 if(row.boundSpell){
  body.append(el(doc,'p','game-effect-scope',
   'Bound spell: '+row.boundSpell.name+' · Power Level '+row.boundSpell.powerLevel+
   ' · '+row.boundSpell.phase+' phase'));
  body.append(el(doc,'p','game-effect-caution',
   'Bound spells are not Wizard spellbook choices. Casting, targets, dispels and damage must be recorded separately at the table.'));
  body.append(sourceLink(doc,'Fireball spell source',row.boundSpell.url));
 }
 const links=el(doc,'div','game-effect-source-links');
 links.append(sourceLink(doc,'View item/rule source',row.sourceUrl));
 if(row.faqUrl)links.append(sourceLink(doc,'Related FAQ or rules',row.faqUrl));
 body.append(links);
 const controls=actions(doc,row,onItemState,onShieldUse);
 if(controls)body.append(controls);
 card.append(body);
 return card;
}
/** Always-visible attack modifiers belong before Defence, not among save values.
 * Source metadata controls visibility; only imported verified effects qualify.
 */
export function renderUnitOffensiveEffects(doc,unitEffects=[]){
 const entries=unitEffects.filter(e=>e.effectGroup==='offensive'&&
  e.quickLabel&&e.quickDetail&&e.status!=='spent');
 if(!entries.length)return null;
 const section=el(doc,'section','game-offensive-effects-panel');
 section.setAttribute('aria-label','Offensive effects');
 section.append(el(doc,'h4','','Offensive effects'));
 for(const effect of entries){
  const rule=el(doc,'div','game-offensive-effect');
  rule.dataset.effectId=effect.id;
  rule.append(el(doc,'strong','game-offensive-effect-name',
   effect.name+' — '+effect.quickLabel));
  rule.append(el(doc,'p','game-offensive-effect-detail',effect.quickDetail));
  rule.append(el(doc,'p','game-offensive-effect-scope',effect.scope));
  const links=el(doc,'div','game-effect-source-links');
  links.append(sourceLink(doc,'Item source',effect.sourceUrl));
  if(effect.ruleUrl)links.append(sourceLink(doc,'How '+effect.quickLabel+' works',effect.ruleUrl));
  rule.append(links);
  section.append(rule);
 }
 section.append(el(doc,'p','game-effect-caution',
  'Attack-only reference: this does not change the unit’s own armour or base characteristics, and dice are not resolved automatically.'));
 return section;
}

export function renderUnitEffects(doc,unitEffects,actionsHandlers={}){
 const area=el(doc,'section','game-effects-panel');
 area.append(el(doc,'h4','','Effects, items & banners'));
 if(!unitEffects?.length){
  area.append(el(doc,'p','game-effect-empty',
   'No supported source-reviewed effects detected for this unit. Other imported selections are listed above; unmatched or unreviewed items do not gain guessed bonuses.'));
  return area;
 }
 const spell=unitEffects.filter(e=>e.kind==='Spell');
 const equipment=unitEffects.filter(e=>e.kind!=='Spell');
 const head=el(doc,'p','game-effect-counts',
  equipment.length+' equipment effect'+(equipment.length===1?'':'s')+
  ' · '+spell.length+' recorded spell effect'+(spell.length===1?'':'s'));
 area.append(head);
 const list=el(doc,'div','game-effects-list');
 // Active effect cards are first, then imported item effects in the order in
 // which they occur. They all collapse independently to keep phones compact.
 for(const row of [...spell,...equipment])list.append(renderEffectRow(doc,row,actionsHandlers));
 area.append(list);
 area.append(el(doc,'p','game-effect-caution',
  'Source-verified descriptions only. Effects are not automatically applied to imported base characteristics, rolls or combat results.'));
 return area;
}
export function renderMagicItemAbilities(container,projection,session,handlers={}){
 const doc=container.ownerDocument||document;
 const ids=new Set(['ruby-ring-of-ruin','scroll-of-invocation','lore-familiar']);
 const found=projection.owned.filter(x=>ids.has(x.id));
 container.replaceChildren();
 const h=el(doc,'div','game-spell-heading');
 h.append(el(doc,'h2','','Magic items & Bound spells'));
 h.append(el(doc,'span','',found.length+' equipped'));
 container.append(h);
 container.append(el(doc,'p','game-spell-disclosure',
  'Imported and source-reviewed casting aids. Bound spells are separate from Wizard spells; no automatic cast, damage or rule resolution.'));
 if(!found.length){
  container.append(el(doc,'p','game-effect-empty','No supported casting items were imported for this army.'));
  return;
 }
 for(const row of found){
  const owner=row.ownerName||'Imported character';
  const block=el(doc,'section','game-magic-item-group');
  block.dataset.ownerId=row.ownerId;
  block.append(el(doc,'h3','',owner));
  block.append(renderEffectRow(doc,row,handlers));
  container.append(block);
 }
}

/** Presentation-only Compact / Full unit cards. No edits to imported army or battle state. */
import {armySessionKey} from './battle-session.js';
const unitViewPreferences=new Map();
const assignedDrawerPreferences=new Map();
const $=(root,selector)=>root.querySelector(selector);
const make=(doc,tag,cls='',text)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
/** A URL category is sufficient for styling; no army/item name list. */
export function isPublishedMagicItemUrl(url){
 if(typeof url!=='string')return false;
 try{
  const ref=new URL(url);
  return ref.origin==='https://tow.whfb.app'&&
   /^\/magic-items?\/[a-z0-9-]+\/?$/.test(ref.pathname)&&
   !ref.search&&!ref.hash;
 }catch{return false;}
}
/** Categorise display links from source URLs and generic command roles,
 * never from an army-specific champion-name dictionary. */
export function compactLinkCategory(url,label='',section='equipment'){
 if(isPublishedMagicItemUrl(url))return 'magic';
 let publishedCommand=false;
 if(typeof url==='string'){
  try{
   const ref=new URL(url);
   publishedCommand=ref.origin==='https://tow.whfb.app'&&!ref.search&&!ref.hash&&
    /^\/command-groups\/(?:champions|standard-bearers|musicians)\/?$/.test(ref.pathname);
  }catch{/* Unlinked imported selections remain visible as plain text. */}
 }
 const selected=String(label||'').trim();
 if(publishedCommand||/(?:^|:\s*)(?:standard bearer|musician)$/i.test(selected)||
    /\(champion\)$/i.test(selected))return 'command';
 return section==='rules'?'rule':'equipment';
}
function wordList(doc,items,section){
 const line=make(doc,'div','owc-compact-words');
 items.forEach((item,i)=>{
  if(i)line.append(make(doc,'span','owc-word-separator',' · '));
  const word=item.cloneNode(true);
  word.removeAttribute('id');
  word.classList.add('owc-compact-word');
  word.classList.add('owc-link-'+compactLinkCategory(word.getAttribute('href'),
   word.textContent,section));
  line.append(word);
 });
 return line;
}
/**
 * Compact battle summary from the existing source-reviewed projection.
 * A character's personal equipment or special rules never become regiment buffs.
 * Only explicitly projected joins and player-confirmed active target spells qualify.
 */
export function compactBeneficialEffects(effects=[]){
 const merged=new Map();
 for(const effect of effects){
  if(!effect?.sourceUrl||!effect.name)continue;
  const magic=effect.kind==='Spell'&&effect.status==='active';
  const joined=!magic&&effect.shared===true&&!!effect.joinedFrom&&
   effect.ownerIsCharacter===true&&
   ['equipped','conditional','active'].includes(effect.status);
  if(!magic&&!joined)continue;
  // Conditional rules are available, not a confirmed current modifier.
  const category=magic?'magic':effect.status==='conditional'?'conditional':'character';
  const label=effect.quickLabel||effect.name;
  const key=category+'|'+effect.sourceUrl+'|'+label;
  const source=String(effect.ownerName||'Unknown character');
  if(merged.has(key)){
   const existing=merged.get(key);
   if(!existing.providers.includes(source))existing.providers.push(source);
  }else{
   merged.set(key,{
    label,category,url:effect.sourceUrl,providers:[source],
    detail:effect.quickDetail||effect.description||'',
    scope:effect.scope||''
   });
  }
 }
 return [...merged.values()];
}
function compactEffectPills(doc,effects){
 const items=compactBeneficialEffects(effects);
 if(!items.length)return null;
 const section=make(doc,'section','owc-compact-effect-strip');
 section.append(make(doc,'h4','owc-compact-label','Character Buffs & Active Effects'));
 const line=make(doc,'div','owc-compact-words owc-compact-effect-words');
 for(const item of items){
  if(line.childElementCount)line.append(make(doc,'span','owc-word-separator',' · '));
  let element=make(doc,'span','owc-compact-word owc-effect-pill owc-effect-'+item.category,item.label);
  try{
   const url=new URL(item.url);
   if(url.origin==='https://tow.whfb.app'&&!url.search&&!url.hash&&
      url.pathname.split('/').filter(Boolean).every(segment=>/^[a-z0-9-]+$/.test(segment))){
    element=make(doc,'a',element.className,item.label);
    element.href=url.href;element.target='_blank';element.rel='noopener noreferrer';
   }
  }catch{/* Unknown source is never linked off-site. */}
  const condition=item.category==='conditional'?'Conditional · ':'';
  element.title=condition+'From '+item.providers.join(', ')+
   (item.scope?' · '+item.scope:'')+(item.detail?' · '+item.detail:'');
  line.append(element);
 }
 section.append(line);
 return section;
}

/** Reuse the source-resolved links already rendered by unitEquipmentAndRules. */
export function prepareUnitCompactCard(card,army){
 const key=armySessionKey(army)+'::'+card.dataset.unitId;
 card.dataset.owcViewKey=key;
 const body=$(card,':scope > .game-unit-expandable > .army-unit-card-body');
 if(!body||$(body,'.owc-compact-loadout'))return;
 const doc=card.ownerDocument;
 // Only the regiment's own loadout. A broad card-wide query also finds
 // nested attached-character cards and incorrectly mixes all their rules in.
 const sourceLoadout=$(card,':scope > .game-unit-expandable > .army-unit-unified-loadout')||
  $(body,':scope > .army-unit-unified-loadout');
 const sourceGroups=sourceLoadout?
  [...sourceLoadout.querySelectorAll(':scope > .army-unit-loadout-group')]:[];
 const equipment=[],rules=[];
 for(const group of sourceGroups){
  const heading=group.querySelector(':scope > strong')?.textContent?.trim()||'';
  const links=[...group.querySelectorAll('.army-unit-loadout-items > a, .army-unit-loadout-items > span')];
  if(/special rules/i.test(heading))rules.push(...links);
  else equipment.push(...links);
 }
 const summary=make(doc,'section','owc-compact-loadout');
 // Mixed-model regiments retain the importer's explicit model-group counts.
 // This is data display, not inferred legal composition or profiles.
 const importedUnit=(army?.units||[]).find(unit=>unit.id===card.dataset.unitId);
 const modelGroups=(importedUnit?.modelGroups||[])
  .filter(group=>group?.name&&Number.isSafeInteger(group.quantity));
 if(modelGroups.length){
  const groups=make(doc,'div','owc-model-groups');
  groups.append(make(doc,'h4','owc-compact-label','Model Groups'));
  groups.append(make(doc,'p','owc-model-group-values',
   modelGroups.map(group=>group.quantity+'× '+group.name).join(' · ')));
  summary.append(groups);
 }

 for(const [label,items] of [['Equipment & Upgrades',equipment],['Special Rules',rules]]){
  if(!items.length)continue;
  summary.append(make(doc,'h4','owc-compact-label',label),
    wordList(doc,items,label==='Special Rules'?'rules':'equipment'));
 }
 if(!equipment.length&&!rules.length)
  summary.append(make(doc,'p','owc-compact-unavailable','No source-backed equipment or special rules available.'));
 const benefits=compactEffectPills(doc,card.owcCompactEffects);
 if(benefits)summary.append(benefits);
 // Reuse the existing attached-character details and assignment editor:
 // character-specific equipment stays with each character, never the regiment.
 const memberArea=$(card,':scope > .game-unit-expandable > .game-assigned-characters');
 if(memberArea){
  const count=memberArea.querySelectorAll(':scope > .game-attached-character').length;
  const drawer=make(doc,'details','owc-assigned-drawer');
  const heading=make(doc,'summary','owc-assigned-summary');
  heading.append(make(doc,'strong','','Individual Equipment & Special Rules'),
   make(doc,'span','',count+' assigned character'+(count===1?'':'s')));
  drawer.append(heading,memberArea);
  const drawerKey=key+'::assigned';
  drawer.open=assignedDrawerPreferences.get(drawerKey)||false;
  drawer.addEventListener('toggle',()=>{
   assignedDrawerPreferences.set(drawerKey,drawer.open);
   if(assignedDrawerPreferences.size>512)
    assignedDrawerPreferences.delete(assignedDrawerPreferences.keys().next().value);
  });
  summary.append(drawer);
 }
 body.prepend(summary);
 // Put the complete published Model Characteristics block first, immediately
 // under the card header, with Equipment / Rules / Effects after it. Preserve
 // the original table nodes, mount rows and source evidence unchanged.
 const profileCaption=$(body,':scope > .army-profile-caption');
 const profileScroll=$(body,':scope > .army-profile-scroll');
 const profileMissing=$(body,':scope > .army-profile-missing');
 if(profileCaption&&profileScroll)body.prepend(profileCaption,profileScroll);
 else if(profileMissing)body.prepend(profileMissing);
 // Copy the already-scoped Defence values, never recompute saves or promote
 // character-only saves to the regiment. Rebuilt on battle-state rerender.
 const originalSaves=$(card,':scope > .game-unit-expandable > .game-defence-panel .game-defence-values');
 if(originalSaves){
  const strip=originalSaves.cloneNode(true);
  strip.classList.add('owc-save-strip');
  strip.setAttribute('role','group');
  strip.setAttribute('aria-label','Saving throws — equipment-only armour and conditional saves');
  for(const stat of strip.querySelectorAll('.game-defence-stat')){
   const heading=stat.querySelector('span')?.textContent?.trim()||'Save';
   const value=stat.querySelector('strong')?.textContent?.trim()||'—';
   const condition=stat.querySelector('small')?.textContent?.trim()||'';
   stat.setAttribute('aria-label',heading+': '+value+
    (condition?' — '+condition:'')+(stat.title?' — '+stat.title:''));
  }
  // Last compact summary row: Model Characteristics → Equipment / Special
  // Rules / Character Buffs & Active Effects → Armour / Ward / Regeneration.
  summary.after(strip);
 }
 // Highlight numerical profile differences, not presumed bonuses from unverified selections.
 const ownProfile=$(body,':scope > .army-profile-scroll .army-profile-table');
 const rows=[...(ownProfile?.querySelectorAll('tbody > tr')||[])]
  .filter(row=>!row.classList.contains('army-profile-mount-heading')&&
   !row.classList.contains('army-profile-mount-row')&&row.children.length===10);
 if(rows.length>1){
  const baseline=[...rows[0].children].slice(1).map(cell=>cell.textContent.trim());
  for(const row of rows.slice(1)){
   [...row.children].slice(1).forEach((cell,i)=>{
    if(cell.textContent.trim()!==baseline[i])cell.classList.add('owc-different-stat');
   });
  }
 }
 // A champion label is only inferred from an explicit imported/published selection.
 const selectedChampions=equipment
  .map(item=>item.textContent.trim().match(/^(.+?)\s*\(champion\)/i))
  .filter(Boolean).map(match=>match[1].toLowerCase());
 for(const row of rows){
  const name=row.firstElementChild;
  if(selectedChampions.includes(name?.textContent.trim().toLowerCase())){
   name.append(make(doc,'small','owc-champion-note','Champion'));
  }
 }
 card.classList.add('owc-unit-view');
 setUnitView(card,unitViewPreferences.get(key)||'compact',{remember:false});
}
export function setUnitView(card,mode,{remember=true}={}){
 const full=mode==='full';
 card.classList.toggle('owc-view-full',full);
 card.classList.toggle('owc-view-compact',!full);
 const key=card.dataset.owcViewKey;
 if(remember&&key){
  unitViewPreferences.set(key,full?'full':'compact');
  if(unitViewPreferences.size>512)unitViewPreferences.delete(unitViewPreferences.keys().next().value);
 }
}
/** A single scoped, reusable original-source viewer. The source text is never copied. */
export function installRuleViewer(container){
 if(container.dataset.owcRuleViewer==='1')return;
 container.dataset.owcRuleViewer='1';
 const doc=container.ownerDocument;
 const dialog=make(doc,'dialog','owc-rule-dialog');
 dialog.setAttribute('aria-label','Original source rule');
 const shell=make(doc,'div','owc-rule-shell');
 const head=make(doc,'div','owc-rule-head');
 const title=make(doc,'strong','owc-rule-title','Source reference');
 const close=make(doc,'button','owc-rule-close','Close');
 close.type='button';
 head.append(title,close);
 const notice=make(doc,'p','owc-rule-notice','Live original text from tow.whfb.app. If this site blocks embedded pages, use Open original.');
 const frameWrap=make(doc,'div','owc-rule-frame-wrap');
 const frame=make(doc,'iframe','owc-rule-frame');
 frame.title='Original tow.whfb.app reference';
 frame.referrerPolicy='no-referrer';
 frameWrap.append(frame);
 const footer=make(doc,'div','owc-rule-footer');
 const original=make(doc,'a','owc-rule-original','Open original ↗');
 original.target='_blank';original.rel='noopener noreferrer';
 const done=make(doc,'button','owc-rule-close','Close');
 done.type='button';
 footer.append(original,done);
 shell.append(head,notice,frameWrap,footer);dialog.append(shell);
 doc.body.append(dialog);
 let returnFocus=null;
 function dismiss(){
  if(dialog.open)dialog.close();
  else dialog.removeAttribute('open');
  frame.removeAttribute('src');
  returnFocus?.focus?.({preventScroll:true});
  returnFocus=null;
 }
 [close,done].forEach(button=>button.addEventListener('click',dismiss));
 dialog.addEventListener('close',()=>{frame.removeAttribute('src');returnFocus?.focus?.({preventScroll:true});returnFocus=null});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss()});
 container.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(!link||!link.closest('.army-unit-card'))return;
  let url;
  try{url=new URL(link.href)}catch{return}
  if(url.origin!=='https://tow.whfb.app'||url.username||url.password||
   !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(url.pathname)||url.search||url.hash)return;
  event.preventDefault();
  returnFocus=link;
  title.textContent=link.textContent.trim()||'Original rule';
  original.href=url.href;
  frame.src=url.href;
  if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
  else dialog.setAttribute('open','');
 });
}
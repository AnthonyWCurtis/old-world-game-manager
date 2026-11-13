/** Presentation-only Compact / Full unit cards. No edits to imported army or battle state. */
import {armySessionKey} from './battle-session.js';
const unitViewPreferences=new Map();
const $=(root,selector)=>root.querySelector(selector);
const make=(doc,tag,cls='',text)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
function wordList(doc,items){
 const line=make(doc,'div','owc-compact-words');
 items.forEach((item,i)=>{
  if(i)line.append(make(doc,'span','owc-word-separator',' · '));
  const word=item.cloneNode(true);
  word.removeAttribute('id');
  word.classList.add('owc-compact-word');
  line.append(word);
 });
 return line;
}
/** Reuse the source-resolved links already rendered by unitEquipmentAndRules. */
export function prepareUnitCompactCard(card,army){
 const key=armySessionKey(army)+'::'+card.dataset.unitId;
 card.dataset.owcViewKey=key;
 const body=$(card,':scope > .game-unit-expandable > .army-unit-card-body');
 if(!body||$(body,'.owc-compact-loadout'))return;
 const doc=card.ownerDocument;
 const sourceGroups=[...card.querySelectorAll('.army-unit-unified-loadout .army-unit-loadout-group')];
 const equipment=[],rules=[];
 for(const group of sourceGroups){
  const heading=group.querySelector(':scope > strong')?.textContent?.trim()||'';
  const links=[...group.querySelectorAll('.army-unit-loadout-items > a, .army-unit-loadout-items > span')];
  if(/special rules/i.test(heading))rules.push(...links);
  else equipment.push(...links);
 }
 const summary=make(doc,'section','owc-compact-loadout');
 summary.append(make(doc,'h4','owc-compact-heading','✧ Equipment & Special Rules'));
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
  summary.append(make(doc,'h4','owc-compact-label',label),wordList(doc,items));
 }
 if(!equipment.length&&!rules.length)
  summary.append(make(doc,'p','owc-compact-unavailable','No source-backed equipment or special rules available.'));
 body.prepend(summary);
 // Highlight numerical profile differences, not presumed bonuses from unverified selections.
 const rows=[...body.querySelectorAll('.army-profile-table tbody > tr')]
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
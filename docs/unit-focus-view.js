/** Normal Play's focused unit screen. DOM-only navigation, never a rules calculator. */
import {armySessionKey} from './battle-session.js';

const PREFIX='old-world-game-manager-focused-unit-v1:';
const TABS=[['profile','Profile'],['attacks','Attacks'],['defence','Defence'],['effects','Effects']];
const make=(doc,tag,cls='',label)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
};
function storedFocus(key,validIds){
 try{
  const value=JSON.parse(localStorage.getItem(key)||'null');
  if(validIds.has(value?.unitId)&&TABS.some(([tab])=>tab===value.tab))
   return value;
 }catch{/* The view continues without browser storage. */}
 return null;
}
function saveFocus(key,value){
 try{
  if(value)localStorage.setItem(key,JSON.stringify(value));
  else localStorage.removeItem(key);
 }catch{/* Not gameplay data: storage failure must not block play. */}
}
function foldContent(doc,element,label){
 if(!element?.parentNode)return ()=>{};
 const parent=element.parentNode;
 const disclosure=make(doc,'details','game-focused-disclosure');
 const summary=make(doc,'summary','',label);
 disclosure.append(summary);
 parent.replaceChild(disclosure,element);
 disclosure.append(element);
 return ()=>{
  if(disclosure.parentNode)disclosure.parentNode.replaceChild(element,disclosure);
 };
}
function enhanceFocusedProfile(card){
 const doc=card.ownerDocument;
 const panel=card.querySelector(':scope > .game-unit-expandable > .army-unit-card-body');
 if(!panel)return ()=>{};
 const undo=[];
 const scroller=panel.querySelector('.army-profile-scroll');
 if(scroller){
  const table=scroller.querySelector('table');
  const headings=[...(table?.querySelectorAll('thead tr:first-child th')||[])].slice(1)
   .map(cell=>cell.textContent.trim());
  const tiles=make(doc,'div','game-focused-profiles');
  tiles.setAttribute('aria-label','Published base model characteristics, not selected modifiers');
  for(const row of table?.querySelectorAll('tbody tr')||[]){
   const cells=[...row.children];
   if(cells.length!==headings.length+1||!headings.length||cells.slice(1).some(c=>c.tagName!=='TD'))continue;
   const group=make(doc,'section','game-profile-stat-group');
   group.append(make(doc,'h4','',cells[0].textContent.trim()));
   const grid=make(doc,'div','game-profile-stat-grid');
   headings.forEach((heading,i)=>{
    const tile=make(doc,'div','game-profile-stat');
    tile.append(make(doc,'span','game-profile-stat-name',heading),
     make(doc,'strong','game-profile-stat-value',cells[i+1].textContent.trim()));
    grid.append(tile);
   });
   group.append(grid);
   tiles.append(group);
  }
  if(tiles.childElementCount){
   const note=make(doc,'p','game-profile-stat-note',
    'Published base characteristics only. Equipment, magic and selected options are not applied.');
   panel.insertBefore(note,scroller);
   panel.insertBefore(tiles,scroller);
   undo.push(()=>{note.remove();tiles.remove();});
   undo.push(foldContent(doc,scroller,'Full characteristics table (all models and mounts)'));
  }
 }
 const loadout=panel.querySelector('.army-unit-unified-loadout');
 if(loadout){
  const count=loadout.querySelector('.army-unit-loadout-heading > span')?.textContent?.trim()||'';
  undo.push(foldContent(doc,loadout,'Equipment & special rules'+(count?' · '+count:'')));
 }
 return ()=>{for(const fn of undo.reverse())fn();};
}
function categoryFor(node){
 if(node.classList.contains('army-unit-card-body'))return 'profile';
 if(node.classList.contains('game-attack-panel'))return 'attacks';
 if(node.classList.contains('game-defence-panel'))return 'defence';
 return 'effects';
}

/** Attaches to the original imported cards; never clones any interactive controls. */
export function attachFocusedUnitView(container,army,groups,restoreRoster){
 const doc=container.ownerDocument||document;
 const key=PREFIX+armySessionKey(army);
 const allCards=groups.flatMap(group=>group.cards);
 const byId=new Map(allCards.map(card=>[card.dataset.unitId,card]));
 let active=null;
 const toolbar=make(doc,'section','game-unit-focus-toolbar');
 toolbar.id='gameUnitFocus';
 toolbar.hidden=true;
 toolbar.setAttribute('aria-label','Focused unit details');
 const top=make(doc,'div','game-unit-focus-top');
 const back=make(doc,'button','game-unit-focus-back','← Back to army');
 back.id='gameUnitFocusBack';
 back.type='button';
 const heading=make(doc,'div','game-unit-focus-heading');
 heading.append(make(doc,'p','game-unit-focus-kicker','NORMAL PLAY · UNIT DETAILS'));
 const title=make(doc,'h2','game-unit-focus-title');
 heading.append(title);
 top.append(back,heading);
 const tabBar=make(doc,'nav','game-unit-focus-tabs');
 tabBar.id='gameUnitFocusTabs';
 tabBar.setAttribute('aria-label','Unit details sections');
 const buttons=new Map();
 for(const [tab,label] of TABS){
  const button=make(doc,'button','game-unit-focus-tab',label);
  button.type='button';
  button.dataset.focusTab=tab;
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>selectTab(tab));
  buttons.set(tab,button);
  tabBar.append(button);
 }
 toolbar.append(top,tabBar);
 container.prepend(toolbar);

 function selectTab(tab){
  if(!active||!buttons.has(tab))return;
  active.tab=tab;
  for(const [name,button] of buttons){
   const selected=name===tab;
   button.setAttribute('aria-pressed',String(selected));
   button.classList.toggle('game-unit-focus-tab-active',selected);
  }
  for(const child of active.content.children)
   child.hidden=categoryFor(child)!==tab;
  saveFocus(key,{unitId:active.card.dataset.unitId,tab});
 }
 function closeFocus({focusBack=true}={}){
  if(!active)return;
  const previous=active;
  active=null;
  previous.profileCleanup();
  for(const [node,hidden] of previous.originalChildren)node.hidden=hidden;
  for(const group of groups)group.wrapper.classList.remove('game-focus-section');
  for(const owner of container.querySelectorAll('#gameCharacters,#gameRegiments'))
   owner.classList.remove('game-focus-owner');
  previous.card.classList.remove('game-focus-selected');
  container.classList.remove('game-unit-focused');
  container.removeAttribute('data-focus-unit');
  container.closest('#armyRosterPage')?.classList.remove('game-unit-detail-mode');
  toolbar.hidden=true;
  const collapse=previous.card.querySelector('.game-unit-expand-toggle');
  if(collapse?.getAttribute('aria-expanded')==='true')collapse.click();
  saveFocus(key,null);
  restoreRoster();
  if(focusBack){
   previous.card.querySelector('.game-unit-focus-open')?.focus({preventScroll:true});
   previous.card.scrollIntoView({block:'nearest',behavior:'instant'});
  }
 }
 function openFocus(card,tab='profile',{restoring=false}={}){
  if(active&&active.card!==card)closeFocus({focusBack:false});
  if(active?.card===card){
   selectTab(tab);
   return;
  }
  const content=card.querySelector(':scope > .game-unit-expandable');
  if(!content)return;
  const toggle=card.querySelector('.game-unit-expand-toggle');
  if(content.hidden)toggle?.click();
  const group=groups.find(item=>item.cards.includes(card));
  if(!group)return;
  const originalChildren=new Map([...content.children].map(child=>[child,child.hidden]));
  group.wrapper.hidden=false;
  group.body.hidden=false;
  card.hidden=false;
  for(const item of groups)item.wrapper.classList.toggle('game-focus-section',item===group);
  for(const owner of container.querySelectorAll('#gameCharacters,#gameRegiments'))
   owner.classList.toggle('game-focus-owner',owner.contains(card));
  card.classList.add('game-focus-selected');
  container.classList.add('game-unit-focused');
  container.dataset.focusUnit=card.dataset.unitId;
  container.closest('#armyRosterPage')?.classList.add('game-unit-detail-mode');
  title.textContent=card.querySelector('.army-unit-names h3')?.textContent?.trim()||'Unit details';
  toolbar.hidden=false;
  active={card,content,group,originalChildren,profileCleanup:enhanceFocusedProfile(card),tab};
  selectTab(tab);
  if(!restoring)toolbar.scrollIntoView({block:'start',behavior:'instant'});
 }
 back.addEventListener('click',()=>closeFocus());
 for(const card of allCards){
  const header=card.querySelector('.army-unit-head');
  if(!header)continue;
  const name=card.querySelector('.army-unit-names h3')?.textContent?.trim()||'unit';
  const open=make(doc,'button','game-unit-focus-open','Open unit');
  open.type='button';
  open.setAttribute('aria-label','Open '+name+' unit details');
  open.addEventListener('click',event=>{event.stopPropagation();openFocus(card);});
  header.append(open);
  // Primary tap on a card opens the focused view; legacy expansion remains optional.
  header.addEventListener('click',event=>{
   if(event.target.closest('button,a,input,select,label,form,textarea'))return;
   event.stopImmediatePropagation();
   event.preventDefault();
   openFocus(card);
  },true);
 }
 const saved=storedFocus(key,new Set(byId.keys()));
 if(saved)openFocus(byId.get(saved.unitId),saved.tab,{restoring:true});
}

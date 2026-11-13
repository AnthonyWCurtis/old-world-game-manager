/** Normal Play's focused unit screen. DOM-only navigation, never a rules calculator. */
import {armySessionKey} from './battle-session.js';

const PREFIX='old-world-game-manager-focused-unit-v1:';
const make=(doc,tag,cls='',label)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
};
function storedFocus(key,validIds){
 try{
  const value=JSON.parse(localStorage.getItem(key)||'null');
  if(validIds.has(value?.unitId))return value;
 }catch{/* The view continues without browser storage. */}
 return null;
}
function saveFocus(key,value){
 try{
  if(value)localStorage.setItem(key,JSON.stringify(value));
  else localStorage.removeItem(key);
 }catch{/* Not gameplay data: storage failure must not block play. */}
}
function enhanceFocusedProfile(card){
 const doc=card.ownerDocument;
 const panel=card.querySelector(':scope > .game-unit-expandable > .army-unit-card-body');
 if(!panel)return ()=>{};
 const scroller=panel.querySelector('.army-profile-scroll');
 if(!scroller)return ()=>{};
 const table=scroller.querySelector('table');
 const headings=[...(table?.querySelectorAll('thead tr:first-child th')||[])].slice(1)
  .map(cell=>cell.textContent.trim());
 const rows=[...(table?.querySelectorAll('tbody tr')||[])];
 const tiles=make(doc,'div','game-focused-profiles');
 tiles.setAttribute('aria-label','Published base model characteristics, not selected modifiers');
 let converted=0;
 for(const row of rows){
  const cells=[...row.children];
  // Mount selection headers and unresolved source rows must survive the
  // tile conversion. Otherwise a mixed rider/mount table fell back to a
  // horizontally scrolling desktop table on phones.
  if(row.classList.contains('army-profile-mount-heading')){
   tiles.append(make(doc,'h4','game-profile-mounted-heading',row.textContent.trim()));
   continue;
  }
  if(cells.length!==headings.length+1||!headings.length||cells.slice(1).some(c=>c.tagName!=='TD')){
   const note=row.textContent.trim();
   if(note)tiles.append(make(doc,'p','game-profile-mount-unresolved',note));
   continue;
  }
  converted++;
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
 // Do not hide any model rows when a table cannot be converted completely.
 if(!converted)return ()=>{};
 const previousHidden=scroller.hidden;
 const note=make(doc,'p','game-profile-stat-note',
  'Published base characteristics only. Equipment, magic and selected options are not applied.');
 panel.insertBefore(tiles,scroller);
 panel.insertBefore(note,scroller);
 // The complete model/mount characteristics are already represented as tiles;
 // hiding the duplicated source table avoids introducing a second fold.
 scroller.hidden=true;
 return ()=>{
  scroller.hidden=previousHidden;
  note.remove();
  tiles.remove();
 };
}
/** Attaches to the original imported cards; never clones any interactive controls. */
export function attachFocusedUnitView(container,army,groups,restoreRoster){
 const doc=container.ownerDocument||document;
 const key=PREFIX+armySessionKey(army);
 const allCards=groups.flatMap(group=>group.cards);
 const byId=new Map(allCards.map(card=>[card.dataset.unitId,card]));
 // The approved tile profile is the single expanded-card layout everywhere,
 // including inline expansion outside the focused view.
 for(const card of allCards)enhanceFocusedProfile(card);
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
 toolbar.append(top);
 container.prepend(toolbar);

 function closeFocus({focusBack=true}={}){
  if(!active)return;
  const previous=active;
  active=null;
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
 function openFocus(card,{restoring=false}={}){
  if(active&&active.card!==card)closeFocus({focusBack:false});
  if(active?.card===card)return;
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
  active={card,content,group,originalChildren};
  saveFocus(key,{unitId:card.dataset.unitId});
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
 if(saved)openFocus(byId.get(saved.unitId),{restoring:true});
}

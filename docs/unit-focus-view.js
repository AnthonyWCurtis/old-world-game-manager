/** Normal Play's focused unit screen. DOM-only navigation, never a rules calculator. */
import {armySessionKey} from './battle-session.js';
import {prepareUnitCompactCard,setUnitView,installRuleViewer} from './unit-view-modes.js';

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
/** The roster always shows Compact; its one chevron toggles Full in place.
 * Do not trigger the original collapse handler: no name-only state is allowed,
 * and changing the display must not mutate recorded gameplay state.
 */
export function attachFocusedUnitView(container,army,groups,_restoreRoster){
 const cards=groups.flatMap(group=>group.cards);
 installRuleViewer(container);
 for(const card of cards){
  prepareUnitCompactCard(card,army);
  const content=card.querySelector(':scope > .game-unit-expandable');
  const chevron=card.querySelector('.game-unit-expand-toggle');
  const header=card.querySelector('.army-unit-head');
  if(!content||!chevron||!header)continue;
  const name=card.querySelector('.army-unit-names h3')?.textContent?.trim()||'unit';
  content.hidden=false;
  card.classList.add('game-unit-open');
  setUnitView(card,'compact',{remember:false});
  const sync=()=>{
   const full=card.classList.contains('owc-view-full');
   content.hidden=false;
   card.classList.add('game-unit-open');
   chevron.textContent=full?'⌃':'⌄';
   chevron.setAttribute('aria-expanded',String(full));
   chevron.setAttribute('aria-label',(full?'Show compact':'Show full')+' view for '+name);
   chevron.setAttribute('title',full?'Compact View':'Full View');
   header.setAttribute('aria-label',name+' — '+(full?'Full':'Compact')+' view');
  };
  const change=()=>{
   setUnitView(card,card.classList.contains('owc-view-full')?'compact':'full',{remember:false});
   sync();
  };
  // Capture before the old fold and header handlers. Every other interactive
  // control (rename, counters, links, assignment editors) retains its action.
  header.addEventListener('click',event=>{
   if(event.target.closest('button,a,input,select,label,form,textarea')&&
      !event.target.closest('.game-unit-expand-toggle'))return;
   event.preventDefault();
   event.stopImmediatePropagation();
   change();
  },true);
  header.addEventListener('keydown',event=>{
   if(event.target!==header||!['Enter',' '].includes(event.key))return;
   event.preventDefault();
   change();
  });
  header.tabIndex=0;
  sync();
 }
}

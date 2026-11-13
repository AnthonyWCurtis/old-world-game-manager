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
/** Render the approved Compact card directly in the roster.
 * Full View is a second state of that same card, never a separate screen.
 * Only presentation DOM changes; battle counters, assignments and rules remain intact.
 */
export function attachFocusedUnitView(container,army,groups,_restoreRoster){
 const doc=container.ownerDocument||document;
 const allCards=groups.flatMap(group=>group.cards);
 installRuleViewer(container);
 for(const card of allCards){
  prepareUnitCompactCard(card,army);
  const content=card.querySelector(':scope > .game-unit-expandable');
  const collapse=card.querySelector('.game-unit-expand-toggle');
  const header=card.querySelector('.army-unit-head');
  if(!content||!header)continue;
  const name=card.querySelector('.army-unit-names h3')?.textContent?.trim()||'unit';
  // The roster itself is the Compact View. Do not trigger the old toggle:
  // doing so would persist a cosmetic open state into gameplay/session data.
  content.hidden=false;
  card.classList.add('game-unit-open');
  if(collapse){
   collapse.textContent='⌃';
   collapse.setAttribute('aria-expanded','true');
   collapse.setAttribute('aria-label','Collapse '+name+' card');
  }
  // prepareUnitCompactCard restored the per-army, per-unit view preference.
  // Keep it across roster redraws caused by battle-state changes.
  const switchView=make(doc,'button','game-unit-focus-open','Full view');
  switchView.type='button';
  const sync=()=>{
   const full=card.classList.contains('owc-view-full');
   switchView.textContent=full?'Compact view':'Full view';
   switchView.setAttribute('aria-label',(full?'Show compact':'Show full')+' view for '+name);
   switchView.setAttribute('aria-pressed',String(full));
   header.setAttribute('aria-label',name+' — '+(full?'Full':'Compact')+' view; tap to switch');
  };
  const change=()=>{
   if(content.hidden){
    // First tap reveals a collapsed card as Compact, keeping the single fold.
    collapse?.click();
    setUnitView(card,'compact');
   }else{
    setUnitView(card,card.classList.contains('owc-view-full')?'compact':'full');
   }
   sync();
  };
  switchView.addEventListener('click',event=>{event.stopPropagation();change();});
  header.append(switchView);
  // The entire non-interactive heading is a touch target. Links, the name
  // pencil and the wound counter retain their independent controls.
  header.addEventListener('click',event=>{
   if(event.target.closest('button,a,input,select,label,form,textarea'))return;
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
  // A tap on the compact characteristics area also reveals the full card.
  // Source links and every battle control still handle their own actions.
  content.addEventListener('click',event=>{
   if(!card.classList.contains('owc-view-compact'))return;
   if(event.target.closest('button,a,input,select,label,form,textarea,summary,details'))return;
   if(event.target.closest('.army-unit-card-body'))change();
  });
  collapse?.addEventListener('click',()=>{
   if(content.hidden)setUnitView(card,'compact');
   sync();
  });
  sync();
 }
}

/** Personal display ordering for the imported roster. Never mutate an army or battle state. */
import {armySessionKey} from './battle-session.js';

const KEY_PREFIX='old-world-game-manager-roster-display-order-v1:';
const volatileOrder=new Map();
const HOLD_MS=390;
const CANCEL_DISTANCE=11;

const isEntryId=value=>typeof value==='string'&&value.length>0&&value.length<256;
const same=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);
function read(key){
 try{
  const obj=JSON.parse(localStorage.getItem(key)||'null');
  if(obj?.version===1&&obj.groups&&typeof obj.groups==='object'&&!Array.isArray(obj.groups))
   return obj.groups;
 }catch{/* Storage may be unavailable, corrupt or disabled. */}
 return volatileOrder.get(key)||{};
}
function write(key,groups){
 const copy={...groups};
 volatileOrder.set(key,copy);
 try{
  if(Object.keys(copy).length)localStorage.setItem(key,JSON.stringify({version:1,groups:copy}));
  else localStorage.removeItem(key);
 }catch{/* Continue working without persistence until storage returns. */}
}
function restoreGroup(group,ids){
 const original=[...group.cards];
 if(!Array.isArray(ids)||!ids.length)return;
 const byId=new Map(original.map(c=>[c.dataset.unitId,c]));
 const seen=new Set();
 const chosen=[];
 for(const id of ids){
  if(!isEntryId(id)||seen.has(id)||!byId.has(id))continue;
  seen.add(id);
  chosen.push(byId.get(id));
 }
 const result=[...chosen,...original.filter(c=>!seen.has(c.dataset.unitId))];
 group.cards.splice(0,group.cards.length,...result);
 for(const card of result)group.body.append(card);
}

export function attachRosterReorder(container,army,groups,search,refreshRoster){
 const key=KEY_PREFIX+armySessionKey(army);
 const saved=read(key);
 const baseline=new Map(groups.map(g=>[g.key,g.cards.map(c=>c.dataset.unitId)]));
 for(const group of groups)restoreGroup(group,saved[group.key]);

 const doc=container.ownerDocument||document;
 const helper=doc.createElement('div');
 helper.className='game-roster-reorder-tools';
 const hint=doc.createElement('p');
 hint.id='gameRosterReorderHelp';
 hint.className='game-roster-reorder-help';
 hint.setAttribute('role','status');
 hint.setAttribute('aria-live','polite');
 const reset=doc.createElement('button');
 reset.id='gameRosterResetOrder';
 reset.type='button';
 reset.className='game-roster-reset-order';
 reset.textContent='Reset order';
 helper.append(hint,reset);
 search.closest('.game-roster-search')?.append(helper);

 const modified=()=>groups.some(g=>!same(g.cards.map(c=>c.dataset.unitId),baseline.get(g.key)||[]));
 function updateHint(){
  const filtered=!!search.value.trim();
  hint.textContent=filtered?'Clear search to reorder units.':
   'Hold a unit to move it · Alt + ↑/↓ with a selected unit';
  reset.disabled=!modified();
 }
 function persist(){
  const current=read(key),next={...current};
  for(const group of groups){
   const ids=group.cards.map(c=>c.dataset.unitId);
   if(same(ids,baseline.get(group.key)))delete next[group.key];
   else next[group.key]=ids;
  }
  write(key,next);
  updateHint();
 }
 function restoreDefault(){
  for(const group of groups){
   const byId=new Map(group.cards.map(c=>[c.dataset.unitId,c]));
   const original=baseline.get(group.key).map(id=>byId.get(id)).filter(Boolean);
   group.cards.splice(0,group.cards.length,...original);
   for(const card of original)group.body.append(card);
  }
  write(key,{});
  refreshRoster();
  updateHint();
 }
 reset.addEventListener('click',restoreDefault);
 search.addEventListener('input',updateHint);
 updateHint();

 let gesture=null,suppressUntil=0;
 const blocked=()=>!!search.value.trim()||container.classList.contains('game-unit-focused');
 function isControl(target){
  return !!target?.closest?.('button,a,input,select,textarea,label,summary,[contenteditable="true"]');
 }
 function cleanup(){
  if(!gesture)return;
  clearTimeout(gesture.timer);
  gesture.card.classList.remove('game-roster-dragging','game-roster-hold-pending');
  container.classList.remove('game-roster-reordering');
  gesture=null;
 }
 function begin(card,group,x,y,identifier){
  if(gesture||blocked())return;
  gesture={card,group,initialX:x,initialY:y,x,y,identifier,
   active:false,moved:false,timer:null};
  card.classList.add('game-roster-hold-pending');
  const current=gesture;
  current.timer=setTimeout(()=>{
   if(gesture!==current)return;
   current.active=true;
   card.classList.remove('game-roster-hold-pending');
   card.classList.add('game-roster-dragging');
   container.classList.add('game-roster-reordering');
   if(navigator.vibrate)try{navigator.vibrate(12)}catch{/* optional feedback */}
  },HOLD_MS);
 }
 function place(y){
  if(!gesture?.active||blocked())return;
  const {card,group}=gesture;
  const others=group.cards.filter(candidate=>candidate!==card&&!candidate.hidden);
  let target=others.find(candidate=>{
   const r=candidate.getBoundingClientRect();
   return y>=r.top&&y<=r.bottom;
  });
  if(!target&&others.length){
   const first=others[0].getBoundingClientRect();
   const last=others[others.length-1].getBoundingClientRect();
   if(y<first.top)target=others[0];
   else if(y>last.bottom)target=others[others.length-1];
  }
  if(!target)return;
  const rect=target.getBoundingClientRect();
  const before=y<rect.top+rect.height/2;
  const next=group.cards.filter(c=>c!==card);
  const position=next.indexOf(target)+(before?0:1);
  next.splice(position,0,card);
  if(same(next,group.cards))return;
  group.cards.splice(0,group.cards.length,...next);
  // The real card and its existing event handlers are moved, never cloned.
  for(const candidate of next)group.body.append(candidate);
  gesture.moved=true;
 }
 function finish(){
  if(!gesture)return;
  const moved=gesture.moved,active=gesture.active;
  if(active)suppressUntil=Date.now()+800;
  cleanup();
  if(moved)persist();
  else updateHint();
 }
 function cancel(){
  if(!gesture)return;
  // A cancelled drag still keeps any already moved DOM order and saves it.
  finish();
 }
 for(const group of groups){
  for(const card of group.cards){
   const header=card.querySelector(':scope > .army-unit-head');
   if(!header)continue;
   header.tabIndex=0;
   header.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
   header.setAttribute('aria-label',(card.querySelector('.army-unit-names h3')?.textContent?.trim()||'Unit')+
    '. Hold to reorder within this section; Alt and arrow keys also move it.');
   header.addEventListener('contextmenu',event=>{
    if(gesture?.card===card)event.preventDefault();
   });
   header.addEventListener('click',event=>{
    // Suppress only a synthetic click on the dragged card itself.
    // A deliberate tap on Open unit or another real control must still work.
    if(Date.now()<suppressUntil&&!isControl(event.target)){
     event.preventDefault();
     event.stopImmediatePropagation();
    }
   },true);
   header.addEventListener('keydown',event=>{
    if(blocked()||!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
    const ix=group.cards.indexOf(card),offset=event.key==='ArrowUp'?-1:1;
    const target=ix+offset;
    if(target<0||target>=group.cards.length)return;
    event.preventDefault();
    const next=[...group.cards];
    next.splice(ix,1);
    next.splice(target,0,card);
    group.cards.splice(0,group.cards.length,...next);
    for(const c of next)group.body.append(c);
    persist();
    header.focus({preventScroll:true});
   });
   header.addEventListener('touchstart',event=>{
    if(blocked()||isControl(event.target)||event.touches.length!==1)return;
    const touch=event.changedTouches[0];
    begin(card,group,touch.clientX,touch.clientY,touch.identifier);
   },{passive:true});
   // Desktop: hold mouse on the card without disabling ordinary click-to-open.
   header.addEventListener('mousedown',event=>{
    if(event.button!==0||blocked()||isControl(event.target)||Date.now()<suppressUntil)return;
    begin(card,group,event.clientX,event.clientY,'mouse');
   });
  }
 }
 container.addEventListener('touchmove',event=>{
  if(!gesture||gesture.identifier==='mouse')return;
  const touch=[...event.changedTouches].find(t=>t.identifier===gesture.identifier);
  if(!touch)return;
  if(!gesture.active){
   if(Math.hypot(touch.clientX-gesture.initialX,touch.clientY-gesture.initialY)>CANCEL_DISTANCE)cleanup();
   return; // Normal quick scrolling remains available.
  }
  event.preventDefault();
  gesture.y=touch.clientY;
  place(touch.clientY);
 },{passive:false});
 container.addEventListener('touchend',event=>{
  if(!gesture||gesture.identifier==='mouse')return;
  if(![...event.changedTouches].some(t=>t.identifier===gesture.identifier))return;
  if(gesture.active)event.preventDefault();
  finish();
 },{passive:false});
 container.addEventListener('touchcancel',cancel,{passive:true});
 container.addEventListener('mousemove',event=>{
  if(!gesture||gesture.identifier!=='mouse')return;
  if(!gesture.active){
   if(Math.hypot(event.clientX-gesture.initialX,event.clientY-gesture.initialY)>CANCEL_DISTANCE)cleanup();
   return;
  }
  event.preventDefault();
  place(event.clientY);
 });
 container.addEventListener('mouseup',event=>{
  if(gesture?.identifier==='mouse')finish();
 });
 container.addEventListener('mouseleave',event=>{
  if(gesture?.identifier==='mouse'&&!gesture.active)cleanup();
 });
 return {reset:restoreDefault};
}

/**
 * Compact, manually recorded per-instance battle losses for the Units screen.
 * Isolated from the source importer and Stage 2 rules engine. This store can
 * later be migrated into the shared battle-session schema without rewriting
 * imported army text or changing rules/effects state.
 */
import {armySessionKey} from './battle-session.js';
import {displayModelProfiles} from './imported-unit-display.js';

const PREFIX='old-world-companion-unit-wounds-v1:';
const volatile=new Map();
const number=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const wholeStat=value=>{
 const s=String(value??'').trim();
 return /^[1-9][0-9]?$/.test(s)?Number(s):null;
};
const bonusStat=value=>{
 const m=/^\\?\(\s*\+([1-9][0-9]?)\s*\)$/.exec(String(value??'').trim());
 return m?Number(m[1]):null;
};
const sourceProfile=(unit,record,fallback)=>displayModelProfiles(unit,record,fallback)[0]||null;
const storageKey=army=>{
 try{return PREFIX+armySessionKey(army);}catch{return null;}
};
function snapshot(key){
 if(!key)return {};
 let state=volatile.get(key);
 if(state)return {...state};
 try{
  const raw=JSON.parse(localStorage.getItem(key)||'null');
  if(raw?.version===1&&raw.values&&typeof raw.values==='object'&&!Array.isArray(raw.values)){
   state=raw.values;
   volatile.set(key,{...state});
   return {...state};
  }
 }catch{/* Browsers may block storage; hold state in this tab. */}
 return {};
}
/** Only exact-source-linked mount profile additions can affect the preview. */
export function trackingDefinition(unit,record,fallback,mountGroups=[]){
 const count=number(unit?.quantity?.value);
 const profile=sourceProfile(unit,record,fallback);
 const riderW=wholeStat(profile?.characteristics?.W);
 const baseT=wholeStat(profile?.characteristics?.T);
 let max=riderW, toughness=baseT, issue=null;
 const mounted=mountGroups.filter(group=>group?.mountType);
 if(mounted.length){
  if(mounted.length!==1||mounted[0].mountType!=='riddenMonster'){
   issue='Mounted or split-profile Wounds require manual verification.';
   max=null;toughness=null;
  }else{
   const mount=mounted[0];
   const additions=(mount.profiles||[]).filter(p=>bonusStat(p?.characteristics?.W)!==null);
   const tough=(mount.profiles||[]).filter(p=>bonusStat(p?.characteristics?.T)!==null);
   if(riderW!==null&&additions.length===1){
    max=riderW+bonusStat(additions[0].characteristics.W);
   }else{max=null;issue='Mounted Wounds cannot be established from the source profiles.';}
   if(baseT!==null&&tough.length===1)toughness=baseT+bonusStat(tough[0].characteristics.T);
   else toughness=null;
   if(max!==null)issue='Combined Wounds shown from source-linked ridden-monster profile additions; mounting legality and damage allocation are not validated.';
  }
 }
 const isGroup=count!==null&&count>1;
 if(isGroup)return {
  kind:'models',max:count,toughness:baseT,
  note:riderW!==1?'This quick counter tracks models, not unresolved wounds on individual multi-wound models.':null
 };
 if(!Number.isSafeInteger(max)||max<=0)return {kind:'unresolved',max:null,toughness, note:issue||'Published Wounds for this model are not established.'};
 return {kind:'wounds',max,toughness,note:issue};
}
export function readTrackedRemaining(army,unitId,spec){
 if(spec?.max==null)return null;
 const key=storageKey(army);
 const state=snapshot(key);
 const value=state[unitId];
 return Number.isSafeInteger(value)&&value>=0&&value<=spec.max?value:spec.max;
}
/** Write only this unit's manual value; never mutate the roster or rules state. */
export function setTrackedRemaining(army,unitId,spec,value){
 if(!unitId||spec?.max==null||!Number.isSafeInteger(value)||value<0||value>spec.max)
  throw Error('Invalid manual unit counter value');
 const key=storageKey(army);
 if(!key)throw Error('Imported army identity unavailable for saving');
 const values=snapshot(key);
 values[unitId]=value;
 volatile.set(key,values);
 try{
  localStorage.setItem(key,JSON.stringify({version:1,values}));
  return {remaining:value,saved:true};
 }catch{
  return {remaining:value,saved:false};
 }
}
export function renderUnitCounter(doc,army,unit,spec,card){
 const group=doc.createElement('div');
 group.className='game-compact-wounds';
 group.setAttribute('role','group');
 group.setAttribute('aria-label',(spec.kind==='models'?'Models remaining':'Wounds remaining')+' for '+unit.name);
 const remaining=readTrackedRemaining(army,unit.id,spec);
 if(remaining===null){
  group.classList.add('game-compact-wounds-unresolved');
  const label=doc.createElement('span');label.className='game-compact-wounds-unresolved-text';label.textContent='Wounds —';
  label.title=spec.note||'Wound total unresolved';
  group.append(label);return group;
 }
 const label=spec.kind==='models'?'Models':'Wounds';
 const minus=doc.createElement('button'),plus=doc.createElement('button');
 minus.type=plus.type='button';
 minus.className='game-wound-step';
 plus.className='game-wound-step';
 minus.textContent='−';plus.textContent='+';
 minus.setAttribute('aria-label','Record '+(spec.kind==='models'?'one casualty':'one wound')+' for '+unit.name);
 plus.setAttribute('aria-label','Restore '+(spec.kind==='models'?'one model':'one wound')+' for '+unit.name);
 const center=doc.createElement('span');center.className='game-wound-counter-value';
 const amount=doc.createElement('strong');amount.className='game-wound-remaining';
 const title=doc.createElement('small');title.textContent=label;
 center.append(amount,title);
 const live=doc.createElement('span');live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');
 const draw=value=>{
  amount.textContent=value+'/'+spec.max;
  minus.disabled=value===0;plus.disabled=value===spec.max;
  for(const el of card.querySelectorAll('.game-defence-wounds-remaining'))el.textContent=value+'/'+spec.max;
  live.textContent=label+' remaining: '+value+' of '+spec.max;
 };
 let current=remaining;
 const change=delta=>{
  const next=Math.max(0,Math.min(spec.max,current+delta));
  if(next===current)return;
  try{
   const result=setTrackedRemaining(army,unit.id,spec,next);
   current=result.remaining;draw(current);
   group.dataset.saved=result.saved?'yes':'no';
   group.title=result.saved?'Saved on this device':'Local saving unavailable: this value only lasts in this tab';
  }catch(error){group.dataset.saved='no';group.title=error.message;}
 };
 minus.addEventListener('click',event=>{event.stopPropagation();change(-1);});
 plus.addEventListener('click',event=>{event.stopPropagation();change(1);});
 group.append(minus,center,plus,live);
 draw(current);
 if(spec.note)group.title=spec.note;
 return group;
}

/** View-only preferences; no roster, rules or battle outcomes are modified. */
import {armySessionKey} from './battle-session.js';

export const GAME_TABS=Object.freeze(['units']);
const PREFIX='old-world-game-manager-layout-v1:';
const isTab=tab=>GAME_TABS.includes(tab);
const safeGet=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* Private/offline storage may be restricted. */}};

export function loadGameLayout(army){
 const key=PREFIX+armySessionKey(army);
 let saved=null;
 try{saved=JSON.parse(safeGet(key)||'null');}catch{}
 const valid=new Set((army?.units||[]).map(u=>u.id));
 return {
  key,
  tab:'units',
  expandedUnits:Array.isArray(saved?.expandedUnits)?
   saved.expandedUnits.filter(id=>typeof id==='string'&&valid.has(id)).slice(0,300):[],
  scroll:saved?.scroll&&typeof saved.scroll==='object'?
   Object.fromEntries(GAME_TABS.map(tab=>[tab,
    Number.isFinite(saved.scroll[tab])?
     Math.max(0,Math.min(10000000,Math.round(saved.scroll[tab]))):0])):{units:0}
 };
}
export function saveGameLayout(state){
 if(!state?.key)return;
 safeSet(state.key,JSON.stringify({
  tab:'units',
  expandedUnits:Array.isArray(state.expandedUnits)?state.expandedUnits.slice(0,300):[],
  scroll:state.scroll||{}
 }));
}
export function setUnitExpanded(state,id,open){
 const others=new Set(state?.expandedUnits||[]);
 if(open)others.add(id);else others.delete(id);
 const next={...state,expandedUnits:[...others]};
 saveGameLayout(next);
 return next;
}
export function setActiveTab(state,tab,currentScroll){
 if(!isTab(tab))return state;
 const scroll={...state.scroll,[state.tab]:Math.max(0,Math.round(currentScroll||0))};
 const next={...state,tab,scroll};
 saveGameLayout(next);
 return next;
}

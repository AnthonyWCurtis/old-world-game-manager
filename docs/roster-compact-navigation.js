/** View-only Normal Play roster navigation; never changes army, rules or battle state. */
import {armySessionKey} from './battle-session.js';
import {attachFocusedUnitView} from './unit-focus-view.js';
import {attachRosterReorder} from './roster-drag-reorder.js';

const PREF_PREFIX='old-world-game-manager-roster-sections-v1:';
const queries=new Map();
const volatilePrefs=new Map();
const elt=(doc,tag,cls='',label)=>{
 const node=doc.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
};
const readPrefs=key=>{
 try{
  const parsed=JSON.parse(localStorage.getItem(key)||'null');
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&parsed.sections
   &&typeof parsed.sections==='object'&&!Array.isArray(parsed.sections))
   return Object.fromEntries(Object.entries(parsed.sections).filter(([,v])=>typeof v==='boolean'));
 }catch{/* Storage may be blocked or tampered with. */}
 return {...(volatilePrefs.get(key)||{})};
};
const persistPrefs=(key,prefs)=>{
 volatilePrefs.set(key,{...prefs});
 try{localStorage.setItem(key,JSON.stringify({sections:prefs}));}
 catch{/* Private browsing may block writes; retain in-memory preference. */}
};
function fold(doc,heading,nodes,key,initiallyOpen){
 const wrapper=elt(doc,'div','game-roster-section');
 wrapper.dataset.sectionKey=key;
 const name=heading.querySelector('h2')?.textContent?.trim()||'Other units';
 const h2=heading.querySelector('h2');
 const button=elt(doc,'button','game-roster-section-toggle');
 button.type='button';
 button.setAttribute('aria-label','Toggle '+name);
 const title=elt(doc,'span','game-roster-section-title',name);
 button.append(title,elt(doc,'span','game-roster-section-arrow','⌄'));
 if(h2)h2.replaceChildren(button);
 heading.classList.add('game-roster-section-heading');
 const body=elt(doc,'div','game-roster-section-content');
 const id='game-roster-section-'+key.replace(/[^a-z0-9-]/gi,'-');
 body.id=id;
 button.setAttribute('aria-controls',id);
 button.setAttribute('aria-expanded',String(initiallyOpen));
 body.hidden=!initiallyOpen;
 for(const node of nodes)body.append(node);
 wrapper.append(heading,body);
 return {key,wrapper,button,body,cards:[...body.querySelectorAll(':scope > article.army-unit-card')],defaultOpen:initiallyOpen};
}
const searchValue=card=>(card.dataset.rosterSearch||card.querySelector('.army-unit-names')?.textContent||'').toLocaleLowerCase();

export function decorateCompactRoster(container,army){
 const doc=container.ownerDocument||document;
 const storageKey=PREF_PREFIX+armySessionKey(army);
 const prefs=readPrefs(storageKey);
 const transient=new Map();
 const groups=[];
 const searchBar=elt(doc,'div','game-roster-search');
 const label=elt(doc,'label','game-roster-search-label','Find a unit or character');
 label.htmlFor='gameRosterSearch';
 const search=elt(doc,'input','game-roster-search-input');
 search.id='gameRosterSearch';
 search.type='search';
 search.autocomplete='off';
 search.placeholder='Search names or entry numbers';
 search.setAttribute('aria-controls','armyRosterList');
 search.value=queries.get(storageKey)||'';
 const status=elt(doc,'p','game-roster-search-status');
 status.id='gameRosterSearchStatus';
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 searchBar.append(label,search,status);
 container.prepend(searchBar);

 const characters=container.querySelector('#gameCharacters');
 if(characters){
  const heading=characters.querySelector(':scope > .game-section-header');
  if(heading){
   const nodes=[...characters.children].filter(node=>node!==heading);
   const key='characters';
   const group=fold(doc,heading,nodes,key,prefs[key]??true);
   characters.append(group.wrapper);
   groups.push(group);
  }
 }
 const regiments=container.querySelector('#gameRegiments');
 if(regiments){
  const subheadings=[...regiments.querySelectorAll(':scope > .game-subsection')];
  const hasCore=subheadings.some(head=>/\bcore\b/i.test(head.querySelector('h2')?.textContent||''));
  let index=0,group=null;
  for(const child of [...regiments.children]){
   if(child.classList.contains('game-subsection')){
    const name=child.querySelector('h2')?.textContent||'Other units';
    const key='section-'+index+'-'+name.toLocaleLowerCase();
    const initiallyOpen=prefs[key]??(/\bcore\b/i.test(name)||(!hasCore&&index===0));
    group=fold(doc,child,[],key,initiallyOpen);
    regiments.append(group.wrapper);
    groups.push(group);
    index++;
   }else if(group && child.classList.contains('army-unit-card')){
    group.body.append(child);
    group.cards.push(child);
   }
  }
 }
 const total=groups.reduce((n,group)=>n+group.cards.length,0);
 function refresh(){
  const query=search.value.trim().toLocaleLowerCase();
  const terms=query.split(/\s+/).filter(Boolean);
  let count=0;
  for(const group of groups){
   let matches=0;
   for(const card of group.cards){
    const haystack=searchValue(card);
    const match=terms.every(term=>haystack.includes(term));
    card.hidden=!match;
    if(match)matches++;
   }
   count+=matches;
   group.wrapper.hidden=!!query&&!matches;
   const open=query?(transient.get(group.key)??true):(prefs[group.key]??group.defaultOpen);
   group.body.hidden=!open;
   group.button.setAttribute('aria-expanded',String(open));
  }
  status.textContent=query?
   (count?count+(count===1?' unit':' units')+' found':'No matching units'):
   total+(total===1?' unit':' units')+' in your army';
 }
 for(const group of groups){
  group.button.addEventListener('click',()=>{
   if(search.value.trim()){
    transient.set(group.key,group.body.hidden);
   }else{
    prefs[group.key]=group.body.hidden;
    persistPrefs(storageKey,prefs);
   }
   refresh();
  });
 }
 search.addEventListener('input',()=>{
  if(queries.has(storageKey))queries.delete(storageKey);
  queries.set(storageKey,search.value);
  if(queries.size>12)queries.delete(queries.keys().next().value);
  transient.clear();
  refresh();
 });
 attachRosterReorder(container,army,groups,search,refresh);
 refresh();
 attachFocusedUnitView(container,army,groups,refresh);
}

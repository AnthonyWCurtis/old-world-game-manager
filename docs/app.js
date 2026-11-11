import { parseArmy, normalizeImportText, detectFormat } from './parser.js?v=0.4.2';
import { isGameManagerPageText, extractArmyFromPage } from './import-guard.js?v=0.4.2';
import { collectUnmatched, formatUnmatchedDebug } from './unmatched-debug.js?v=0.4.2';
import { wireReportUI } from './report-ui.js?v=0.4.2';
import { hasUnmatchedSelection, unitHasUnmatched, unitMatchState, selectionMatchState } from './match-status.js?v=0.4.2';
import { loadCachedIndexes, refreshIndexes, applyIndexedReferences, applyProfileReferences, checkPageChanges, getCachedUnitProfiles, getPublishedUnitProfiles, mergeUnitProfiles } from './live-source.js?v=0.4.2';
import {loadUnitDataIndex, applyUnitDataReferences, getUnitDetails, getSelectedUnitReferenceDetails} from './unit-data.js?v=0.4.0';
import {renderUnitDataDetails} from './unit-detail-ui.js?v=0.4.0';
import {isInformationalSelection,applyInformationalPlaceholders} from './selection-information.js?v=0.4.2';
import {applySourceScopedSelectionReferences} from './unit-selection-matcher.js?v=1.0.0-alpha.5';
import {applyGenericWizardReferences} from './wizard-references.js?v=1.0.0-alpha.5';
import {renderArmyRosterPage} from './army-roster-page.js?v=1.0.0-alpha.5';
import {renderSpellControls} from './spell-controls.js';
import {projectArmyEffects,setItemEffectState} from './effects-engine.js';
import {renderMagicItemAbilities} from './effects-ui.js';
import {activateSpell,endSpell,expireAtNextStartOfTurn,clearSpellEvent} from './spell-engine.js';
import {restoreStoredImport} from './army-state.js';
import {armySessionKey,restoreBattleSession,assignCharacter,markCharmedShieldUsed,setUnitDisplayName,setWizardKnownSpell} from './battle-session.js';
import {indexedSpells} from './player-customization.js';
import {readBattleSession,writeBattleSession} from './battle-session-store.js';
import {registerOfflineSupport} from './offline.js';
import {GAME_TABS,loadGameLayout,saveGameLayout,setActiveTab,setUnitExpanded} from './game-layout.js';
import {renderGameOverview} from './game-overview.js';
import {renderWizardSpellbook} from './wizard-spellbook-ui.js';
import {unitDisplayName} from './player-customization.js';
const $=id=>document.getElementById(id);
const ACTIVE_TAB_ARMY_KEY='old-world-game-manager-active-army-v1';
let current=null;
const anonymousReports=wireReportUI(()=>current);
let sourceProfiles={};
let unitDataRecords={};
let selectedUnitSourceRecords={};
let selectedPublishedProfiles={};
let battleSession=null;
let magicIndex=null;
let gameLayout=null;
let gameLayoutArmyKey=null;
let gameScrollWrite=null;
function ensureGameLayout(){
 if(!current)return null;
 const key=armySessionKey(current);
 if(!gameLayout||gameLayoutArmyKey!==key){
  gameLayout=loadGameLayout(current);
  gameLayoutArmyKey=key;
 }
 return gameLayout;
}
function rememberGameScroll(){
 if(!current||window.location.hash!=='#army-roster'||!gameLayout)return;
 gameLayout.scroll[gameLayout.tab]=Math.max(0,Math.round(window.scrollY));
 saveGameLayout(gameLayout);
}
function applyGameTab(){
 const state=ensureGameLayout();
 if(!state)return;
 for(const tab of GAME_TABS){
  const panel=$('game'+tab[0].toUpperCase()+tab.slice(1)+'Panel');
  const button=document.querySelector('#gameWorkspaceNav [data-game-tab="'+tab+'"]');
  if(panel)panel.hidden=state.tab!==tab;
  if(button){
   button.setAttribute('aria-selected',String(state.tab===tab));
   button.tabIndex=state.tab===tab?0:-1;
   button.classList.toggle('game-nav-selected',state.tab===tab);
  }
 }
}
function switchGameTab(tab,{focusCaster=null}={}){
 if(!current||!GAME_TABS.includes(tab))return;
 const previous=ensureGameLayout();
 gameLayout=setActiveTab(previous,tab,window.scrollY);
 applyGameTab();
 const scroll=gameLayout.scroll[tab]||0;
 requestAnimationFrame(()=>{
  const limit=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  window.scrollTo({top:Math.min(scroll,limit),behavior:'instant'});
  if(tab==='magic'&&focusCaster){
   const area=$('spellControlPanel');
   const candidate=[...area.querySelectorAll('.game-spell-caster')]
    .find(node=>node.dataset.casterId===focusCaster);
   if(candidate)candidate.open=true;
   area.scrollIntoView({block:'start',behavior:'smooth'});
  }
 });
}
function handleUnitFoldChange(unitId,open){
 gameLayout=setUnitExpanded(ensureGameLayout(),unitId,open);
}
function renderMagicSpellbooks(){
 const holder=$('gameKnownSpellbooks');
 const openBookIds=new Set([...holder.querySelectorAll('details.game-wizard-spellbook[open]')]
  .map(node=>node.dataset.wizardId));
 const previousDrawer=holder.querySelector('#gameKnownSpellbookDrawer');
 const drawerWasOpen=previousDrawer?.open||false;
 holder.replaceChildren();
 const drawer=make('details','game-magic-known-drawer');
 drawer.id='gameKnownSpellbookDrawer';drawer.open=drawerWasOpen;
 const heading=make('summary','game-magic-known-heading','Choose or change spells each Wizard knows');
 drawer.append(heading);
 const intro=make('p','game-spell-disclosure',
  'Select source-linked spells known by each imported Wizard. Selecting a spell does not cast it. Known spells appear in casting controls above.');
 drawer.append(intro);
 let wizardCount=0;
 for(const unit of current.units){
  const book=renderWizardSpellbook(document,unit,battleSession,magicIndex,handleWizardKnownSpell);
  if(!book)continue;
  wizardCount++;
  const block=make('section','game-magic-wizard-book');
  block.append(make('h3','',unitDisplayName(unit,battleSession)));
  book.open=openBookIds.has(unit.id);
  block.append(book);drawer.append(block);
 }
 if(!wizardCount)drawer.append(make('p','game-spell-empty','No Wizards with an indexed lore found in this army.'));
 holder.append(drawer);
}
$('gameWorkspaceNav').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const active=event.target.closest('[data-game-tab]')?.dataset.gameTab;
 if(!active)return;
 event.preventDefault();
 let target=active;
 if(event.key==='Home')target=GAME_TABS[0];
 else if(event.key==='End')target=GAME_TABS[GAME_TABS.length-1];
 else target=GAME_TABS[(GAME_TABS.indexOf(active)+(event.key==='ArrowRight'?1:GAME_TABS.length-1))%GAME_TABS.length];
 switchGameTab(target);
 document.querySelector('#gameWorkspaceNav [data-game-tab="'+target+'"]')?.focus();
});
$('armyRosterPage').addEventListener('click',event=>{
 const tab=event.target.closest('[data-game-tab]')?.dataset.gameTab;
 if(tab)switchGameTab(tab);
});
document.addEventListener('game-manager:open-magic',event=>{
 if(current)switchGameTab('magic',{focusCaster:event.detail?.wizardId});
});
window.addEventListener('scroll',()=>{
 if(window.location.hash!=='#army-roster')return;
 clearTimeout(gameScrollWrite);
 gameScrollWrite=setTimeout(rememberGameScroll,250);
},{passive:true});
window.addEventListener('pagehide',rememberGameScroll);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden')rememberGameScroll();
});
const make=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const missing=f=>f?.value==null?'Unknown':String(f.value);
const showError=msg=>{$('error').hidden=!msg;$('error').textContent=msg||'';};
const sourceOverride=()=>{const val=$('format').value;if(val==='auto')return null;const [exporter,layout]=val.split(':');return {exporter,layout};};
const friendlyExporters={
 'new-recruit':'New Recruit','old-world-builder':'Old World Builder',
 'ingude':'Ingude','battle-builder':'Old World Rankings'
};
const friendlyLayouts={
 'tow':'TOW','nr':'NR','simple':'Simple','simple-text':'Simple text',
 'regular-text':'Regular text','compact-text':'Compact text',
 'minimalist-text':'Minimalist text','regular-discord':'Regular Discord / Markdown',
 'compact-discord':'Compact Discord / Markdown','minimalist-discord':'Minimalist Discord / Markdown',
 'markdown':'Markdown','compact':'Compact','detailed':'Detailed','tournament':'Tournament'
};
function updateFormatDetection(){
 const text=$('sourceText').value;
 const outer=$('formatDetection'),title=$('detectedFormat'),details=$('formatDetails');
 const value=$('format').value;
 $('pasteRecovery').hidden=true;
 if(!text.trim()){
  outer.dataset.state='empty';
  title.textContent='Paste an army list to detect its format';
  details.textContent='The builder and export layout will appear here.';
  return;
 }
 // Imported page text may still contain a valid exporter footer, but
 // must not be shown as a green detected army or parsed as one.
 if(isGameManagerPageText(text)){
  outer.dataset.state='unrecognised';
  title.textContent='✕ Game Manager page pasted — not an army export';
  details.textContent='The pasted text contains the previous app screen and its results. Importing the whole page would duplicate units and points.';
  const candidate=extractArmyFromPage(text);
  $('pasteRecovery').hidden=false;
  $('extractListBtn').disabled=!candidate;
  $('extractListBtn').textContent=candidate?
    'Use the '+candidate.unitCount+'-unit army list found inside':
    'No single clean army list found';
  return;
 }
 // A manual selection is never represented as automatic detection.
 if(value!=='auto'){
  const [exporter,layout]=value.split(':');
  outer.dataset.state='manual';
  title.textContent='Manual: '+(friendlyExporters[exporter]||exporter)+' · '+(friendlyLayouts[layout]||layout);
  details.textContent='Format selected manually — automatic detection is overridden.';
  return;
 }
 try{
  const format=detectFormat(text);
  if(format.exporter==='unknown'||format.layout==='unknown'){
   outer.dataset.state='unrecognised';
   title.textContent='✕ Format not recognised';
   details.textContent='No supported builder and layout combination found. Check the paste or choose a format manually.';
   return;
  }
  const confirmed=format.evidence.includes('exporter attribution');
  const name=friendlyExporters[format.exporter]||format.exporter;
  const layout=friendlyLayouts[format.layout]||format.layout;
  outer.dataset.state='detected';
  title.textContent='✓ '+name+(confirmed?'':'-style')+' · '+layout+' detected';
  details.textContent=confirmed?'Builder identified from its export attribution.':
   'Layout recognised from the text; the builder is not explicitly confirmed.';
 }catch(e){
  outer.dataset.state='unrecognised';
  title.textContent='✕ Format not recognised';
  details.textContent='The pasted text could not be analysed. Check the list or choose a format manually.';
 }
}
const DBNAME = 'old-world-game-manager-imports';
const STORE = 'snapshots';
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('Browser local storage unavailable. You can still analyse and export JSON.'));
  const req=indexedDB.open(DBNAME,2);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});
   if(!req.result.objectStoreNames.contains('battle_sessions'))req.result.createObjectStore('battle_sessions',{keyPath:'armyKey'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Could not open browser storage'));
 });
}
async function dbOperation(mode,action){
 const db=await openDB();
 try {return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  const req=action(store);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Browser storage error'));
  tx.onerror=()=>reject(tx.error||Error('Browser storage transaction failed'));
 });}finally {db.close();}
}
const readAll=()=>dbOperation('readonly',store=>store.getAll());
const readOne=id=>dbOperation('readonly',store=>store.get(id));
const removeOne=id=>dbOperation('readwrite',store=>store.delete(id));
const storeOne=row=>dbOperation('readwrite',store=>store.put(row));
function downloadJSON(filename,contents){
 const blob=new Blob([JSON.stringify(contents,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

const points=n=>n==null?'—':Number(n).toLocaleString('en-GB')+' pts';
const label=(f)=>f?.value==null?'Unknown':f.value;
function badge(state){
 const states={matched:['tag','✓ Matched'],partial:['tag partial','! Partially matched'],unmatched:['tag amb','! Unmatched'],informational:['tag info','i Information']};
 const [cls,text]=states[state]||states.unmatched;
 return make('span',cls,text);
}
function appendSelection(where,s,depth=0,unmatchedOnly=false){
 if(unmatchedOnly&&!hasUnmatchedSelection(s))return;
 const item=make('div','selection');if(depth)item.style.marginLeft=`${Math.min(depth,4)*18}px`;
 item.append(badge(selectionMatchState(s)));
 const main=make('div','selection-main');const top=make('div','selection-name',s.raw);const small=make('div','selection-kind',`${s.kind}${s.owner?(s.owner.startsWith('g')?' · model group':' · attached to '+s.owner):''} · source line ${s.line}`);main.append(top,small);
 if(s.reference){const a=make('a','',`Source: tow.whfb.app`);a.href=s.reference.url;a.target='_blank';a.rel='noopener noreferrer';main.append(a);}
 if(isInformationalSelection(s))main.append(make('div','muted small','Descriptive mount state only — no rule or source reference needed.'));
 if((s.reference?.source==='unit-scoped-data'||s.reference?.source==='generic-wizard-rule')&&s.reference.note)main.append(make('div','muted small',s.reference.note));
 item.append(main);where.append(item);
 for(const child of s.children)appendSelection(where,child,depth+1,unmatchedOnly);
}
// The roster is a view of the parsed data, not a second army parser.
 // Unit order follows the original input, including duplicate unit instances.
// Hash navigation gives the imported army a separate screen without copying
// army state to a second application or risking partial sessionStorage writes.
function battleStateStatus(message,status='ready'){
 const node=$('battleSessionStatus');
 if(!node)return;
 node.textContent=message;
 node.dataset.status=status;
}
async function restoreCurrentBattleSession(){
 const army=current;
 if(!army)return;
 battleSession=restoreBattleSession(army);
 battleStateStatus('Loading saved character assignments…','saving');
 try{
  const stored=await readBattleSession(armySessionKey(army));
  if(current!==army)return;
  battleSession=restoreBattleSession(army,stored);
  battleStateStatus(stored?
   'Character assignments recovered · saved locally on this device.':
   'Character assignments will save automatically on this device.');
 }catch(error){
  if(current!==army)return;
  battleStateStatus('Local saving unavailable: '+(error?.message||error)+
   '. Assignments will last only until this page closes.','error');
 }
}
async function handleCharacterAssignment(characterId,unitId){
 if(!current)return;
 const army=current;
 try{
  battleSession=assignCharacter(army,battleSession,characterId,unitId);
  const state=battleSession;
  renderArmyScreen();
  battleStateStatus('Saving character assignments…','saving');
  try{
   await writeBattleSession(state);
   if(current===army&&battleSession===state)
    battleStateStatus('Character assignments saved automatically on this device.');
  }catch(error){
   if(current===army)
    battleStateStatus('Unable to save this assignment: '+(error?.message||error)+
     '. Keep this page open or retry; the assignment has not been saved.','error');
  }
 }catch(error){
  battleStateStatus('Assignment not made: '+(error?.message||error),'error');
 }
}
async function handleShieldUsage(characterId,used){
 if(!current)return;
 const army=current;
 try{
  battleSession=markCharmedShieldUsed(army,battleSession,characterId,used);
  const state=battleSession;
  renderArmyScreen();
  battleStateStatus('Saving one-use item status…','saving');
  try{
   await writeBattleSession(state);
   if(current===army&&battleSession===state)
    battleStateStatus('Character assignments and one-use items saved automatically on this device.');
  }catch(error){
   if(current===army)
    battleStateStatus('Unable to save item use: '+(error?.message||error)+
    '. The changed status has not been saved.','error');
  }
 }catch(error){
  battleStateStatus('Item status unchanged: '+(error?.message||error),'error');
 }
}
/** The player confirms spell knowledge, casting and targeting; do not invent dice rolls. */
async function persistSpellChange(army,nextState){
 battleSession=nextState;
 renderArmyScreen();
 battleStateStatus('Saving spell activity…','saving');
 try{
  await writeBattleSession(nextState);
  if(current===army&&battleSession===nextState)
   battleStateStatus('Known spells and battle activity saved automatically on this device.');
 }catch(error){
  if(current===army)battleStateStatus('Active spell not saved: '+(error?.message||error)+
   '. The spell status is only in memory until this is resolved.','error');
 }
}
async function handleItemEffectState(ownerId,itemId,status){
 if(!current)return;
 const army=current;
 try{
  const next=setItemEffectState(army,battleSession,ownerId,itemId,status);
  battleSession=next;
  renderArmyScreen();
  battleStateStatus('Saving one-use item activity…','saving');
  try{
   await writeBattleSession(next);
   if(current===army&&battleSession===next)
    battleStateStatus('One-use item activity saved automatically on this device.');
  }catch(error){
   if(current===army)
    battleStateStatus('Item activity could not be saved: '+(error?.message||error)+
     '. The change is only in memory until saving recovers.','error');
  }
 }catch(error){
  battleStateStatus('Item status unchanged: '+(error?.message||error),'error');
 }
}
function handleSpellCast(spec){
 if(!current)return;
 const army=current;
 try{
  const next=activateSpell(army,battleSession,spec);
  void persistSpellChange(army,next);
 }catch(error){battleStateStatus('Spell not recorded: '+(error?.message||error),'error');}
}
function handleSpellEnd({spellId,casterId}){
 if(!current)return;
 const army=current;
 try{
  const next=endSpell(army,battleSession,spellId,casterId);
  void persistSpellChange(army,next);
 }catch(error){battleStateStatus('Spell not ended: '+(error?.message||error),'error');}
}
function handleSpellEventClear({spellId,casterId,targetId}){
 if(!current)return;
 const army=current;
 try{
  const next=clearSpellEvent(army,battleSession,spellId,casterId,targetId);
  void persistSpellChange(army,next);
 }catch(error){battleStateStatus('Movement record not cleared: '+(error?.message||error),'error');}
}
function handleSpellsExpire(){
 if(!current)return;
 const army=current;
 try{
  const next=expireAtNextStartOfTurn(army,battleSession);
  void persistSpellChange(army,next);
 }catch(error){battleStateStatus('Spell expiry failed: '+(error?.message||error),'error');}
}
async function persistPlayerCustomization(army,state,description,render=true){
 battleSession=state;
 if(render)renderArmyScreen();
 battleStateStatus('Saving '+description+'…','saving');
 try{
  await writeBattleSession(state);
  if(current===army&&battleSession===state)
   battleStateStatus('Personal unit names and wizard spellbooks saved automatically on this device.');
 }catch(error){
  if(current===army)battleStateStatus('Could not save '+description+': '+(error?.message||error)+
   '. Changes will be lost when this page closes unless storage recovers.','error');
 }
}
function handleUnitName(unitId,name){
 if(!current)return;
 try{
  const army=current;
  const state=setUnitDisplayName(army,battleSession,unitId,name);
  void persistPlayerCustomization(army,state,'unit name');
 }catch(error){battleStateStatus('Unit not renamed: '+(error?.message||error),'error');}
}
function handleWizardKnownSpell(unitId,spellId,known){
 if(!current)return;
 try{
  const army=current;
  const state=setWizardKnownSpell(army,battleSession,unitId,spellId,known,magicIndex);
  void persistPlayerCustomization(army,state,'known spells',true);
 }catch(error){
  battleStateStatus('Spell selection not saved: '+(error?.message||error),'error');
  renderArmyScreen();
 }
}
function renderArmyScreen(){
 if(!current)return;
 const state=ensureGameLayout();
 const effectProjection=projectArmyEffects(current,battleSession);
 const overview=renderArmyRosterPage($('armyRosterList'),current,unitDataRecords,sourceProfiles,battleSession,handleCharacterAssignment,handleShieldUsage,handleUnitName,handleWizardKnownSpell,magicIndex,state.expandedUnits,handleUnitFoldChange,effectProjection,handleItemEffectState,selectedUnitSourceRecords);
 renderSpellControls($('spellControlPanel'),current,battleSession,{onCast:handleSpellCast,onEnd:handleSpellEnd,onExpire:handleSpellsExpire,onClearEvent:handleSpellEventClear,onItemState:handleItemEffectState,onShieldUse:handleShieldUsage},magicIndex,effectProjection);
 renderMagicItemAbilities($('gameItemAbilities'),effectProjection,battleSession,{
  onItemState:handleItemEffectState,onShieldUse:handleShieldUsage
 });
 renderGameOverview($('gameOverviewContent'),current,battleSession,magicIndex,effectProjection);
 renderMagicSpellbooks();
 applyGameTab();
 const name=label(current.army.name);
 $('armyRosterHeading').textContent=name==='Unknown'?'Imported Army Roster':name;
 const faction=label(current.army.faction);
 $('armyRosterFaction').textContent=faction==='Unknown'?
   'Faction not specified by the exporter':faction;
 const metrics=$('armyRosterSummary');metrics.replaceChildren();
 for(const [number,caption] of [
  [overview.displayedTotal==null?'—':points(overview.displayedTotal),'Imported unit points'],
  [overview.unitInstances,'Unit entries'],
  [overview.knownModelCount,'Models with known counts']
 ]){
  const box=make('div','army-summary-metric');
  box.append(make('strong','',number),make('span','',caption));
  metrics.append(box);
 }
 const available=overview.availableProfiles+
  current.units.filter(u=>!unitDataRecords[u.id]&&
   !!sourceProfiles[u.reference?.url]?.models?.length).length;
 $('armyRosterDataStatus').textContent=
  available+'/'+overview.unitInstances+' unit profiles available · '+
  (overview.unknownModelUnitCount?
   overview.unknownModelUnitCount+' unit count(s) not provided in export. ':'')+
  (available<overview.unitInstances?'Missing profiles are not guessed. ':'')+
  'Reference data is not a legality or points check.';
}
/*
 * A rules/source page may evict the Game Screen on iOS Safari. The #army-roster
 * URL previously redirected straight to #import during a fresh page load,
 * even though the player had already opened the roster. Keep only the active
 * export in this tab's short-lived sessionStorage; persistent saved armies
 * and their battle state remain in IndexedDB as before.
 */
function rememberActiveGameScreen(){
 const text=current?.originalText;
 if(typeof text!=='string'||text.length<10||text.length>500000)return;
 const format=$('format').value;
 const override=format!=='auto'&&/^[a-z-]+:[a-z-]+$/.test(format)?format:null;
 try{
  sessionStorage.setItem(ACTIVE_TAB_ARMY_KEY,JSON.stringify({version:1,text,override}));
 }catch{/* Storage can be unavailable; in-memory navigation still works. */}
}
function restoreActiveGameScreenFromTab(){
 let saved;
 try{saved=JSON.parse(sessionStorage.getItem(ACTIVE_TAB_ARMY_KEY)||'null');}catch{return false;}
 if(saved?.version!==1||typeof saved.text!=='string'||
    saved.text.length<10||saved.text.length>500000)return false;
 const override=typeof saved.override==='string'&&/^[a-z-]+:[a-z-]+$/.test(saved.override)
  ?saved.override:null;
 try{
  const [exporter,layout]=override?override.split(':'):[null,null];
  const restored=parseArmy(saved.text,override?{exporter,layout}:null);
  if(!restored?.units?.length)return false;
  current=restored;applyInformationalPlaceholders(current);applyGenericWizardReferences(current);
  sourceProfiles={};unitDataRecords={};selectedUnitSourceRecords={};selectedPublishedProfiles={};
  $('sourceText').value=restored.originalText;
  $('format').value=override&&[...$('format').options].some(o=>o.value===override)?override:'auto';
  updateFormatDetection();
  const army=current;
  render();
  void restoreCurrentBattleSession().then(()=>{if(current===army)render();}).catch(()=>{});
  void refreshCurrentSource(false);
  return true;
 }catch{
  current=null;
  return false;
 }
}
function showPageForHash({scroll=false}={}){
 const roster=!!current&&window.location.hash==='#army-roster';
 $('importPage').hidden=roster;
 $('armyRosterPage').hidden=!roster;
 if(roster)renderArmyScreen();
 if(scroll){
  const saved=roster?ensureGameLayout()?.scroll?.[gameLayout.tab]||0:0;
  requestAnimationFrame(()=>{
   const limit=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
   window.scrollTo({top:Math.min(saved,limit),behavior:'instant'});
  });
 }
}
function openArmyRoster(){
 if(!current||!current.units.length)return;
 rememberActiveGameScreen();
 if(window.location.hash==='#army-roster')showPageForHash({scroll:true});
 else window.location.hash='army-roster';
}
function closeArmyRoster(){
 rememberGameScroll();
 if(window.location.hash==='#import')showPageForHash({scroll:true});
 else window.location.hash='import';
}
function renderRoster(army){
 const holder=$('roster');
 // Preserve expanded source details across live matching and cache refreshes.
 const expanded=new Set([...holder.querySelectorAll('.roster-entry[data-unit-id] details.unit-data-details[open]')]
  .map(d=>d.closest('.roster-entry')?.dataset.unitId).filter(Boolean));
 holder.replaceChildren();
 const sectionById=new Map(army.sections.map(s=>[s.id,s]));
 let lastSection=undefined,sectionIndex=0;
 for(const unit of army.units){
  const sectionId=unit.sectionId??null;
  if(sectionId!==lastSection){
   const section=sectionById.get(sectionId);
   const heading=make('h3','roster-heading',section?.name??'Units (no army sections in export)');
   const count=army.units.filter(u=>(u.sectionId??null)===sectionId).length;
   heading.append(make('span','roster-section-count',count+' entries'));
   holder.append(heading);
   sectionIndex=0;
   lastSection=sectionId;
  }
  sectionIndex++;
  const card=make('article','roster-entry');
  card.dataset.unitId=unit.id;
  const matchState=unitMatchState(unit);
  if(matchState==='partial')card.classList.add('roster-partial');
  const top=make('div','roster-entry-head');
  top.append(make('span','roster-number',String(sectionIndex)+'.'));
  const unitName=unit.quantity?.value==null?unit.name:unit.quantity.value+'× '+unit.name;
  const name=make('strong','roster-name',unitName);
  if(matchState==='partial')name.title='Some selections lack source references';
  if(unit.nickname){
   const labelled=make('span','roster-name-group');
   labelled.append(name,make('span','roster-nickname','Nickname: '+unit.nickname));
   top.append(labelled);
  }else{
   top.append(name);
  }
  top.append(make('span','roster-cost',points(unit.reportedPoints?.value)));
  card.append(top);
  const entries=[];
  // Group consecutive selections by source line; model groups retain their own lines.
  for(const selection of unit.selections??[]){
   const last=entries[entries.length-1];
   if(last?.type==='selections' && last.line===selection.line)last.items.push(selection.raw);
   else entries.push({type:'selections',line:selection.line,items:[selection.raw]});
  }
  for(const group of unit.modelGroups??[]){
   entries.push({type:'group',line:group.line,raw:group.raw,
    name:group.name,quantity:group.quantity,options:(group.selections??[]).map(s=>s.raw)});
  }
  entries.sort((a,b)=>(a.line??0)-(b.line??0));
  if(entries.length){
   const details=make('div','roster-entry-details');
   for(const entry of entries){
    if(entry.type==='selections'){
     details.append(make('div','roster-options',entry.items.join(' · ')));
    }else{
     const groupText=entry.raw?.trim()||entry.quantity+'× '+entry.name;
     const groupRow=make('div','roster-group',groupText);
     details.append(groupRow);
     // Source group text already includes its own options; don't repeat them.
    }
   }
   card.append(details);
  }
  const detailedRecord=unitDataRecords[unit.id];
  if(detailedRecord){
   const panel=renderUnitDataDetails(detailedRecord);
   if(expanded.has(unit.id))panel.open=true;
   card.append(panel);
  }
  const cachedProfile=detailedRecord?null:sourceProfiles[unit.reference?.url];
  if(cachedProfile?.models?.length){
   const sourceBox=make('div','roster-base-profile');
   const head=make('strong','', 'TOW source characteristics (base profile; upgrades not applied)');
   sourceBox.append(head);
   for(const model of cachedProfile.models.slice(0,4)){
    const entries=Object.entries(model.characteristics||{}).map(([k,v])=>k+' '+v).join(' · ');
    sourceBox.append(make('div','roster-statline',model.name+' — '+entries));
   }
   const details=[];
   if(cachedProfile.baseCost!=null)details.push('Base cost '+cachedProfile.baseCost+' pts');
   if(cachedProfile.category)details.push('Unit category: '+cachedProfile.category);
   if(cachedProfile.troopType)details.push('Troop type: '+cachedProfile.troopType);
   if(details.length)sourceBox.append(make('div','roster-stat-meta',details.join(' · ')));
   const link=make('a','roster-source-link','View source page ↗');
   link.href=cachedProfile.url;link.target='_blank';link.rel='noopener noreferrer';
   sourceBox.append(link);
   card.append(sourceBox);
  }
  holder.append(card);
 }
}
let sourceJob=0;
function sourceStatus(message){
 const p=$('sourceStatus');
 if(p)p.textContent=message;
}
async function refreshCurrentSource(force=false){
 const army=current;
 if(!army)return;
 const job=++sourceJob;
 $('sourceRefreshBtn').disabled=true;
 sourceStatus('Reading previously cached references…');
 const active=()=>current===army&&job===sourceJob;
 // Independent version-pinned source dataset: fetch only the needed unit shards.
 // This never changes imported points, equipment selections or legality status.
 void (async()=>{
  const status=$('unitDataStatus');
  try{
   status.textContent='Reading versioned source unit data…';
   const index=await loadUnitDataIndex();
   if(!active())return;
   applyUnitDataReferences(army,index);
   render();
   const result=await getUnitDetails(army,index);
   if(!active())return;
   unitDataRecords=result.records;
   applySourceScopedSelectionReferences(army,unitDataRecords);
   render();
   // Main unit records are ready: do not hold their status hostage to
   // optional selected-mount reference or fallback snapshot retrieval.
   status.textContent='Unit profiles available for '+result.matched+'/'+army.units.length+
     ' roster entries · '+index.counts.units+' units in source snapshot · '+
     index.counts.unitsWithWarnings+' records have extraction flags. '+
     (result.errors.length?'Some unit data unavailable; cached records retained where possible. ':'')+
     'Source-extracted: upgrades, costs and army legality are not independently verified.';
   try{
    const referenced=await getSelectedUnitReferenceDetails(army,index);
    if(!active())return;
    selectedUnitSourceRecords=referenced.byUrl;
    // Re-select only exactly matched option source URLs after links exist.
    selectedPublishedProfiles=await getPublishedUnitProfiles(army).catch(()=>({}));
    if(!active())return;
    sourceProfiles={...sourceProfiles,...selectedPublishedProfiles};
    render();
   }catch(error){
    if(active())console.warn('Selected option profiles unavailable; imported roster unaffected',error);
   }
  }catch(error){
   if(active())status.textContent='Unit reference data unavailable: '+
     (error?.message||error)+'. The imported roster is unaffected.';
  }
 })();
 try{
  // Public pages without browser CORS are read from the last GitHub Actions
  // source snapshot. Matching remains scoped to the unit's actual source URL.
  let published=await getPublishedUnitProfiles(army).catch(()=>({}));
  if(!active())return;
  sourceProfiles={...mergeUnitProfiles(published,await getCachedUnitProfiles(army)),...selectedPublishedProfiles};
  if(!active())return;
  applyProfileReferences(army,sourceProfiles);
  render();
  const cached=await loadCachedIndexes();
  if(!active())return;
  if(cached.entries.length){
   applyIndexedReferences(army,cached.entries);
   sourceProfiles={...mergeUnitProfiles(published,await getCachedUnitProfiles(army)),...selectedPublishedProfiles};
   if(!active())return;
   applyProfileReferences(army,sourceProfiles);
   render();
   sourceStatus('Showing '+cached.indexCount+' cached source indexes. Checking for updates…');
  }else{
   sourceStatus('No cached source indexes yet. Checking tow.whfb.app…');
  }
  const latest=await refreshIndexes({force});
  if(!active())return;
  if(latest.entries.length){
   applyIndexedReferences(army,latest.entries);
   sourceProfiles={...mergeUnitProfiles(published,await getCachedUnitProfiles(army)),...selectedPublishedProfiles};
   if(!active())return;
   applyProfileReferences(army,sourceProfiles);
   render();
   const stamped=latest.lastChecked?new Date(latest.lastChecked).toLocaleString():'unknown time';
   sourceStatus('Linked '+army.stats.matchedUnits+'/'+army.stats.unitCount+' units and '+
     army.stats.matchedSelections+'/'+army.stats.selectionCount+' selections. '+
     (latest.networkCount?latest.networkCount+' source indexes refreshed. ':'Cached indexes reused. ')+
     'Last index check: '+stamped+'.'+
     (latest.errors.length?' Some sources unavailable: '+latest.errors.join('; ')+'.':'')+
     ' Checking individual pages for changes…');
  }else{
   sourceStatus('Live source indexes unavailable. Existing reviewed links and imported roster are preserved. '+
     (latest.errors.length?latest.errors.join('; '):''));
  }
  const pages=await checkPageChanges(army,{force,maxPages:12});
  if(!active())return;
  sourceProfiles={...mergeUnitProfiles(published,await getCachedUnitProfiles(army)),...selectedPublishedProfiles};
  if(!active())return;
  applyProfileReferences(army,sourceProfiles);
  render();
  const changes=pages.changed.length?
    pages.changed.length+' source page(s) changed since the previous check. Review at tow.whfb.app: '+
      pages.changed.map(url=>new URL(url).pathname).join(', ')+'. ':
    (pages.checked?'No changes detected among the pages checked. ':'Recent cached page checks reused. ');
  const checked=pages.checked+' page(s) checked; '+pages.total+' unique references in roster. ';
  sourceStatus('Linked '+army.stats.matchedUnits+'/'+army.stats.unitCount+' units and '+
    army.stats.matchedSelections+'/'+army.stats.selectionCount+' selections. '+changes+checked+
    (pages.pending?pages.pending+' more due; these will be checked on another import. ':'')+
    (pages.errors.length?pages.errors.length+' page check(s) failed; cached data retained. ':'')+
    (latest.errors.length?'Some source indexes could not be refreshed; cached indexes retained. ':'')+
    'Last check '+new Date().toLocaleTimeString()+'. Source matching does not validate rules or army legality.');
 }catch(error){
  if(active())sourceStatus('Source refresh failed: '+(error?.message||error)+
    '. Your imported roster and cached references remain available.');
 }finally{
  if(active())$('sourceRefreshBtn').disabled=false;
 }
}
let debugReportArmy=null;
function syncUnmatchedDebug(){
 const records=collectUnmatched(current);
 const button=$('copyUnmatchedBtn');
 const fallback=$('unmatchedDebugFallback');
 const feedback=$('copyUnmatchedStatus');
 if(debugReportArmy!==current){
  debugReportArmy=current;
  feedback.textContent='';
  fallback.hidden=true;
  fallback.value='';
  $('selectUnmatchedBtn').hidden=true;
 }
 button.disabled=!records.length;
 button.textContent=records.length?'Copy unmatched debug ('+records.length+')':'No unmatched references';
 if(!records.length){
  fallback.hidden=true;
  $('selectUnmatchedBtn').hidden=true;
  feedback.textContent='';
 }else if(!fallback.hidden){
  const newText=formatUnmatchedDebug(current,{appVersion:'1.0.0-alpha.5'});
  if(fallback.value!==newText){
   fallback.value=newText;
   feedback.textContent='Source matches updated. The debug report below is up to date.';
  }
 }
}
function selectUnmatchedText(){
 const fallback=$('unmatchedDebugFallback');
 if(fallback.hidden)return;
 fallback.focus();
 fallback.select();
 fallback.setSelectionRange(0,fallback.value.length);
 $('copyUnmatchedStatus').textContent='Text selected. Choose Copy from your browser, then paste into ChatGPT.';
}
async function copyUnmatchedDebug(){
 if(!current)return;
 const records=collectUnmatched(current);
 if(!records.length){
  $('copyUnmatchedStatus').textContent='No unmatched references to copy.';
  return;
 }
 const text=formatUnmatchedDebug(current,{appVersion:'1.0.0-alpha.5'});
 const feedback=$('copyUnmatchedStatus');
 const fallback=$('unmatchedDebugFallback');
 // Show the actual report synchronously. A blocked clipboard can never make
 // the click look inert, and a later render won't discard this preview.
 fallback.value=text;
 fallback.hidden=false;
 $('selectUnmatchedBtn').hidden=false;
 feedback.textContent='Debug report shown below. Attempting to copy to clipboard…';
 try {
  if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(text);
   feedback.textContent='Copied '+records.length+' unmatched reference'+(records.length===1?'':'s')+'. Paste into ChatGPT.';
  }else{
   selectUnmatchedText();
   if(document.execCommand?.('copy')){
    feedback.textContent='Copied '+records.length+' unmatched reference'+(records.length===1?'':'s')+'. Paste into ChatGPT.';
   }else{
    feedback.textContent='Clipboard permission unavailable. Select and copy the report below.';
   }
  }
 }catch(error){
  feedback.textContent='Clipboard access was blocked. The full debug report is displayed below; use Select text and copy manually.';
 }
}
function render(){
 if(!current)return;
 anonymousReports.refresh();
 $('result').hidden=false;$('armyTitle').textContent=label(current.army.name)||'Unnamed army';
 $('formatLabel').textContent=`${current.format.exporter} · ${current.format.layout} · ${current.format.confidence} confidence`;
 const fields=[['Faction',current.army.faction],['Composition',current.army.composition],['Game format',current.army.gameFormat],['Player',current.army.player],['Imported total',current.army.reportedPoints],['Calculated sum',current.army.derivedPoints],['Points limit',current.army.limitPoints]];
 $('armyMeta').textContent=fields.map(([k,f])=>`${k}: ${k.toLowerCase().includes('total')||k.toLowerCase().includes('sum')||k.toLowerCase().includes('limit')?points(f.value):label(f)}`).join('  ·  ');
 const m=$('metrics');m.replaceChildren();for(const [value,title] of [[current.stats.unitCount,'Unit instances'],[current.stats.selectionCount,'Selections (incl. nested)'],[current.stats.matchedSelections,'Matched selections'],[current.stats.unmatchedSelections,'Unmatched selections'],[current.stats.informationalSelections||0,'Informational entries']]){
  const d=make('div','metric'),v=make('strong','',value),t=make('span','',title);d.append(v,t);m.append(d);
 }
 syncUnmatchedDebug();
 const diag=$('diagnostics');diag.replaceChildren();$('diagnosticCount').textContent=`${current.diagnostics.length} messages`;
 if(!current.diagnostics.length)diag.append(make('p','muted small','No structural warnings. This does not mean all reference data is matched.'));
 for(const d of current.diagnostics)diag.append(make('div','notice',`${d.severity.toUpperCase()} · ${d.code}${d.line?' · line '+d.line:''}: ${d.message}`));
 const displaySource=normalizeImportText(current.originalText);
 $('rawText').textContent=displaySource.text;
 $('encodedPanel').hidden=displaySource.encoding!=='percent-encoded';
 $('encodedText').textContent=displaySource.encoding==='percent-encoded'?current.originalText:'';
 renderRoster(current);
 const unitHolder=$('units');unitHolder.replaceChildren();const only=$('unmatchedOnly').checked;
 const sections=[...current.sections.map(s=>({id:s.id,name:s.name,points:s.reportedPoints.value})),{id:null,name:'Uncategorised',points:null}];
 for(const sec of sections){
  const all=current.units.filter(u=>u.sectionId===sec.id),uList=only?all.filter(unitHasUnmatched):all;
  if(!uList.length)continue;
  unitHolder.append(make('h3','section-heading',`${sec.name} · ${all.length} entries${sec.points!=null?' · '+points(sec.points):''}`));
  for(const u of uList){
   const d=make('details','unit');const summary=make('summary');const left=make('div','unit-top');left.append(badge(unitMatchState(u)));const displayName=make('span','',u.quantity.value==null?u.name:`${u.quantity.value}× ${u.name}`);
   if(u.nickname)displayName.title='Nickname: '+u.nickname;
   left.append(displayName);
   if(u.nickname)left.append(make('span','unit-nickname', '“'+u.nickname+'”'));
   const right=make('div','unit-right',points(u.reportedPoints.value));summary.append(left,right);d.append(summary);
   const body=make('div','unit-body');body.append(make('p','muted small',`Source line ${u.line} · quantity ${u.quantity.origin} · ${u.matchStatus} reference`));
   if(u.reference){const a=make('a','small','Open unit reference ↗');a.href=u.reference.url;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
   for(const s of u.selections)appendSelection(body,s,0,only);
   for(const g of u.modelGroups){const gr=make('div','group');gr.append(make('strong','',`${g.quantity}× ${g.name}${g.pointsPerModel!=null?' · displayed model cost '+points(g.pointsPerModel):''}`));
    for(const s of g.selections)appendSelection(gr,s,0,only);body.append(gr);}
   d.append(body);unitHolder.append(d);
  }
 }
 $('saveBtn').disabled=false;$('jsonBtn').disabled=false;
 $('viewRosterBtn').disabled=!current.units.length;
 $('resumeGameBtn').hidden=!current.units.length;
 if(window.location.hash==='#army-roster')showPageForHash();
}
$('viewRosterBtn').addEventListener('click',openArmyRoster);
$('resumeGameBtn').addEventListener('click',openArmyRoster);
$('gameScreenSaveBtn').addEventListener('click',()=> $('saveBtn').click());
for(const [buttonId,targetId] of [
 ['gameScreenJumpCharacters','gameCharacters'],
 ['gameScreenJumpRegiments','gameRegiments']
]){
 $(buttonId).addEventListener('click',()=>{
  if(!current)return;
  const section=$(targetId);
  if(section)section.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
$('backToImporterBtn').addEventListener('click',closeArmyRoster);
$('backToImporterBottomBtn').addEventListener('click',closeArmyRoster);
window.addEventListener('hashchange',()=>showPageForHash({scroll:true}));
$('sourceText').addEventListener('input',updateFormatDetection);
$('format').addEventListener('change',updateFormatDetection);
$('extractListBtn').addEventListener('click',()=>{
 const extracted=extractArmyFromPage($('sourceText').value);
 if(!extracted){showError('Could not identify a single clean export. Copy only the army list from your builder.');return;}
 $('sourceText').value=extracted.text;
 $('format').value='auto';
 current=null;sourceProfiles={};unitDataRecords={};selectedUnitSourceRecords={};selectedPublishedProfiles={};
 $('result').hidden=true;$('resumeGameBtn').hidden=true;$('saveBtn').disabled=true;$('jsonBtn').disabled=true;
 showError('');updateFormatDetection();
 $('sourceText').focus();
});
$('parseBtn').addEventListener('click',async()=>{
 showError('');$('parseBtn').disabled=true;
 try{const input=$('sourceText').value; if(input.trim().length<10||input.length>500000)throw Error('Provide a list between 10 and 500,000 characters.'); if(isGameManagerPageText(input))throw Error('This is a copied Game Manager page, not just an army export. Use the recovery option above or paste the original army list.'); current=parseArmy(input,sourceOverride());applyInformationalPlaceholders(current);applyGenericWizardReferences(current);sourceProfiles={};unitDataRecords={};selectedUnitSourceRecords={};selectedPublishedProfiles={};const restoring=restoreCurrentBattleSession();render();$('result').scrollIntoView({behavior:'smooth'});await restoring;if(current)render();void refreshCurrentSource(false);}
 catch(e){showError(e.message);}finally{$('parseBtn').disabled=false;}
});
$('unmatchedOnly').addEventListener('change',render);
$('copyUnmatchedBtn').addEventListener('click',()=>void copyUnmatchedDebug());
$('selectUnmatchedBtn').addEventListener('click',selectUnmatchedText);
$('sourceRefreshBtn').addEventListener('click',()=>void refreshCurrentSource(true));
$('saveBtn').addEventListener('click',async()=>{
 showError('');if(!current)return;
 try{const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),title:current.army.name.value,exporter:current.format.exporter,layout:current.format.layout,original_text:current.originalText,result:current};await storeOne(row);render();await refresh();alert('Saved in this browser on this device.');}catch(e){showError(e.message);}
});
$('jsonBtn').addEventListener('click',()=>{if(!current)return;downloadJSON('army-import.json',current);});
async function refresh(){const rows=(await readAll()).sort((a,b)=>b.created_at.localeCompare(a.created_at));const holder=$('savedList');holder.replaceChildren();if(!rows.length){holder.append(make('p','muted small','No saved snapshots yet.'));return;}
 for(const r of rows){const line=make('div','row-item');const info=make('div');info.append(make('strong','',r.title||'Unnamed army'),make('div','muted small',`${r.exporter} · ${r.layout} · ${new Date(r.created_at).toLocaleString()}`));
  const buttons=make('div');const open=make('button','smallbtn','Open');open.addEventListener('click',async()=>{try{const loaded=await readOne(r.id);if(!loaded)throw Error('Saved snapshot not found');current=restoreStoredImport(loaded);applyInformationalPlaceholders(current);applyGenericWizardReferences(current);sourceProfiles={};unitDataRecords={};selectedUnitSourceRecords={};selectedPublishedProfiles={};await restoreCurrentBattleSession();$('sourceText').value=current.originalText;$('format').value='auto';updateFormatDetection();render();openArmyRoster();void refreshCurrentSource(false);}catch(e){showError(e.message);}});
  const del=make('button','smallbtn','Delete');del.addEventListener('click',async()=>{if(!confirm('Permanently delete this saved snapshot?'))return;await removeOne(r.id);await refresh();});buttons.append(open,del);line.append(info,buttons);holder.append(line);
 }
}
$('exampleBtn').addEventListener('click',async()=>{
 const id=$('examples').value;if(!id)return;
 try{const r=await fetch('./examples/'+encodeURIComponent(id)+'.txt');if(!r.ok)throw Error('Could not load sample');$('sourceText').value=await r.text();$('format').value='auto';updateFormatDetection();current=null;unitDataRecords={};$('result').hidden=true;$('resumeGameBtn').hidden=true;$('saveBtn').disabled=true;$('jsonBtn').disabled=true;showError('');}
 catch(e){showError(e.message);}
});
fetch('./examples/manifest.json').then(r=>{if(!r.ok)throw Error('Could not load sample manifest');return r.json();}).then(items=>{for(const item of items){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;$('examples').append(opt);}}).catch(e=>showError(e.message));
$('refreshBtn').addEventListener('click' ,()=>refresh().catch(e=>showError(e.message)));
$('backupBtn').addEventListener('click',async()=>{try{const rows=await readAll();if(!rows.length)throw Error('No saved snapshots to back up yet.');downloadJSON('old-world-game-manager-backup.json',{schemaVersion:1,exportedAt:new Date().toISOString(),snapshots:rows});}catch(e){showError(e.message);}});
async function loadMagicIndex(){
 try{
  const response=await fetch('./reference-records/magic-index.json',{cache:'force-cache'});
  if(!response.ok)throw Error('Magic index is unavailable');
  const index=await response.json();
  if(!indexedSpells(index).length)throw Error('Magic index could not be validated');
  magicIndex=index;
 }catch(error){
  magicIndex=null;
  if(current)battleStateStatus('Magic list unavailable: '+(error?.message||error)+
   '. Other game features remain available.','error');
 }
 if(current&&window.location.hash==='#army-roster')renderArmyScreen();
}
updateFormatDetection();
void loadMagicIndex();
// Restore the current tab's last open Game Screen before deciding the route.
// This handles iOS Safari returning from another page without choosing a
// different saved army or erasing any player-owned battle records.
if(window.location.hash==='#army-roster'&&!current&&!restoreActiveGameScreenFromTab())
 history.replaceState(null,'',window.location.pathname+window.location.search+'#import');
showPageForHash();
refresh().catch(e=>showError(e.message));
void registerOfflineSupport();

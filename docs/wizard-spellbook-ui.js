/** Mobile-first spell knowledge selector. Knowing a spell is NOT casting it. */
import {spellsForWizard,wizardDescriptor,unitDisplayName} from './player-customization.js';
const el=(doc,tag,cls='',value)=>{
 const n=doc.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);return n;
};
export function renderWizardSpellbook(doc,unit,session,index,onKnownSpell=()=>{}){
 const wizard=wizardDescriptor(unit,index);
 if(!wizard)return null;
 const panel=el(doc,'details','game-wizard-spellbook');
 panel.dataset.wizardId=unit.id;
 const selection=new Set(session?.knownSpells?.[unit.id]||[]);
 const summary=el(doc,'summary','', 'Known spells · '+selection.size+' selected');
 panel.append(summary);
 const body=el(doc,'div','game-wizard-spellbook-body');
 const level=wizard.level?'Level '+wizard.level+' Wizard':'Wizard level not confirmed';
 const lore=wizard.lores.length?wizard.lores.join(' / '):'Lore not identified in the imported selections';
 body.append(el(doc,'p','game-spell-activity',level+' · '+lore));

 body.append(el(doc,'p','game-spell-disclosure',
  'Only spells listed on the imported lore source pages are offered. Their appearance does not verify how the wizard generated or learned them, permitted substitutions, number known, or list legality. Selecting a spell never casts it.'));
 const spells=spellsForWizard(unit,index);
 if(!wizard.lores.length){
  body.append(el(doc,'p','game-spell-warning',
   'No source-indexed lore was found in this Wizard’s imported selections. No spells can be offered without a confirmed lore.'));
  panel.append(body);return panel;
 }
 if(index?.loreLinks?.status!=='source-lore-page-indexed'){
  body.append(el(doc,'p','game-spell-warning',
   'Verified lore-to-spell references are unavailable. The app will not show unrelated spells as a fallback.'));
  panel.append(body);return panel;
 }
 if(!spells.length){
  body.append(el(doc,'p','game-spell-warning',
   'No spells are source-linked to the imported lore yet. Check the source index; other lores will not be shown.'));
  panel.append(body);return panel;
 }
 body.append(el(doc,'p','game-spell-activity',
  'Showing '+spells.length+' source-linked spell'+(spells.length===1?'':'s')+' from '+wizard.lores.join(' / ')+'.'));
 const allowed=new Set(spells.map(s=>s.id));
 const outOfLore=[...selection].filter(id=>!allowed.has(id));
 if(outOfLore.length){
  const notice=el(doc,'p','game-spell-warning',
   outOfLore.length+' previously saved spell choice(s) are outside the current imported lore and are hidden. They remain saved until you clear them.');
  const clear=el(doc,'button','game-wizard-clear-previous','Clear previous off-lore selections');
  clear.type='button';
  clear.addEventListener('click',()=>{
   for(const id of outOfLore){selection.delete(id);onKnownSpell(unit.id,id,false);}
   notice.hidden=true;clear.hidden=true;
   summary.textContent='Known spells · '+selection.size+' selected';
  });
  body.append(notice,clear);
 }
 const search=el(doc,'input','game-wizard-spell-search');
 search.type='search';search.placeholder='Search '+spells.length+' lore spells…';
 search.setAttribute('aria-label','Search '+wizard.lores.join(' / ')+' spells for '+unitDisplayName(unit,session));
 body.append(search);
 const list=el(doc,'div','game-wizard-spell-list');
 for(const spell of spells){
  const row=el(doc,'div','game-wizard-spell-row');
  row.dataset.search=spell.name.toLowerCase();
  const label=el(doc,'label','game-wizard-spell-choice');
  const check=el(doc,'input');
  check.type='checkbox';check.checked=selection.has(spell.id);
  check.setAttribute('aria-label',spell.name+' known by '+unitDisplayName(unit,session));
  const name=el(doc,'span','',spell.name);
  label.append(check,name);row.append(label);
  const link=el(doc,'a','game-spell-source','Source');
  link.href=spell.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
  const fromImport=wizard.importedSpellNames.has(spell.name.toLowerCase());
  if(fromImport)row.append(el(doc,'span','game-wizard-imported','In export'));
  if(spell.signatureIn?.length)row.append(el(doc,'span','game-wizard-signature','Signature · '+spell.signatureIn.join(' / ')));
  if(wizard.lores.length>1)row.append(el(doc,'span','game-wizard-lore-tag',spell.lores.join(' / ')));
  check.addEventListener('change',()=>{
   const next=check.checked;
   if(next)selection.add(spell.id);else selection.delete(spell.id);
   summary.textContent='Known spells · '+selection.size+' selected';
   onKnownSpell(unit.id,spell.id,next);
  });
  list.append(row);
 }
 search.addEventListener('input',()=>{
  const q=search.value.trim().toLowerCase();
  for(const row of list.children)row.hidden=!row.dataset.search.includes(q);
 });
 body.append(list);panel.append(body);
 return panel;
}

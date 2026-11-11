/** Mobile-first spell knowledge selector. Knowing a spell is NOT casting it. */
import {indexedSpells,wizardDescriptor,unitDisplayName} from './player-customization.js';
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
  'Record spells known by this specific wizard. Source-indexed spell names are not proof of lore membership, generation, number known or list legality; check the published rules. These choices do not cast spells or activate effects.'));
 const spells=indexedSpells(index);
 if(!spells.length){
  body.append(el(doc,'p','game-spell-warning','The imported magic index is not available. No spell choices will be guessed.'));
  panel.append(body);return panel;
 }
 const search=el(doc,'input','game-wizard-spell-search');
 search.type='search';search.placeholder='Search '+spells.length+' indexed spells…';
 search.setAttribute('aria-label','Search spells for '+unitDisplayName(unit,session));
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

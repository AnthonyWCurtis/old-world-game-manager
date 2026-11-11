/**
 * Generic Wizard rules references, independent of character/unit eligibility.
 *
 * Linking a name to the published general rules does NOT verify a selected
 * Wizard level, legal upgrade, points paid or game effect for the parent unit.
 * Those require separately reviewed parent-unit evidence.
 */
import {allArmySelections,recountReferenceStats,isInformationalSelection} from './selection-information.js';

const WIZARDS_URL='https://tow.whfb.app/magic/wizards';
const LEVELS_URL='https://tow.whfb.app/magic/levels-of-wizardry';
const normalize=value=>String(value??'').normalize('NFKC').trim()
 .replace(/\s+/g,' ').toLowerCase();

/** Return a new general-rules reference for exact Wizard / Level 1–4 Wizard labels. */
export function matchWizardRuleReference(selection){
 if(selection?.kind!=='wizard-level')return null;
 const name=normalize(selection.name);
 const match=name.match(/^level ([1-4]) wizard$/);
 if(name!=='wizard'&&!match)return null;
 const level=match?Number(match[1]):null;
 return {
  id:level===null?'wizard-rule:wizard':'wizard-rule:level-'+level,
  name:level===null?'Wizard':'Level '+level+' Wizard',
  url:level===null?WIZARDS_URL:LEVELS_URL,
  type:'wizard-level',
  source:'generic-wizard-rule',
  verificationStatus:'source-indexed',
  evidence:'general-wizard-rules',
  eligibilityVerified:false,
  ...(level===null?{}:{level}),
  note:'General rules reference only. The character unit page determines Wizard ability and permitted levels; no selection legality, points or effects have been verified.'
 };
}

/**
 * Apply only to otherwise unlinked selections. Reviewed, manually mapped,
 * parent-scoped and independently indexed references always take precedence.
 * The source-scoped matcher may later refine a generic reference.
 */
export function applyGenericWizardReferences(army){
 if(!Array.isArray(army?.units))return {added:0};
 let added=0;
 for(const selection of allArmySelections(army)){
  if(isInformationalSelection(selection)||selection.reference)continue;
  const ref=matchWizardRuleReference(selection);
  if(!ref)continue;
  if(selection.matchStatus!=='matched')added++;
  selection.reference=ref;
  selection.matchStatus='matched';
 }
 recountReferenceStats(army);
 return {added};
}

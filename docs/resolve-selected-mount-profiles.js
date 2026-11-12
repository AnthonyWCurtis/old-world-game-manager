import {sourcePrintedArmour} from './source-printed-armour.js';
import {compareRiderMountArmour} from './mount-armour-choice.js';
import {publishedMountBenefits} from './published-mount-benefits.js';
import {importedSelectionMatchesName} from './imported-unit-display.js';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
const validSource=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+$/.test(url);
const kindOf=record=>{
 const categories=[...(record?.classification?.unitCategory||[]),
  ...(record?.classification?.troopType||[])].map(norm);
 if(categories.some(x=>x.includes('chariot')))return 'chariot';
 if(categories.some(x=>/\bmonster\b|monstrous creature|behemoth/.test(x)))return 'riddenMonster';
 if(categories.some(x=>x.includes('cavalry')))return 'cavalry';
 return null;
};
/**
 * Candidate is linked by exact selected option URL to the pinned published
 * unit record and separate source-page armour snapshot. Source data does not
 * establish permission to mount or the rider-specific armour save.
 */
export function resolveSelectedMountProfiles(unit,recordsByUrl={},fallbackProfiles={},riderArmour=null){
 if(!unit||!validSource(unit.reference?.url))return [];
 const result=[],seen=new Set();
 const walk=items=>{
  for(const item of Array.isArray(items)?items:[]){
   const url=item?.reference?.url,record=recordsByUrl?.[url];
   if(validSource(url)&&record?.source?.sourceUrl===url&&
      record.source.verificationStatus==='source-extracted'&&!seen.has(url)){
    const type=kindOf(record),printed=sourcePrintedArmour(record,fallbackProfiles[url]);
    if(type){
     seen.add(url);
     const comparison=compareRiderMountArmour({
      mountType:type,riderValue:Number.isInteger(riderArmour)?riderArmour:null,
      mountValue:printed?.value??null,mountSourceUrl:printed?.sourceUrl,
      modelScopeVerified:false
     });
     const publishedBenefits=publishedMountBenefits(record,type);
     if(publishedBenefits)
      publishedBenefits.specialRules=publishedBenefits.specialRules.filter(rule=>
       rule.status!=='not-selected'||importedSelectionMatchesName(unit,rule.name));
     result.push({name:String(item.name||item.raw||record.name),sourceUrl:url,
      mountType:type,printedArmour:printed,comparison,
      publishedBenefits,
      status:'source-linked candidate; mounted-model association and eligibility unverified',
      ruleUrl:comparison.ruleUrl});
    }
   }
   walk(item?.children);
  }
 };
 walk(unit.selections);
 for(const group of unit.modelGroups||[])walk(group.selections);
 return result;
}

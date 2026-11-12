/**
 * Small, provenance-checked source weapon catalogue for the Shooting section.
 * Values were transcribed from tow.whfb.app weapon pages (2026-11-12).
 * Only an exact linked weapon reference on the imported unit is displayed.
 * Missing/unreviewed weapons are not inferred from names or faction.
 */
import {unitEquipmentAndRules} from './unit-equipment-and-rules.js';

const origin='https://tow.whfb.app/weapons-of-war/';
const profile=(slug,range,strength,ap,weaponFamily)=>Object.freeze({
 sourceUrl:origin+slug,range,strength,ap,weaponFamily,
 verificationStatus:'source-reviewed'
});
export const REVIEWED_MISSILE_WEAPONS=Object.freeze({
 [origin+'warbow']:profile('warbow','24"','S','–','bow'),
 [origin+'shortbow']:profile('shortbow','18"','3','–','bow'),
 [origin+'longbow']:profile('longbow','30"','3','–','bow'),
 [origin+'crossbow']:profile('crossbow','30"','4','–','crossbow')
});
export function selectedMissileWeapons(unit,record){
 const loadout=unitEquipmentAndRules(unit,record);
 if(!loadout.sourceVerified)return [];
 const result=[],seen=new Set();
 for(const entry of loadout.groups.equipment){
  const info=REVIEWED_MISSILE_WEAPONS[entry.sourceUrl];
  if(!info||seen.has(entry.sourceUrl))continue;
  seen.add(entry.sourceUrl);
  result.push({name:entry.name,sourceUrl:info.sourceUrl,
   range:info.range,strength:info.strength,armourPiercing:info.ap,weaponFamily:info.weaponFamily,
   scope:entry.scope,verificationStatus:info.verificationStatus});
 }
 return result;
}

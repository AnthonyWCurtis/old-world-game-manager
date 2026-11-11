/**
 * Explicit source-printed armour is reference data only. It does not modify
 * the imported model's equipment-only save or a combat-specific final save.
 */
export function sourcePrintedArmour(record,fallback){
 const item=fallback?.publishedArmour;
 const source=record?.source?.sourceUrl;
 if(!source||!item||item.verificationStatus!=='source-page-extracted'||
    source!==item.sourceUrl||!/^https:\/\/tow\.whfb\.app\/unit\/[a-z0-9-]+$/.test(source)||
    !Number.isInteger(item.value)||item.value<2||item.value>7||
    item.label!==item.value+'+')return null;
 return {label:item.label,value:item.value,sourceUrl:source,
  scope:'Published unit/chassis value; model allocation and application not established'};
}

/** Helpers for the current single-roster Compact Game Screen. */
export async function showUnitsAndExpand(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 // The deprecated chevron and old three-tab navigation are intentionally gone.
}
export async function showMagic(page){
 await showUnitsAndExpand(page);
 const first=page.locator('#gameCharacters details.owc-wizard-magic').first();
 await first.waitFor({state:'attached'});
 if(!await first.evaluate(el=>el.open))await first.locator(':scope > summary').click();
 return first;
}

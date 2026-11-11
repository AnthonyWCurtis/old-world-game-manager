/** Existing battle workflow tests use actual tab navigation, then expand units.
 * Keeps the game UI collapsed by default for the real player. */
export async function showUnitsAndExpand(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameNavUnits').click();
 await page.locator('#armyRosterList .game-unit-expand-toggle').evaluateAll(buttons=>{
  for(const button of buttons){
   if(button.getAttribute('aria-expanded')==='false')button.click();
  }
 });
}
export async function showMagic(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameNavMagic').click();
}

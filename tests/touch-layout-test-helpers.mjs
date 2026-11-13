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
 // Legacy combat regression scenarios intentionally exercise every detailed
 // battle control. Switch their opened cards to Full, while production's
 // default remains the newly approved Compact display.
}
export async function showMagic(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameNavMagic').click();
}

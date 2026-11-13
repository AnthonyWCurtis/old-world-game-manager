/** Existing battle workflow tests use actual tab navigation, then expand units.
 * Keeps the game UI collapsed by default for the real player. */
export async function showUnitsAndExpand(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameNavUnits').click();
 // Legacy combat regression scenarios intentionally exercise every detailed
 // battle control. Switch their opened cards to Full, while production's
 // default remains the newly approved Compact display.
 const ids=await page.locator('#armyRosterList .army-unit-card').evaluateAll(
  cards=>cards.map(card=>card.dataset.unitId));
 for(const id of ids){
  const card=page.locator('#armyRosterList .army-unit-card[data-unit-id="'+id+'"]');
  // Section accordions may hide an entire group. Those cards can be expanded
  // when their section is opened; Playwright should only click visible cards.
  if(!await card.isVisible())continue;
  const arrow=card.locator('.game-unit-expand-toggle');
  if(await arrow.getAttribute('aria-expanded')==='false')await arrow.click();
  if(await card.evaluate(el=>el.classList.contains('owc-view-compact'))&&
     await card.locator('.game-unit-focus-open').isVisible())
   await card.locator('.game-unit-focus-open').click();
 }
}
export async function showMagic(page){
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.locator('#gameNavMagic').click();
}

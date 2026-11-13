import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',d=>d.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tactical-ui')),true,'V2 shell must load');
 assert.equal(await page.locator('#tacticalSavedNav').isVisible(),true,'Saved armies immediately reachable from home');
 assert.equal(await page.locator('#tacticalImportNav').isVisible(),true,'Importer immediately reachable from home');
 const homeBg=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.match(homeBg,/rgb\((?:9, 19, 33|10, 20, 34)\)/,'Dark command shell background');
 await page.locator('#tacticalSavedNav').click();
 assert.equal(await page.locator('.panel.saved').isVisible(),true,'Saved list is still accessible after navigation');
 await page.locator('#tacticalImportNav').click();
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 assert.equal(await page.locator('#tacticalArmyAudit').isVisible(),true,'Diagnostics remain reachable');
 assert.equal(await page.locator('#tacticalArmyAudit').evaluate(el=>el.open),false,'Secondary army data starts folded');
 assert.match(await page.locator('#tacticalArmyPoints').innerText(),/\d[\d,]*\s*pts/,'Imported points visible in hero');
 assert.equal(await page.locator('#gameUnitsPanel .game-screen-jump').isVisible(),false,'Legacy jump nav is not another navigation layer');
 assert.equal(await page.locator('.game-roster-search-input').isVisible(),true);
 const card=page.locator('#armyRosterList .army-unit-card:visible').first();
 const renameIcon=card.locator('.game-unit-name-line .game-rename-toggle');
 assert.equal(await renameIcon.isVisible(),true,'Inline compact card keeps the rename pencil next to the name');
 assert.equal(await renameIcon.locator('svg[aria-hidden="true"]').count(),1,'Rename trigger uses a pencil icon');
 assert.equal(await renameIcon.evaluate(el=>el.previousElementSibling?.tagName),'H3','Pencil sits immediately beside the unit name');
 assert.match(await renameIcon.getAttribute('aria-label'),/^Rename /,'Icon-only rename is labelled');
 await renameIcon.click();
 assert.equal(await card.locator('.game-unit-rename-input').isVisible(),true,'Pencil opens inline rename in Compact View');
 await renameIcon.click();
 assert.equal(await card.locator('.game-unit-rename-input').isVisible(),false,'Pencil closes inline rename');
 const more=card.locator('.game-unit-expand-toggle');
 assert.equal(await more.isVisible(),true,'Single card collapse arrow remains reachable beside the name');
 assert.equal(await more.evaluate(el=>el.parentElement?.classList.contains('game-unit-name-line')),true,'Expand arrow belongs directly beside unit name');
 assert.notEqual(await more.evaluate(el=>getComputedStyle(el).fontSize),'0px','Unit arrow is directly visible for one-tap expansion');
 assert.equal(await more.getAttribute('aria-expanded'),'true','Compact unit begins expanded');
 await more.click();
 assert.equal(await card.locator('.game-unit-expandable').isVisible(),false,'One arrow folds the entire unit body');
 assert.equal(await card.locator('.game-compact-wounds').isVisible(),true,'Wound tracker remains available when folded');
 await more.click();
 assert.equal(await card.locator('.game-unit-expandable').isVisible(),true,'Same arrow restores the compact details');
 assert.equal(await card.locator('.owc-compact-loadout').isVisible(),true,'Compact card displays source-backed loadout');
 assert.equal(await card.locator('.game-attack-panel').isVisible(),false,'Combat panels are reserved for Full View');
 assert.equal(await card.locator('.game-compact-wounds').count(),1,'Wound or model tracker is visible beside unit header');
 const switchView=card.locator('.game-unit-focus-open');
 assert.equal(await switchView.isVisible(),true,'Full View action is available on the inline card');
 assert.equal(await switchView.getAttribute('aria-pressed'),'false');
 await switchView.click();
 assert.equal(await switchView.getAttribute('aria-pressed'),'true');
 assert.equal(await card.locator('.game-attack-panel').isVisible(),true,'Full View reveals combat details inline');
 assert.equal(await renameIcon.isVisible(),true,'Pencil remains beside the name in Full View');
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),null,'Switching views does not focus away from the roster');
 assert.equal(await page.locator('#gameUnitFocusTabs').count(),0,'No click-through detail tabs');
 await switchView.click();
 assert.equal(await card.locator('.game-attack-panel').isVisible(),false,'Returning to Compact View folds extra panels');
 assert.equal(await switchView.getAttribute('aria-pressed'),'false');
 await page.locator('#tacticalArmyAudit > summary').click();
 assert.equal(await page.locator('#armyRosterSummary').isVisible(),true,'Imported metrics can still be reviewed');
 await page.locator('#tacticalArmyAudit > summary').click();
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'Tactical shell must not create global horizontal scrolling at '+viewport.width);
 }
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#armyRosterPage')?.hidden||
  document.querySelectorAll('#savedList .row-item').length>0,null,{timeout:20000});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tactical-ui')),true);
 assert.equal(await page.locator('#tacticalArmyAudit').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('Tactical Command shell, importer, archive, inline Compact/Full cards, rename and offline: PASS');
}finally{
 await browser.close();
}

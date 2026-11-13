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
 assert.equal(await card.locator('.game-rename-toggle').isVisible(),false,'Rename belongs in focused detail, not list row');
 const more=card.locator('.game-unit-expand-toggle');
 assert.equal(await more.isVisible(),true,'Advanced source details remain reachable via small overflow affordance');
 assert.equal(await more.evaluate(el=>el.parentElement?.classList.contains('game-unit-name-line')),true,'Expand arrow belongs directly beside unit name');
 assert.notEqual(await more.evaluate(el=>getComputedStyle(el).fontSize),'0px','Unit arrow is directly visible for one-tap expansion');
 assert.equal(await card.locator('.game-compact-wounds').count(),1,'Wound or model tracker is visible beside unit header');
 assert.equal(await card.locator('.game-unit-focus-open').isVisible(),true,'One clear primary open unit action');
 await card.locator('.game-unit-focus-open').click();
 assert.equal(await page.locator('#gameUnitFocus').isVisible(),true);
 const renameIcon=page.locator('.game-focus-selected .game-rename-toggle');
 assert.equal(await renameIcon.isVisible(),true,'Pencil rename is available within focused unit');
 assert.equal(await renameIcon.locator('svg[aria-hidden="true"]').count(),1,'Rename trigger has pencil icon rather than button text');
 assert.equal(await renameIcon.evaluate(el=>el.previousElementSibling?.tagName),'H3','Pencil sits immediately beside the unit name');
 assert.equal(await renameIcon.getAttribute('aria-label')!==null,true,'Icon-only rename has an accessible label');
 await renameIcon.click();
 assert.equal(await page.locator('.game-focus-selected .game-unit-rename-input').isVisible(),true,'Pencil opens the existing rename editor');
 await renameIcon.click();
 assert.equal(await page.locator('.game-focus-selected .game-unit-rename-input').isVisible(),false,'Pencil closes the rename editor');
 assert.equal(await page.locator('#gameUnitFocusTabs').count(),0,'No click-through detail tabs');
 await page.locator('#gameUnitFocusBack').click();
 assert.equal(await page.locator('#gameUnitFocus').isVisible(),false);
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
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tactical-ui')),true);
 assert.equal(await page.locator('#tacticalArmyAudit').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('Tactical Command shell, importer, archive, compact unit, detail and offline: PASS');
}finally{
 await browser.close();
}

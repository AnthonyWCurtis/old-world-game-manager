import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),true,'New army opens Normal Play roster');
 const characters=page.locator('.game-roster-section').filter({has:page.locator('.game-roster-section-title:text-is("Characters")')});
 const core=page.locator('.game-roster-section').filter({has:page.locator('.game-roster-section-title:text-is("Core Units")')});
 const special=page.locator('.game-roster-section').filter({has:page.locator('.game-roster-section-title:text-is("Special Units")')});
 assert.equal(await characters.count(),1);
 assert.equal(await core.count(),1);
 assert.equal(await special.count(),1);
 assert.equal(await characters.locator('.game-roster-section-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await core.locator('.game-roster-section-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await special.locator('.game-roster-section-toggle').getAttribute('aria-expanded'),'false');

 const search=page.locator('#gameRosterSearch');
 await search.fill('Eagle-Claw');
 assert.equal(await special.locator('.game-roster-section-content').isVisible(),true,'Search reveals folded sections');
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),4,'Four duplicate Eagle-Claw entries remain distinct');
 assert.match(await page.locator('#gameRosterSearchStatus').innerText(),/4 units/);
 await search.fill('not-a-unit-123');
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),0);
 assert.match(await page.locator('#gameRosterSearchStatus').innerText(),/No matching units/);
 await search.fill('');
 assert.equal(await special.locator('.game-roster-section-content').isVisible(),false,'Search restores previous folded state');
 await special.locator('.game-roster-section-toggle').click();
 assert.equal(await special.locator('.game-roster-section-toggle').getAttribute('aria-expanded'),'true');

 await search.fill("Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);
 await search.fill('');
 await page.locator('#gameNavOverview').click();
 await page.locator('#gameNavUnits').click();
 assert.equal(await special.locator('.game-roster-section-content').isVisible(),true,'Fold state survives tab switches');

 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),true,'Units tab persisted offline');
 assert.equal(await page.locator('.game-roster-section').filter({has:page.locator('.game-roster-section-title:text-is("Special Units")')}).locator('.game-roster-section-toggle').getAttribute('aria-expanded'),'true','Saved section fold persisted offline');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
 assert.deepEqual(errors,[]);
 console.log('Normal Play compact roster groups, search, duplicates and offline restore: PASS');
}finally{
 await browser.close();
}

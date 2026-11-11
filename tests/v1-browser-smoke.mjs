import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});

 // First launch: accurate imported list and source backed, read-only Game Screen.
 await page.locator('#examples').selectOption('single-sea-guard');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.match(await page.locator('.army-screen-mode').innerText(),/BATTLE COMPANION/);
 assert.equal(await page.locator('#armyRosterList .army-unit-card').count(),1);
 assert.match(await page.locator('#armyRosterList').innerText(),/Lothern Sea Guard/);
 assert.equal(await page.locator('#gameCharacters').count(),1);
 assert.equal(await page.locator('#gameRegiments').count(),1);
 assert.equal(await page.locator('.game-character-card').count(),0);

 // A list with characters must retain independent character cards and regiments.
 await page.locator('#backToImporterBtn').click();
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 // Every exact Wizard label receives its general rule link, even with upstream offline.
 const genericWizardLinks=await page.locator('#units .selection').evaluateAll(nodes=>nodes
  .filter(node=>node.querySelector('.selection-name')?.textContent==='Wizard')
  .map(node=>node.querySelector('a')?.href));
 assert.equal(genericWizardLinks.length,3,'Storm Weaver and both Mages each select Wizard');
 assert.ok(genericWizardLinks.every(url=>url==='https://tow.whfb.app/magic/wizards'));
 assert.match(await page.locator('#armyMeta').innerText(),/2,599/);
 await page.locator('#viewRosterBtn').click();
 await page.locator('.game-character-card').first().waitFor({state:'attached',timeout:10000});
 assert.ok(await page.locator('.game-character-card').count()>0);
 assert.ok(await page.locator('#gameRegiments .army-unit-card').count()>0);
 await page.locator('#gameScreenJumpCharacters').click();
 assert.equal(await page.locator('#armyRosterPage').isVisible(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
  'Game Screen must not cause page-level horizontal scrolling');

 // Save from within the Game Screen, then relaunch while completely offline.
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,
  null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const reopenedWizardLinks=await page.locator('#units .selection').evaluateAll(nodes=>nodes
  .filter(node=>node.querySelector('.selection-name')?.textContent==='Wizard')
  .map(node=>node.querySelector('a')?.href));
 assert.deepEqual(reopenedWizardLinks,genericWizardLinks,'Offline saved roster retains general Wizard rules links');
 assert.ok(await page.locator('#gameCharacters .army-unit-card').count()>0);
 assert.ok(await page.locator('#gameRegiments .army-unit-card').count()>0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

 // Even a brand-new paste must work without any upstream requests.
 await page.locator('#backToImporterBtn').click();
 const raw=readFileSync(new URL('../docs/examples/single-sea-guard.txt',import.meta.url),'utf8');
 await page.locator('#sourceText').fill(raw);
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 assert.match(await page.locator('#gameRegiments').innerText(),/Lothern Sea Guard/);
 assert.equal(errors.length,0,'Runtime JS errors: '+errors.join(' | '));
 console.log('v1 mobile import → Game Screen → save → offline reload → new paste: PASS');
}finally{
 await browser.close();
}

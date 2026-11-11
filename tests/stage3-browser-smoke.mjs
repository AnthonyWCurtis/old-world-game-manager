import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {showUnitsAndExpand,showMagic} from './touch-layout-test-helpers.mjs';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await showUnitsAndExpand(page);
 await page.locator('.game-character-card').first().waitFor({state:'visible'});

 const characters=page.locator('#gameCharacters .game-character-card');
 const regiments=page.locator('#gameRegiments .army-unit-card');
 assert.equal(await characters.count(),7);
 assert.equal(await regiments.count(),10);
 const firstCharacter=await characters.nth(0).getAttribute('data-unit-id');
 const secondCharacter=await characters.nth(1).getAttribute('data-unit-id');
 const firstRegiment=await regiments.nth(0).getAttribute('data-unit-id');
 const secondRegiment=await regiments.nth(1).getAttribute('data-unit-id');
 const membership=async(charId)=>page.locator('#gameCharacters .game-character-card[data-unit-id="'+charId+'"] .game-membership-label').innerText();
 const assigned=(regId)=>page.locator('#gameRegiments article[data-unit-id="'+regId+'"] details.game-attached-character');
 assert.match(await membership(firstCharacter),/Independent/);

 // From a character: assign to a regiment.
 await page.locator('#gameCharacters .game-character-card[data-unit-id="'+firstCharacter+'"] select.character-unit-picker').selectOption(firstRegiment);
 assert.equal(await assigned(firstRegiment).count(),1);
 assert.match(await membership(firstCharacter),/Assigned to/);
 assert.match(await page.locator('#battleSessionStatus').innerText(),/saved automatically|Saving/);

 // From a regiment: add a second, independent character.
 await page.locator('#gameRegiments article[data-unit-id="'+firstRegiment+'"] select.regiment-character-picker').selectOption(secondCharacter);
 assert.equal(await assigned(firstRegiment).count(),2);
 assert.equal(await assigned(firstRegiment).nth(1).getAttribute('data-character-id'),secondCharacter);

 // Move the first character and verify they aren't still in the earlier unit.
 await page.locator('#gameCharacters .game-character-card[data-unit-id="'+firstCharacter+'"] select.character-unit-picker').selectOption(secondRegiment);
 assert.equal(await assigned(firstRegiment).count(),1);
 assert.equal(await assigned(secondRegiment).count(),1);
 const nested=assigned(secondRegiment).first();
 await nested.locator('summary').first().click();
 assert.match(await nested.innerText(),/Imported selections/i);
 await nested.locator('button.game-character-remove').click();
 assert.equal(await assigned(secondRegiment).count(),0);
 assert.match(await membership(firstCharacter),/Independent/);

 // Reassign from the regiment side then allow autosave to commit.
 await page.locator('#gameRegiments article[data-unit-id="'+secondRegiment+'"] select.regiment-character-picker').selectOption(firstCharacter);
 assert.equal(await assigned(secondRegiment).count(),1);
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),null,{timeout:15000});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

 // Existing saved-list workflow, old army data and local session storage coexist.
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:15000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 assert.equal(await assigned(firstRegiment).count(),1);
 assert.equal(await assigned(secondRegiment).count(),1);
 assert.equal(await assigned(secondRegiment).first().getAttribute('data-character-id'),firstCharacter);
 assert.equal(await characters.count(),7,'Characters section never loses a character after joining');
 assert.match(await page.locator('#armyRosterSummary').innerText(),/2,599/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(pageErrors,[]);
 console.log('Stage 3 two-way assignments, nested profiles, removal and offline restoration: PASS');
}finally{
 await browser.close();
}

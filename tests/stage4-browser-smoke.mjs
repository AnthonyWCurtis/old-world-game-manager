import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {showUnitsAndExpand,showMagic} from './touch-layout-test-helpers.mjs';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await showUnitsAndExpand(page);
 await page.locator('#gameRegiments .game-defence-panel').first().waitFor({state:'attached'});
 const sea=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 assert.equal(await sea.count(),1);
 const seaId=await sea.getAttribute('data-unit-id');
 const seaDef=sea.locator(':scope > .game-unit-expandable > .game-defence-panel');
 assert.match(await seaDef.locator('[data-save="armour"]').innerText(),/5\+/);
 assert.match(await seaDef.locator('[data-save="ward"]').innerText(),/Ward\s*—/);
 assert.match(await seaDef.locator('[data-save="ward"]').getAttribute('title'),/Not established/);
 assert.match(await seaDef.locator('[data-save="regeneration"]').innerText(),/Regeneration\s*—/);
 assert.match(await seaDef.locator('[data-save="regeneration"]').getAttribute('title'),/Not established/);
 assert.match(await seaDef.locator('.game-defence-champion').textContent(),/Sea Master.*4\+.*Magic Missiles/i);
 assert.match(await page.locator('#armyRosterSummary').textContent(),/2,599/);

 const sky=page.locator('#gameCharacters .game-character-card').filter({hasText:'283 pts'}).first();
 const skyId=await sky.getAttribute('data-unit-id');
 assert.ok(skyId);
 const skyDef=sky.locator(':scope > .game-unit-expandable > .game-defence-panel');
 assert.match(await skyDef.locator('[data-save="armour"]').innerText(),/4\+/);
 assert.match(await skyDef.locator('[data-save="ward"]').innerText(),/5\+/);
 assert.match(await skyDef.locator('[data-save="regeneration"]').innerText(),/5\+/);
 const shield=skyDef.locator('.game-defence-shield-used input');
 assert.equal(await shield.isChecked(),false);

 // Joining a character never propagates their armour, one-use Ward or regeneration.
 await sky.locator('select.character-unit-picker').selectOption(seaId);
 const seaAgain=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+seaId+'"]');
 assert.match(await seaAgain.locator(':scope > .game-unit-expandable > .game-defence-panel [data-save="armour"]').innerText(),/5\+/);
 assert.match(await seaAgain.locator(':scope > .game-unit-expandable > .game-defence-panel [data-save="regeneration"]').innerText(),/Regeneration\s*—/);
 assert.equal(await seaAgain.locator('.game-attached-character[data-character-id="'+skyId+'"]').count(),1);
 const attached=seaAgain.locator('.game-attached-character[data-character-id="'+skyId+'"]');
 await seaAgain.locator('.owc-assigned-drawer > summary').click();
 await attached.locator(':scope > summary').click();
 assert.match(await attached.locator('.game-defence-panel [data-save="regeneration"]').innerText(),/5\+/);

 // User marks the one-use item as spent, but it still counts as a shield for armour.
 await page.locator('#gameCharacters .game-character-card[data-unit-id="'+skyId+'"] .game-defence-shield-used input').check();
 const after=page.locator('#gameCharacters .game-character-card[data-unit-id="'+skyId+'"] .game-defence-panel');
 assert.match(await after.locator('[data-save="ward"]').innerText(),/Spent/);
 assert.match(await after.locator('[data-save="armour"]').innerText(),/4\+/);
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);

 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 const restored=page.locator('#gameCharacters .game-character-card[data-unit-id="'+skyId+'"] .game-defence-panel');
 assert.equal(await restored.locator('.game-defence-shield-used input').isChecked(),true);
 assert.match(await restored.locator('[data-save="ward"]').innerText(),/Spent/);
 assert.equal(await page.locator('#gameRegiments article[data-unit-id="'+seaId+'"] details.game-attached-character[data-character-id="'+skyId+'"]').count(),1);
 assert.match(await page.locator('#armyRosterSummary').textContent(),/2,599/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Stage 4 armour, conditional Ward, Regeneration, bearer-only joins and offline one-use state: PASS');
}finally{
 await browser.close();
}

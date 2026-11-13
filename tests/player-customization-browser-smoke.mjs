import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {showUnitsAndExpand,showMagic} from './touch-layout-test-helpers.mjs';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await showUnitsAndExpand(page);
 const units=page.locator('#gameRegiments .army-unit-card');
 const ships=units.filter({has:page.locator('h3:text-is("Ship\'s Company")')});
 assert.equal(await ships.count(),3,'Duplicate units remain separate imported instances');
 const first=await ships.nth(0).getAttribute('data-unit-id');
 const second=await ships.nth(1).getAttribute('data-unit-id');
 const rename=async(id,name)=>{
  const card=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+id+'"]');
  // Inline-expanded cards intentionally have no second Open unit control.
  // Tapping their heading opens the same focused view without an extra button.
  await card.locator('.army-unit-names h3').click();
  await card.locator('.game-rename-toggle').click();
  await card.locator('.game-unit-rename-input').fill(name);
  await card.locator('.game-unit-rename-save').click();
  await page.locator('#gameUnitFocusBack').click();
 };
 await rename(first,'Left Flank');
 assert.equal(await page.locator('#gameRegiments .army-unit-card[data-unit-id="'+first+'"] h3').innerText(),'Left Flank');
 assert.equal(await page.locator('#gameRegiments .army-unit-card[data-unit-id="'+second+'"] h3').innerText(),"Ship's Company");
 const storm=page.locator('#gameCharacters .game-character-card').filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const stormId=await storm.getAttribute('data-unit-id');
 const book=storm.locator('details.game-wizard-spellbook');
 await book.waitFor({state:'attached'});
 await page.waitForFunction(()=>document.querySelectorAll('.game-wizard-spellbook .game-wizard-spell-row').length>0);
 await book.locator(':scope > summary').click();
 assert.equal(await book.locator('.game-wizard-spell-row').count(),7,
  'An Elementalism wizard sees only its seven source-linked spells');
 assert.equal(await book.locator('.game-wizard-spell-row').filter({hasText:'Drain Magic'}).count(),0);
 assert.equal(await book.locator('.game-wizard-spell-row').filter({hasText:'Glittering Robe'}).count(),0);
 assert.match(await book.innerText(),/Showing 7 source-linked spells from Elementalism/);
 await book.locator('.game-wizard-spell-search').fill('Earthen Ramparts');
 const checkbox=book.locator('.game-wizard-spell-row').filter({hasText:'Earthen Ramparts'}).locator('input[type=checkbox]');
 await checkbox.check();
 assert.match(await book.locator(':scope > summary').innerText(),/1 selected/);
 assert.equal(await page.locator('#spellControlPanel .game-active-spell').count(),0,'Knowledge must not automatically cast an enchantment');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 const restored=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+first+'"]');
 assert.equal(await restored.locator('h3').first().innerText(),'Left Flank');
 assert.match(await restored.locator('.army-unit-nickname').first().innerText(),/Official: Ship's Company/);
 assert.equal(await page.locator('#gameRegiments .army-unit-card[data-unit-id="'+second+'"] h3').first().innerText(),"Ship's Company");
 await showUnitsAndExpand(page);
 const restoredBook=page.locator('#gameCharacters .game-character-card[data-unit-id="'+stormId+'"] .game-wizard-spellbook');
 await restoredBook.locator(':scope > summary').click();
 assert.equal(await restoredBook.locator('.game-wizard-spell-row').count(),7,'Offline cached lore filtering must survive reload');
 await restoredBook.locator('.game-wizard-spell-search').fill('Earthen Ramparts');
 assert.equal(await restoredBook.locator('.game-wizard-spell-row').filter({hasText:'Earthen Ramparts'}).locator('input[type=checkbox]').isChecked(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Personal names and source-indexed wizard spellbook, per instance, persisted offline: PASS');
}finally{await browser.close();}

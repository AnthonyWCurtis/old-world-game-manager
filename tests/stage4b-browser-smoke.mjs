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
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await showUnitsAndExpand(page);
 // Select the spells each caster knows first, then they become casting options.
 const bookBySpell=name=>page.locator('#gameCharacters .game-wizard-spellbook')
  .filter({has:page.locator('.game-wizard-spell-row').filter({hasText:name})}).first();
 for(const spell of ['Earthen Ramparts','Glittering Robe']){
  const book=bookBySpell(spell);
  await book.locator(':scope > summary').click();
  await book.locator('.game-wizard-spell-row').filter({hasText:spell})
   .locator('input[type=checkbox]').check();
 }
 await showMagic(page);
 const control=page.locator('#spellControlPanel');
 await control.locator('.game-spell-caster').first().waitFor();
 assert.equal(await control.locator('.game-spell-caster').count(),2);
 assert.equal(await control.locator('.game-active-spell').count(),0);
 assert.match(await control.innerText(),/not proof.*knows|player.confirm/i);
 const sea=page.locator('#gameRegiments .army-unit-card').filter({
  has:page.locator('h3:text-is("Lothern Sea Guard")')
 }).first();
 const seaId=await sea.getAttribute('data-unit-id');
 const seaWard=()=>sea.locator(':scope > .game-unit-expandable > .game-defence-panel [data-save="ward"]');
 assert.match(await seaWard().textContent(),/Not established/);
 const earth=control.locator('.game-spell-caster[data-spell-id="earthen-ramparts"]');
 const glitter=control.locator('.game-spell-caster[data-spell-id="glittering-robe"]');
 const mageId=await glitter.getAttribute('data-caster-id');
 const stormId=await earth.getAttribute('data-caster-id');
 assert.ok(stormId&&mageId);
 assert.equal(await earth.locator('.game-spell-cast').isDisabled(),true);
 const recordEarth=async()=>{
  if(!(await earth.evaluate(el=>el.open)))await earth.locator('summary').click();
  await earth.locator('.game-spell-target').selectOption(seaId);
  await earth.locator('.game-spell-confirm').check();
  await earth.locator('.game-spell-cast').click();
 };
 await recordEarth();
 assert.equal(await control.locator('.game-active-spell').count(),1);
 assert.match(await seaWard().textContent(),/5\+.*all wounds/i);
 assert.match(await sea.locator(':scope > .game-unit-expandable > .game-defence-panel .game-defence-movement').textContent(),/Cannot march.*Cannot charge/s);
 assert.match(await page.locator('#armyRosterSummary').textContent(),/2,599/);
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-defence-panel .game-defence-incoming').count(),0);

 // Glittering Robe is Self, only becomes unit-wide after explicitly joining Mage.
 await showUnitsAndExpand(page);
 await page.locator('#gameCharacters .game-character-card[data-unit-id="'+mageId+'"] .character-unit-picker')
  .selectOption(seaId);
 await showMagic(page);
 const glitter2=control.locator('.game-spell-caster[data-spell-id="glittering-robe"]');
 if(!(await glitter2.evaluate(el=>el.open)))await glitter2.locator('summary').click();
 assert.equal(await glitter2.locator('.game-spell-target').count(),0);
 await glitter2.locator('.game-spell-confirm').check();
 await glitter2.locator('.game-spell-cast').click();
 assert.equal(await control.locator('.game-active-spell').count(),1,
  'Glittering cast on joined Mage and Sea Guard expires older Earthen Ramparts');
 assert.match(await control.locator('.game-active-spell').innerText(),/Glittering Robe/);
 assert.match(await seaWard().textContent(),/Not established/);
 assert.match(await sea.locator(':scope > .game-unit-expandable > .game-defence-panel .game-defence-incoming').textContent(),/-1 To Hit/);
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-defence-panel .game-defence-movement').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);

 // End, re-cast Earthen, persist the player-reported effect and reopen offline.
 await control.locator('.game-spell-end').click();
 assert.equal(await control.locator('.game-active-spell').count(),0);
 await recordEarth();
 assert.equal(await control.locator('.game-active-spell').count(),1);
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),
  null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),
  null,{timeout:15000});
 const restoredControl=page.locator('#spellControlPanel');
 const restoredSea=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+seaId+'"]');
 assert.equal(await restoredControl.locator('.game-active-spell').count(),1);
 assert.match(await restoredSea.locator(':scope > .game-unit-expandable > .game-defence-panel [data-save="ward"]').textContent(),/5\+.*all wounds/i);
 assert.match(await page.locator('#armyRosterSummary').textContent(),/2,599/);
 await restoredControl.locator('.game-spell-expire').click();
 assert.equal(await restoredControl.locator('.game-active-spell').count(),0);
 assert.match(await restoredSea.locator(':scope > .game-unit-expandable > .game-defence-panel [data-save="ward"]').textContent(),/Not established/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Stage 4B source-backed spells, overlap expiry, separate To Hit/Ward, offline restore: PASS');
}finally{await browser.close();}

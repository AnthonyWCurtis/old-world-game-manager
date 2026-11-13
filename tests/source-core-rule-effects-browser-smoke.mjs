import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const id=await sea.getAttribute('data-unit-id');
 assert.ok(id);
 await page.waitForFunction(unitId=>
  !!document.querySelector('#gameRegiments article[data-unit-id="'+unitId+'"] .game-effect-card[data-effect-id="published-close-order"]'),
 id,{timeout:25000});
 assert.doesNotMatch((await sea.locator('.game-card-status .game-card-chip').allTextContents()).join(' '),/Close Order/,
  'Published manual reminders must not be falsely shown as active buffs');
 await sea.locator('.game-unit-focus-open').click();
 const effect=sea.locator('.game-effect-card[data-effect-id="published-close-order"]');
 await effect.waitFor({state:'visible'});
 assert.match(await effect.locator('summary').innerText(),/Reviewed · manual/);
 await effect.locator('summary').click();
 assert.match(await effect.locator('.game-effect-description').innerText(),
  /may adopt a Close Order formation/);
 assert.match(await effect.locator('.game-effect-caution').first().innerText(),
  /not applied to rolls, saves, movement, formations or combat totals/i);
 assert.equal(await effect.locator('a.game-effect-source').first().getAttribute('href'),
  'https://tow.whfb.app/special-rules/close-order');
 assert.equal(await sea.locator('.game-published-rules-list li').filter({hasText:'Close Order'}).count(),0,
  'Reviewed source rule is not duplicated in unreviewed reference-only list');
 assert.ok(await sea.locator('.game-published-rules-list li').filter({hasText:'Naval Discipline'}).count(),
  'Unreviewed source rules remain present');
 assert.equal(await sea.locator('.game-attack-panel .game-offensive-effect[data-effect-id="published-close-order"]').count(),0,
  'Manual formation permission must not be transformed into an attack bonus');
 await page.locator('#gameUnitFocusBack').click();
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(unitId=>
  !!document.querySelector('#gameRegiments article[data-unit-id="'+unitId+'"] .game-effect-card[data-effect-id="published-close-order"]'),
 id,{timeout:20000});
 assert.deepEqual(errors,[]);
 console.log('Reviewed manual Close Order reminder, safe display and offline restore: PASS');
}finally{await browser.close();}

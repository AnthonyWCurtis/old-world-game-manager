import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 const sea=page.locator('#gameRegiments .army-unit-card').filter({
  has:page.locator('h3:text-is("Lothern Sea Guard")')
 }).first();
 const amount=sea.locator('.game-wound-remaining');
 await amount.waitFor({state:'visible'});
 const before=(await amount.innerText()).split('/').map(Number);
 assert.equal(before.length,2);
 assert.ok(before[0]>0&&before[0]===before[1]);
 assert.match(await sea.locator('.game-wound-counter-value small').innerText(),/Models/);
 await sea.getByRole('button',{name:'Record one casualty for Lothern Sea Guard'}).click();
 assert.equal(await amount.innerText(),(before[0]-1)+'/'+before[1]);
 const expand=sea.locator('.game-unit-expand-toggle');
 if(await expand.getAttribute('aria-expanded')==='false')await expand.click();
 assert.equal(await expand.getAttribute('aria-expanded'),'true');
 assert.ok(await sea.locator('.game-attack-phase[data-attack-phase="shooting"]').isVisible());
 assert.ok(await sea.locator('.game-attack-phase[data-attack-phase="combat"]').isVisible());
 assert.ok(await sea.locator('.game-defence-resilience').isVisible());
 assert.ok(await sea.locator('.game-defence-values .game-defence-stat').count()===3);
 assert.equal(await sea.locator('.game-defence-wounds-remaining').innerText(),
  (before[0]-1)+'/'+before[1]+' models');
 await expand.click();
 assert.equal(await expand.getAttribute('aria-expanded'),'false');
 assert.equal(await amount.innerText(),(before[0]-1)+'/'+before[1],
  'Counter remains accessible when card is folded');
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const restored=page.locator('#gameRegiments .army-unit-card').filter({
  has:page.locator('h3:text-is("Lothern Sea Guard")')
 }).first();
 assert.equal(await restored.locator('.game-wound-remaining').innerText(),
  (before[0]-1)+'/'+before[1],'Manual model loss is restored offline per unit');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
  'Unit counters must not create horizontal page overflow');
 assert.deepEqual(errors,[]);
 console.log('Compact Units counter, expansion, defensive tiles and offline persistence: PASS');
}finally{await browser.close();}

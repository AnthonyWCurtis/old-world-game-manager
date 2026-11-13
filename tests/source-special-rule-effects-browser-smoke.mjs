import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 const sea=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const ishaya=page.locator('#gameCharacters .army-unit-card').filter({has:page.locator('h3:text-is("Ishaya Vess")')}).first();
 const seaId=await sea.getAttribute('data-unit-id'),ishayaId=await ishaya.getAttribute('data-unit-id');
 assert.ok(seaId&&ishayaId);
 await page.waitForFunction(id=>{
  const card=document.querySelector('#gameCharacters article[data-unit-id="'+id+'"]');
  return card?.querySelector('.army-unit-unified-loadout')?.textContent?.includes('Precision Strikes');
 },ishayaId,{timeout:25000});
 assert.equal(await sea.locator('.game-card-status .game-card-chip').allTextContents().then(x=>x.some(s=>s.includes('Precision Strikes'))),false,
  'Source rule should not apply without a recorded join');
 await ishaya.locator('.game-unit-expand-toggle').click();
 const own=ishaya.locator('.game-effect-card[data-effect-id="precision-strikes"]');
 await own.waitFor({state:'visible'});
 assert.match(await own.locator('summary').innerText(),/Precision Strikes/);
 assert.equal(await ishaya.locator('.game-attack-panel .game-offensive-effect[data-effect-id="precision-strikes"]').count(),0,
  'Ishaya is the rule source, not automatically the AP beneficiary');
 await ishaya.locator('.game-unit-expand-toggle').click();

 await ishaya.locator('.game-unit-expand-toggle').click();
 await ishaya.locator('.character-unit-picker').selectOption(seaId);
 await page.waitForFunction(id=>
  !!document.querySelector('#gameRegiments article[data-unit-id="'+id+'"] .game-offensive-effect[data-effect-id="precision-strikes"]'),
  seaId,{timeout:20000});
 assert.equal(await sea.locator('.game-card-status .game-card-chip').count(),0,
  'Conditional Precision Strikes and Armour Bane remain in attack references, not active buffs');
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-attack-panel .game-offensive-effect[data-effect-id="razor-standard"]').count(),1,
  'Razor Standard persists as a separate source-backed offensive effect');
 await sea.locator('.game-unit-expand-toggle').click();
 const attackRule=sea.locator('.game-offensive-effect[data-effect-id="precision-strikes"]');
 await attackRule.waitFor({state:'visible'});
 assert.match(await attackRule.innerText(),/AP \+1/);
 const row=sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="precision-strikes"]');
 await row.waitFor({state:'visible'});
 assert.match(await row.locator('summary').innerText(),/Conditional/);
 await row.locator('summary').click();
 assert.match(await row.locator('.game-effect-scope').innerText(),/recorded join/i);
 assert.equal(await row.locator('a.game-effect-source').first().getAttribute('href'),
  'https://tow.whfb.app/special-rules/precision-strikes');
 assert.ok(await sea.locator('.game-published-rules-reference').count(),
  'Other source special rules are visible as reference-only, not silently omitted');
 await sea.locator('.game-unit-expand-toggle').click();
 const picker=ishaya.locator('.character-unit-picker');
 if(!await picker.isVisible()){
  if(await ishaya.locator('.game-unit-expandable').isHidden())await ishaya.locator('.game-unit-expand-toggle').click();
  if(await ishaya.evaluate(e=>e.classList.contains('owc-view-compact')))await ishaya.locator('.game-unit-expand-toggle').click();
 }
 await picker.selectOption('');
 await page.waitForFunction(id=>!document.querySelector('#gameRegiments article[data-unit-id="'+id+'"] .game-offensive-effect[data-effect-id="precision-strikes"]'),seaId);
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="precision-strikes"]').count(),0);
 // The already loaded, exact-source reference shard and the recorded
 // assignment must recover without network after an iPhone offline reload.
 if(!await picker.isVisible()){
  if(await ishaya.locator('.game-unit-expandable').isHidden())await ishaya.locator('.game-unit-expand-toggle').click();
  if(await ishaya.evaluate(e=>e.classList.contains('owc-view-compact')))await ishaya.locator('.game-unit-expand-toggle').click();
 }
 await picker.selectOption(seaId);
 await page.waitForFunction(id=>
  !!document.querySelector('#gameRegiments article[data-unit-id="'+id+'"] .game-offensive-effect[data-effect-id="precision-strikes"]'),seaId);
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(id=>
  !!document.querySelector('#gameRegiments article[data-unit-id="'+id+'"] .game-offensive-effect[data-effect-id="precision-strikes"]'),seaId,{timeout:20000});
 assert.deepEqual(errors,[]);
 console.log('Ishaya Precision Strikes source-verified join, attack and Effects tabs, remove, offline restore and named benefits: PASS');
}finally{await browser.close();}

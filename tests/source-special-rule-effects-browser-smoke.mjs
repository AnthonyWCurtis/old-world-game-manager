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
 assert.equal(await sea.locator('.game-card-status').innerText().then(s=>s.includes('Precision Strikes')),false,
  'Source rule should not apply without a recorded join');
 await ishaya.locator('.game-unit-focus-open').click();
 await page.locator('#gameUnitFocusTabs [data-focus-tab="effects"]').click();
 const own=ishaya.locator('.game-effect-card[data-effect-id="precision-strikes"]');
 await own.waitFor({state:'visible'});
 assert.match(await own.locator('summary').innerText(),/Precision Strikes/);
 assert.equal(await ishaya.locator('.game-attack-panel .game-offensive-effect[data-effect-id="precision-strikes"]').count(),0,
  'Ishaya is the rule source, not automatically the AP beneficiary');
 await page.locator('#gameUnitFocusBack').click();

 await ishaya.locator('.game-unit-expand-toggle').click();
 await ishaya.locator('.character-unit-picker').selectOption(seaId);
 await page.waitForFunction(id=>{
  return [...document.querySelectorAll('#gameRegiments article[data-unit-id="'+id+'"] .game-card-chip')]
   .some(x=>x.textContent.includes('Precision Strikes'));
 },seaId,{timeout:20000});
 const chip=sea.locator('.game-card-chip').filter({hasText:'Precision Strikes'});
 assert.equal(await chip.count(),1);
 assert.match(await chip.innerText(),/AP \+1/);
 const seaStatus=await sea.locator('.game-card-status').innerText();
 assert.match(seaStatus,/Armour Bane \(2\)/,'Razor Standard retained separately');
 assert.doesNotMatch(seaStatus,/\b1 equipped\b|\b2 conditional\b/,
  'Primary compact card should name benefits instead of only generic counts');
 await sea.locator('.game-unit-focus-open').click();
 await page.locator('#gameUnitFocusTabs [data-focus-tab="attacks"]').click();
 const attackRule=sea.locator('.game-offensive-effect[data-effect-id="precision-strikes"]');
 await attackRule.waitFor({state:'visible'});
 assert.match(await attackRule.innerText(),/AP \+1/);
 await page.locator('#gameUnitFocusTabs [data-focus-tab="effects"]').click();
 const row=sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="precision-strikes"]');
 await row.waitFor({state:'visible'});
 assert.match(await row.locator('summary').innerText(),/Conditional/);
 await row.locator('summary').click();
 assert.match(await row.locator('.game-effect-scope').innerText(),/recorded join/i);
 assert.equal(await row.locator('a.game-effect-source').first().getAttribute('href'),
  'https://tow.whfb.app/special-rules/precision-strikes');
 assert.ok(await sea.locator('.game-published-rules-reference').count(),
  'Other source special rules are visible as reference-only, not silently omitted');
 await page.locator('#gameUnitFocusBack').click();
 await ishaya.locator('.game-unit-expand-toggle').click();
 await ishaya.locator('.character-unit-picker').selectOption('');
 await page.waitForFunction(id=>!document.querySelector('#gameRegiments article[data-unit-id="'+id+'"] .game-card-chip-offensive[data-effect-id="precision-strikes"]'),seaId);
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="precision-strikes"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Ishaya Precision Strikes source-verified join, attack and Effects tabs, remove and named benefits: PASS');
}finally{await browser.close();}

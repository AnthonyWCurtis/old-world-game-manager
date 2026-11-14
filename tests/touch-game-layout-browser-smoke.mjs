import assert from 'node:assert/strict';
import {chromium} from 'playwright';

/** Approved single-roster workflow: spells live inside the Wizard's card. */
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameWorkspaceNav').count(),0,
  'The Overview, My Army and Magic tab bar is gone');
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),true);
 assert.equal(await page.locator('#gameOverviewPanel,#gameMagicPanel').count(),0);
 assert.equal(await page.locator('#armyRosterList .army-unit-card').count(),17);

 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 assert.ok(seaId);
 assert.equal(await sea.locator('.owc-save-strip .game-defence-stat').count(),3);
 assert.equal(await sea.locator('.game-compact-wounds').isVisible(),true);

 const storm=page.locator('#gameCharacters .army-unit-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const magic=storm.locator('details.owc-wizard-magic');
 await magic.waitFor({state:'attached'});
 assert.match(await magic.locator(':scope > summary').innerText(),/Magic/);
 await magic.locator(':scope > summary').click();
 const book=magic.locator('.game-wizard-spellbook');
 await book.locator(':scope > summary').click();
 const earthChoice=book.locator('.game-wizard-spell-row')
  .filter({hasText:'Earthen Ramparts'});
 await earthChoice.locator('input[type=checkbox]').check();
 const casting=magic.locator('.game-spell-caster[data-spell-id="earthen-ramparts"]');
 await casting.waitFor({state:'visible'});
 await casting.locator(':scope > summary').click();
 await casting.locator('.game-spell-target').selectOption(seaId);
 await casting.locator('.game-spell-confirm').check();
 await casting.locator('.game-spell-cast').click();
 const activeRow=magic.locator('.owc-magic-spell.owc-magic-active');
 await activeRow.waitFor({state:'visible'});
 assert.match(await activeRow.locator(':scope > summary').innerText(),/Earthen Ramparts[\s\S]*ACTIVE/);
 assert.match(await activeRow.locator(':scope > summary').innerText(),/Ward 5\+ · Cannot march\/charge/);
 assert.equal(await magic.locator('.owc-magic-spell').count(),3,
  'Known spells and active spells share one compact list');
 assert.equal(await magic.locator('.game-active-spells,.owc-wizard-casting-heading').count(),0,
  'No second Currently in play or Cast known spells heading');
 assert.match(await magic.locator('.owc-wizard-magic-footer').innerText(),/Edit spells \(1\)/);
 assert.match(await magic.locator('.owc-wizard-magic-footer').innerText(),/Magic items \(1\)/);
 assert.equal(await sea.locator('.owc-save-strip .game-defence-stat[data-save="ward"] strong').innerText(),'5+',
  'The existing scoped Defence projection appears in Compact');
 assert.equal(await page.locator('#gameMagicPanel').count(),0);

 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')
  ?.textContent?.includes('saved automatically'),null,{timeout:15000});
 await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')
  ?.textContent?.includes('recovered'),null,{timeout:15000});
 const restored=page.locator('#gameCharacters .army-unit-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const restoredMagic=restored.locator('.owc-wizard-magic');
 await page.waitForFunction(()=>{
  const s=[...document.querySelectorAll('#gameCharacters .army-unit-card')]
   .find(c=>c.querySelector('h3')?.textContent?.trim()==='Storm Weaver');
  return s?.querySelector('.owc-wizard-magic-summary')?.textContent?.includes('1 active');
 },null,{timeout:15000});
 assert.match(await restoredMagic.locator(':scope > summary').innerText(),/1 known/);
 await restoredMagic.locator(':scope > summary').click();
 const restoredActive=restoredMagic.locator('.owc-magic-spell.owc-magic-active');
 await restoredActive.locator(':scope > summary').click();
 await restoredActive.locator('.game-spell-end').click();
 await page.waitForFunction(()=>{
  const s=[...document.querySelectorAll('#gameCharacters .army-unit-card')]
   .find(c=>c.querySelector('h3')?.textContent?.trim()==='Storm Weaver');
  return s?.querySelector('.owc-wizard-magic-summary')?.textContent?.includes('1 known')&&
   !s.querySelector('.owc-wizard-magic-summary')?.textContent?.includes('active');
 },null,{timeout:15000});

 for(const viewport of [{width:390,height:844},{width:956,height:440},{width:320,height:740}]){
  await page.setViewportSize(viewport);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
   'No page-wide horizontal overflow at '+viewport.width+'px');
 }
 assert.deepEqual(errors,[]);
 console.log('Compact wizard spell rows, cast, target, active, end, offline restore and single roster: PASS');
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',d=>d.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameOverviewPanel').isVisible(),false,'Normal Play opens with army roster');
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),true);
 assert.equal(await page.locator('#gameMagicPanel').isVisible(),false);
 await page.locator('#gameNavOverview').click();
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/Battle overview/);
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/No ongoing spell effects/);
 assert.equal(await page.locator('#gameWorkspaceNav [role=tab]').count(),3);

 // Unit cards begin collapsed and can expand from any part of their header.
 await page.locator('#gameNavUnits').click();
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const id=await sea.getAttribute('data-unit-id');
 const state=sea.locator('.game-unit-expand-toggle');
 assert.equal(await state.getAttribute('aria-expanded'),'false');
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),false);
 await sea.locator('.army-unit-head h3').click();
 assert.equal(await state.getAttribute('aria-expanded'),'true');
 assert.equal(await sea.locator('.army-unit-expandable').count(),0);
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),true);
 const originalCount=await page.locator('#armyRosterList .army-unit-card').count();
 assert.equal(originalCount,17);

 // Live source refresh must preserve the expanded full unit card.
 await page.locator('#gameNavMagic').click();
 assert.equal(await page.locator('#gameMagicPanel').isVisible(),true);
 const known=page.locator('#gameKnownSpellbookDrawer');
 await known.locator(':scope > summary').click();
 const storm=known.locator('.game-magic-wizard-book')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 await storm.locator('details.game-wizard-spellbook > summary').click();
 await storm.locator('.game-wizard-spell-row')
  .filter({hasText:'Earthen Ramparts'})
  .locator('input[type=checkbox]').check();
 const magic=page.locator('#spellControlPanel');
 const earth=magic.locator('.game-spell-caster[data-spell-id="earthen-ramparts"]');
 assert.equal(await earth.count(),1);
 await earth.locator(':scope > summary').click();
 await earth.locator('.game-spell-target').selectOption(id);
 await earth.locator('.game-spell-confirm').check();
 await earth.locator('.game-spell-cast').click();
 assert.match(await magic.locator('.game-active-spell').innerText(),/Earthen Ramparts/);
 await page.locator('#gameNavOverview').click();
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/Earthen Ramparts/);
 await page.locator('#gameNavUnits').click();
 assert.equal(await sea.locator('.game-unit-expand-toggle').getAttribute('aria-expanded'),'true');
 assert.match(await sea.locator('.game-card-status').innerText(),/Earthen Ramparts/);
 assert.equal(await sea.locator('.game-defence-panel').isVisible(),true);
 assert.match(await sea.locator('.game-unit-active-magic').innerText(),/Earthen Ramparts/);
 await page.locator('#gameUnitFocusBack').click();
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),false);
 assert.match(await sea.locator('.game-card-status').innerText(),/Earthen Ramparts/);

 // Returning to game uses the previous section; another army defaults Units.
 await page.locator('#gameNavMagic').click();
 await page.locator('#backToImporterBtn').click();
 await page.locator('#resumeGameBtn').click();
 await page.locator('#gameMagicPanel').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),
  null,{timeout:15000});
 await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:20000});
 assert.equal(await page.locator('#gameMagicPanel').isVisible(),true,
  'Last Game Screen section must restore after offline reload');
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),
  null,{timeout:15000});
 assert.match(await magic.locator('.game-active-spell').innerText(),/Earthen Ramparts/);
 await page.locator('#gameNavUnits').click();
 assert.equal(await sea.locator('.game-unit-expand-toggle').getAttribute('aria-expanded'),'false',
  'Unit collapse preference must survive reloading');

 // Verify bottom navigation and unit toggle remain easy to touch in both orientations.
 for(const viewport of [{width:390,height:844},{width:956,height:440},{width:320,height:740}]){
  await page.setViewportSize(viewport);
  for(const selector of ['#gameNavOverview','#gameNavUnits','#gameNavMagic','.game-unit-expand-toggle']){
   const rect=await page.locator(selector).first().evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {width:r.width,height:r.height};
   });
   assert.ok(rect.height>=44,selector+' must have at least 44px touch height: '+JSON.stringify(rect));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
   'No page-wide horizontal overflow at '+viewport.width+'px');
 }
 assert.deepEqual(errors,[]);
 console.log('Touch layout tabs, compact units, cast/status chips, return, offline persistence and orientation: PASS');
}finally{await browser.close();}

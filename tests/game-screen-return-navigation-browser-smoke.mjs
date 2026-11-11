import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,
  hasTouch:true,isMobile:true
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',d=>d.accept());
 await page.route('https://tow.whfb.app/**',r=>r.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#resumeGameBtn').isVisible(),false,
  'Never show an empty Resume option before an army is imported');
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.match(page.url(),/#army-roster$/);
 const source=await page.locator('#sourceText').inputValue();
 const storm=page.locator('#gameCharacters .game-character-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const book=storm.locator('.game-wizard-spellbook');
 await book.locator(':scope > summary').click();
 await book.locator('.game-wizard-spell-row').filter({hasText:'Earthen Ramparts'})
  .locator('input[type=checkbox]').check();
 const control=page.locator('#spellControlPanel');
 await control.locator('.game-spell-caster[data-spell-id="earthen-ramparts"]').waitFor();
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 const earth=control.locator('.game-spell-caster[data-spell-id="earthen-ramparts"]');
 await earth.locator(':scope > summary').click();
 await earth.locator('.game-spell-target').selectOption(seaId);
 await earth.locator('.game-spell-confirm').check();
 await earth.locator('.game-spell-cast').click();
 assert.match(await control.locator('.game-active-spell').innerText(),/Earthen Ramparts/);
 await page.waitForFunction(()=>
  document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),null,{timeout:15000});
 assert.ok((await page.evaluate(()=>sessionStorage.getItem('old-world-game-manager-active-army-v1')||'')).length>100,
  'The active in-tab roster is available if Safari evicts this document');

 // The user's explicit "Back to importer" button is still intentional, but
 // now offers one-tap return with no re-import or loss of spell state.
 await page.locator('#backToImporterBtn').click();
 await page.locator('#importPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#resumeGameBtn').isVisible(),true);
 await page.locator('#resumeGameBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.match(await control.locator('.game-active-spell').innerText(),/Earthen Ramparts/);
 assert.equal(await page.locator('#sourceText').inputValue(),source);

 // Reproduce Safari disposing the in-memory page during a source-rule visit.
 // Reload directly at the roster URL, rather than allowing a redirect to importer.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:15000});
 assert.match(page.url(),/#army-roster$/);
 await page.waitForFunction(()=>
  document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 assert.equal(await control.locator('.game-active-spell').count(),1);
 assert.match(await control.locator('.game-active-spell').innerText(),/Earthen Ramparts/);

 // Navigate to another document and back through browser history.
 await page.goto('about:blank');
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.match(page.url(),/#army-roster$/);
 assert.equal(await control.locator('.game-active-spell').count(),1);

 // A cached tab should also recover the full Game Screen offline after reload.
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>
  document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 assert.equal(await control.locator('.game-active-spell').count(),1);
 assert.match(await control.locator('.game-active-spell').innerText(),/Earthen Ramparts/);

 // A brand-new browser tab with no selected army must not guess an army.
 await context.setOffline(false);
 const empty=await context.newPage();
 await empty.goto('http://127.0.0.1:8787/#army-roster',{waitUntil:'domcontentloaded'});
 await empty.locator('#importPage').waitFor({state:'visible'});
 assert.equal(await empty.locator('#armyRosterPage').isVisible(),false);
 assert.equal(await empty.locator('#resumeGameBtn').isVisible(),false);
 assert.ok(await empty.evaluate(()=>location.hash==='#import'));
 await empty.close();

 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Back/forward, importer resume, roster reload, offline return and active spells: PASS');
}finally{await browser.close();}

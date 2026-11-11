import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);

 // An older cache-first worker would keep serving this obsolete spell module.
 // The new worker must fetch the correct module from the site while online,
 // even when a misleading cached version is present.
 const polluted=await page.evaluate(async()=>{
  const key=(await caches.keys()).find(k=>k.startsWith('game-manager-v1-shell-'));
  if(!key)throw Error('Missing offline app shell');
  const cache=await caches.open(key);
  const target=new URL('./spell-controls.js',location.href);
  await cache.put(target,new Response(
   'export function renderSpellControls() { document.body.dataset.obsoleteMagic = "true"; }',
   {headers:{'Content-Type':'application/javascript'}}));
  const old=await (await cache.match(target)).text();
  return {key,poisoned:old.includes('obsoleteMagic')};
 });
 assert.equal(polluted.poisoned,true);
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>document.body.dataset.obsoleteMagic),undefined,
  'Browser must not execute old cached magic controls while online');

 // The online response also repairs the cached offline copy.
 const repaired=await page.evaluate(async()=>{
  const key=(await caches.keys()).find(k=>k.startsWith('game-manager-v1-shell-'));
  const cache=await caches.open(key);
  const response=await cache.match(new URL('./spell-controls.js',location.href));
  return (await response.text()).includes('selectedWizardSpells');
 });
 assert.equal(repaired,true,'Latest spell controls must replace stale cache data');

 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const panel=page.locator('#spellControlPanel');
 assert.match(await panel.innerText(),/No selectable known spells yet/);
 const storm=page.locator('#gameCharacters .game-character-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const spellbook=storm.locator('.game-wizard-spellbook');
 await spellbook.locator(':scope > summary').click();
 await spellbook.locator('.game-wizard-spell-row')
  .filter({hasText:'Plague of Rust'}).locator('input[type=checkbox]').check();
 await panel.locator('.game-spell-caster').first().waitFor();
 assert.equal(await panel.locator('.game-spell-caster').count(),1);
 assert.match(await panel.innerText(),/Plague of Rust/);

 // The server-updated index HTML installs a prompt that works even when
 // the app.js module itself is older. Do not reload without a tap: a pasted
 // army not yet imported could otherwise be lost.
 await page.evaluate(()=>navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
 const notice=page.locator('#appUpdateNotice');
 await notice.waitFor({state:'visible'});
 assert.match(await notice.innerText(),/Save any unsaved army list/);
 assert.equal(await notice.locator('button').isEnabled(),true);
 const before=await page.locator('#armyRosterPage').isVisible();
 assert.equal(before,true,'Showing the update notice must not discard the current page');

 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),
  null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),null,{timeout:15000});
 assert.equal(await panel.locator('.game-spell-caster').count(),1,
  'Updated app modules and wizard spell selection remain available offline');
 assert.match(await panel.innerText(),/Plague of Rust/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Stale JS cache repaired online, update notice visible and selected spells preserved offline: PASS');
}finally{await browser.close();}

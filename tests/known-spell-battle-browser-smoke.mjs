import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',d=>d.accept());
 await page.route('https://tow.whfb.app/**',r=>r.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const control=page.locator('#spellControlPanel');
 const sea=page.locator('#gameRegiments .army-unit-card').filter({
  has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 const company=page.locator('#gameRegiments .army-unit-card').filter({
  has:page.locator('h3:text-is("Ship\'s Company")')}).first();
 const companyId=await company.getAttribute('data-unit-id');
 const bookFor=spell=>page.locator('#gameCharacters .game-wizard-spellbook')
  .filter({has:page.locator('.game-wizard-spell-row').filter({hasText:spell})}).first();
 const choose=async(spell)=>{
  const book=bookFor(spell);
  await book.locator('.game-wizard-spell-row').filter({hasText:spell}).first().waitFor({state:'attached'});
  if(!(await book.evaluate(el=>el.open)))await book.locator(':scope > summary').click();
  await book.locator('.game-wizard-spell-row').filter({hasText:spell})
   .locator('input[type=checkbox]').check();
 };
 for(const spell of ['Earthen Ramparts','Travel Mystical Pathway','Plague of Rust',
  'Drain Magic','Glittering Robe'])await choose(spell);
 await control.locator('.game-spell-caster').first().waitFor();
 assert.equal(await control.locator('.game-spell-caster').count(),5);
 assert.equal(await control.locator('.game-wizard-casting-group').count(),3);
 assert.equal(await control.locator('.game-active-spell').count(),0);
 const cast=async(spellId,{target=null,enemy=null}={})=>{
  const candidate=control.locator('.game-spell-caster[data-spell-id="'+spellId+'"]');
  if(!(await candidate.evaluate(el=>el.open)))await candidate.locator(':scope > summary').click();
  if(target)await candidate.locator('.game-spell-target').selectOption(target);
  if(enemy)await candidate.locator('.game-spell-enemy-name').fill(enemy);
  const action=candidate.locator('.game-spell-cast');
  assert.equal(await action.isDisabled(),true);
  await candidate.locator('.game-spell-confirm').check();
  assert.equal(await action.isEnabled(),true);
  await action.click();
 };
 await cast('earthen-ramparts',{target:seaId});
 assert.match(await sea.locator('.game-unit-active-magic').innerText(),/Earthen Ramparts/);
 assert.match(await sea.locator('[data-save="ward"]').innerText(),/5\+.*all wounds/i);
 await cast('plague-of-rust',{enemy:'Enemy Knights'});
 assert.match(await control.locator('.game-active-spell[data-spell-id="plague-of-rust"]').innerText(),
  /Enemy unit: Enemy Knights/);
 assert.equal(await sea.locator('[data-save="armour"]').count(),1);
 await cast('travel-mystical-pathway',{target:companyId});
 assert.equal(await control.locator('.game-active-spell[data-spell-id="travel-mystical-pathway"]').count(),0);
 assert.equal(await control.locator('.game-spell-event').count(),1);
 assert.match(await company.locator('.game-unit-active-magic').innerText(),/Movement resolved: Travel Mystical Pathway/);
 await cast('drain-magic');
 assert.match(await control.locator('.game-active-spell[data-spell-id="drain-magic"]').innerText(),/Remains in Play/);
 const glitter=control.locator('.game-spell-caster[data-spell-id="glittering-robe"]');
 const illusionId=await glitter.getAttribute('data-caster-id');
 await page.locator('#gameCharacters .game-character-card[data-unit-id="'+illusionId+'"] .character-unit-picker')
  .selectOption(seaId);
 await cast('glittering-robe');
 assert.equal(await control.locator('.game-active-spell[data-spell-id="earthen-ramparts"]').count(),0,
  'Robe expires only older enchantments affecting the same unit');
 assert.equal(await control.locator('.game-active-spell[data-spell-id="plague-of-rust"]').count(),1,
  'Enemy-targeted hex is not an Enchantment');
 assert.match(await sea.locator('.game-unit-active-magic').innerText(),/Glittering Robe/);
 assert.match(await sea.locator('.game-defence-incoming').innerText(),/-1 To Hit/);
 assert.equal(await sea.locator('.game-defence-movement').count(),0);

 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),
  null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),
  null,{timeout:15000});
 const restored=page.locator('#spellControlPanel');
 assert.equal(await restored.locator('.game-spell-caster').count(),5);
 assert.equal(await restored.locator('.game-active-spell').count(),3);
 assert.equal(await restored.locator('.game-spell-event').count(),1);
 await restored.locator('.game-spell-expire').click();
 assert.deepEqual(await restored.locator('.game-active-spell').evaluateAll(
  els=>els.map(el=>el.dataset.spellId)),['drain-magic']);
 assert.equal(await restored.locator('.game-spell-event').count(),0);
 await restored.locator('.game-spell-end').click();
 assert.equal(await restored.locator('.game-active-spell').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Five selected spells, targets, ongoing/instant lifecycle, unit indicators and offline restore: PASS');
}finally{await browser.close();}

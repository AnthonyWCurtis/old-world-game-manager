import assert from 'node:assert/strict';
import {chromium} from 'playwright';

/** Preserve source-backed item ownership and one-use state without a Magic tab. */
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameWorkspaceNav').count(),0);
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 assert.equal(await sea.locator('.owc-save-strip .game-defence-stat').count(),3);

 const bsb=page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'202 pts'}).first();
 const bsbItems=bsb.locator('.owc-owner-items');
 await bsbItems.waitFor({state:'attached',timeout:20000});
 await bsbItems.locator(':scope > summary').click();
 const ring=bsbItems.locator('.game-effect-card[data-effect-id="ruby-ring-of-ruin"]');
 assert.equal(await ring.count(),1,'Bound spell remains with its owning character');
 await ring.locator('summary').click();
 assert.match(await ring.innerText(),/Fireball.*Power Level 1/);
 assert.equal(await ring.locator('a').filter({hasText:'Fireball spell source'}).getAttribute('href'),
  'https://tow.whfb.app/spell/fireball');
 assert.equal(await sea.locator('.owc-owner-items .game-effect-card[data-effect-id="ruby-ring-of-ruin"]').count(),0,
  'The character’s bound spell is never promoted to a regiment spell');

 const shield=bsbItems.locator('.game-effect-card[data-effect-id="charmed-shield"]');
 assert.equal(await shield.count(),1);
 await shield.locator('summary').click();
 assert.equal(await shield.getAttribute('data-status'),'ready');
 await shield.locator('button.game-effect-action').filter({hasText:'Mark shield used'}).click();
 assert.equal(await shield.getAttribute('data-status'),'spent');

 const storm=page.locator('#gameCharacters .game-character-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 const owner=storm.locator('.owc-owner-items');
 await owner.locator(':scope > summary').click();
 const scroll=owner.locator('.game-effect-card[data-effect-id="scroll-of-invocation"]');
 assert.equal(await scroll.count(),1);
 await scroll.locator('summary').click();
 assert.equal(await scroll.getAttribute('data-status'),'ready');
 await scroll.locator('button.game-effect-action').filter({hasText:'Mark used'}).click();
 assert.equal(await scroll.getAttribute('data-status'),'spent');

 const elixirOwner=page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'153 pts'}).first();
 const elixirDrawer=elixirOwner.locator('.owc-owner-items');
 await elixirDrawer.locator(':scope > summary').click();
 const potion=elixirDrawer.locator('.game-effect-card[data-effect-id="elixir-of-power"]');
 assert.equal(await potion.getAttribute('data-status'),'ready');
 await potion.locator('summary').click();
 await potion.locator('button.game-effect-action').filter({hasText:'Confirm consumed'}).click();
 assert.equal(await potion.getAttribute('data-status'),'active');
 await potion.locator('button.game-effect-action').filter({hasText:'Finish effect'}).click();
 assert.equal(await potion.getAttribute('data-status'),'spent');

 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')
  ?.textContent?.includes('saved automatically'),null,{timeout:15000});
 await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')
  ?.textContent?.includes('recovered'),null,{timeout:15000});
 const bsbAfter=page.locator('#gameCharacters .game-character-card').filter({hasText:'202 pts'}).first();
 assert.equal(await bsbAfter.locator('.owc-owner-items .game-effect-card[data-effect-id="charmed-shield"]')
  .getAttribute('data-status'),'spent');
 const stormAfter=page.locator('#gameCharacters .game-character-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 assert.equal(await stormAfter.locator('.owc-owner-items .game-effect-card[data-effect-id="scroll-of-invocation"]')
  .getAttribute('data-status'),'spent');
 for(const width of [320,390,956]){
  await page.setViewportSize({width,height:width===956?440:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No page-wide overflow at '+width+'px');
 }
 assert.deepEqual(errors,[]);
 console.log('Magic item ownership, Bound spell, shield, scroll, timed use and offline state: PASS');
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',d=>d.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/Equipment, banners & item effects/);
 assert.ok((await page.locator('#gameOverviewPanel .game-overview-item').count())>=12,
  'Overview has a collapsible, source-reviewed item register');
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),false);
 await page.locator('#gameNavUnits').click();
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 assert.match(await sea.locator('.game-card-status').innerText(),/equipped/);
 assert.match(await sea.locator('.game-card-status').innerText(),/conditional/);
 assert.match(await sea.locator('.game-card-status').innerText(),/Armour Bane \\(2\\)/,
  'Collapsed Sea Guard must name its offensive standard instead of showing only a generic item count');
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),false);
 await sea.locator('.game-unit-expand-toggle').click();
 const offence=sea.locator(':scope > .game-unit-expandable > .game-offensive-effects-panel');
 assert.equal(await offence.isVisible(),true);
 assert.equal(await sea.locator('.game-unit-expandable > :first-child').getAttribute('class'),
  'game-offensive-effects-panel','Offensive effects should be above Defence summary');
 const razorQuick=offence.locator('.game-offensive-effect[data-effect-id="razor-standard"]');
 assert.equal(await razorQuick.count(),1);
 assert.match(await razorQuick.innerText(),/Armour Bane \\(2\\)/);
 assert.match(await razorQuick.innerText(),/Natural 6 To Wound/);
 assert.match(await razorQuick.innerText(),/AP improves by 2 for that wound only/);
 assert.match(await razorQuick.innerText(),/not for spells/i);
 assert.equal(await razorQuick.locator('a').filter({hasText:'How Armour Bane (2) works'}).getAttribute('href'),
  'https://tow.whfb.app/special-rules/armour-bane');
 assert.match(await sea.locator('.game-defence-panel [data-save="armour"]').innerText(),/5\\+/,
  'Razor Standard must never change the defending Sea Guard armour value');
 const razor=sea.locator('.game-effects-panel .game-effect-card[data-effect-id="razor-standard"]');
 assert.equal(await razor.count(),1);
 await razor.locator('summary').click();
 assert.match(await razor.locator('.game-effect-description').innerText(),/Armour Bane \(2\)/);
 assert.match(await razor.locator('.game-effect-description').innerText(),/does not gain Magical Attacks/);
 assert.equal(await razor.locator('.game-effect-source').first().getAttribute('href'),
  'https://tow.whfb.app/magic-item/razor-standard');
 const cloak=sea.locator('.game-effect-card[data-effect-id="the-loremasters-cloak"]');
 assert.equal(await cloak.count(),1);
 await cloak.locator('summary').click();
 assert.match(await cloak.locator('.game-effect-scope').first().innerText(),/Champion bearer only/);
 const company=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator("h3:text-is(\"Ship's Company\")")}).first();
 await company.locator('.game-unit-expand-toggle').click();
 assert.match(await company.locator('.game-effect-empty').innerText(),/No supported source-reviewed effects/);

 // A Battle Standard carries its own item, and joins are recorded rather than guessed.
 const bsb=page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'202 pts'}).first();
 const bsbId=await bsb.getAttribute('data-unit-id');
 assert.ok(bsbId);
 await bsb.locator('.game-unit-expand-toggle').click();
 assert.equal(await bsb.locator('.game-effect-card[data-effect-id="banner-of-confidence"]').count(),1);
 assert.equal(await sea.locator('.game-effect-card[data-effect-id="banner-of-confidence"]').count(),0);
 await bsb.locator('.character-unit-picker').selectOption(seaId);
 const sharedBanner=sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="banner-of-confidence"]');
 assert.equal(await sharedBanner.count(),1);
 assert.equal(await sharedBanner.getAttribute('data-shared'),'true');
 assert.match(await sea.locator('.game-card-status').innerText(),/conditional/);
 assert.equal(await bsb.locator('.game-effect-card[data-effect-id="razor-standard"]').count(),1,
  'A character joined to Sea Guard receives the unit standard effect');
 assert.equal(await bsb.locator('.game-offensive-effect[data-effect-id="razor-standard"]').count(),1,
  'Joined characters see shared Armour Bane in the same visible Offensive effects panel');
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="ruby-ring-of-ruin"]').count(),0,
  'The BSB ring is not shared as a unit-wide magic item');

 // Ruby Ring is a separate Bound spell, not a newly known Wizard spell.
 await page.locator('#gameNavMagic').click();
 const bound=page.locator('#gameItemAbilities .game-effect-card[data-effect-id="ruby-ring-of-ruin"]');
 assert.equal(await bound.count(),1);
 await bound.locator('summary').click();
 assert.match(await bound.innerText(),/Fireball.*Power Level 1/);
 assert.equal(await bound.locator('a').filter({hasText:'Fireball spell source'}).getAttribute('href'),
  'https://tow.whfb.app/spell/fireball');

 // Scrolls are one-use; a single tap changes state and the same state is
 // shown in both unit cards and Magic, without affecting spell knowledge.
 const scroll=page.locator('#gameItemAbilities .game-effect-card[data-effect-id="scroll-of-invocation"]');
 await scroll.locator('summary').click();
 assert.equal(await scroll.getAttribute('data-status'),'ready');
 await scroll.locator('button.game-effect-action').filter({hasText:'Mark used'}).click();
 assert.equal(await scroll.getAttribute('data-status'),'spent');
 await page.locator('#gameNavUnits').click();
 const storm=page.locator('#gameCharacters .game-character-card')
  .filter({has:page.locator('h3:text-is("Storm Weaver")')}).first();
 if(await storm.locator('.game-unit-expandable').isHidden())
  await storm.locator('.game-unit-expand-toggle').click();
 assert.equal(await storm.locator('.game-effect-card[data-effect-id="scroll-of-invocation"]')
  .getAttribute('data-status'),'spent');

 // A timed single-use Elixir is active only after the player records use.
 const elixir=page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'153 pts'}).first();
 await elixir.locator('.game-unit-expand-toggle').click();
 const potion=elixir.locator('.game-effect-card[data-effect-id="elixir-of-power"]');
 assert.equal(await potion.getAttribute('data-status'),'ready');
 await potion.locator('summary').click();
 await potion.locator('button.game-effect-action').filter({hasText:'Confirm consumed'}).click();
 assert.equal(await potion.getAttribute('data-status'),'active');
 assert.match(await elixir.locator('.game-card-status').innerText(),/Active: Elixir of Power/);
 await page.locator('#gameNavMagic').click();
 assert.match(await page.locator('#spellControlPanel .game-spell-heading').innerText(),/1 items active/);
 assert.equal(await page.locator('#spellControlPanel .game-active-items .game-effect-card[data-effect-id="elixir-of-power"]').count(),1);
 await page.locator('#gameNavOverview').click();
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/Player-recorded active items/);
 assert.match(await page.locator('#gameOverviewPanel').innerText(),/Elixir of Power/);
 await page.locator('#gameNavUnits').click();
 await potion.locator('summary').click();
 await potion.locator('button.game-effect-action').filter({hasText:'Finish effect'}).click();
 assert.equal(await potion.getAttribute('data-status'),'spent');
 assert.match(await elixir.locator('.game-card-status').innerText(),/spent/);

 // Charmed Shield continues using its existing item-use record, not a new flag.
 const shield=bsb.locator('.game-effect-card[data-effect-id="charmed-shield"]');
 await shield.locator('summary').click();
 assert.equal(await shield.getAttribute('data-status'),'ready');
 await shield.locator('button.game-effect-action').filter({hasText:'Mark shield used'}).click();
 assert.equal(await shield.getAttribute('data-status'),'spent');
 assert.equal(await bsb.locator('.game-defence-shield-used input').isChecked(),true);
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('saved automatically'),
  null,{timeout:15000});
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#battleSessionStatus')?.textContent?.includes('recovered'),
  null,{timeout:15000});
 await page.locator('#gameNavMagic').click();
 assert.equal(await page.locator('#gameItemAbilities .game-effect-card[data-effect-id="scroll-of-invocation"]')
  .getAttribute('data-status'),'spent');
 await page.locator('#gameNavUnits').click();
 assert.equal(await page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'153 pts'}).first().locator('.game-effect-card[data-effect-id="elixir-of-power"]')
  .getAttribute('data-status'),'spent');
 assert.equal(await page.locator('#gameCharacters .game-character-card')
  .filter({hasText:'202 pts'}).first().locator('.game-defence-shield-used input').isChecked(),true);
 for(const v of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(v);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
   'No page-wide overflow at '+v.width);
  const height=await page.locator('.game-effect-summary:visible').first().evaluate(x=>x.getBoundingClientRect().height);
  assert.ok(height>=44,'Effect summary has 44px+ touch height');
 }
 assert.deepEqual(errors,[]);
 console.log('Unified item/banner effects, joined standards, Bound spell, timed and spent state, offline reload: PASS');
}finally{await browser.close();}

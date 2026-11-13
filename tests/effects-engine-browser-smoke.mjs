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
 assert.equal(await page.locator('#gameUnitsPanel').isVisible(),true,'Normal Play opens with army roster');
 const sea=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 assert.equal(await sea.locator('.game-card-status .game-card-chip').count(),0,
  'Only currently active effects belong in the header; passive rules move to the compact source list');
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),true);
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false);
 await sea.locator('.game-unit-expand-toggle').click();
 const seaAttackPanel=sea.locator(':scope > .game-unit-expandable > .game-attack-panel');
 assert.equal(await seaAttackPanel.locator('[data-attack-phase="shooting"] > h5').innerText(),'Shooting Attacks');
 const shootingBS=seaAttackPanel.locator('[data-attack-phase="shooting"] .game-attack-ballistic-skill');
 assert.equal(await shootingBS.isVisible(),true);
 assert.match(await shootingBS.innerText(),/Sea Guard.*BS.*4/s);
 assert.match(await shootingBS.innerText(),/Sea Master.*BS.*5/s);
 assert.equal(await shootingBS.locator('.game-attack-model').count(),2,
  'Selected champion has its own published BS, not an averaged value');
 assert.equal(await seaAttackPanel.locator('[data-attack-phase="combat"] > h5').innerText(),'Combat Attacks');
 assert.equal(await seaAttackPanel.locator('[data-attack-phase="shooting"] .game-attack-weapon')
  .filter({hasText:'Warbows'}).count(),1,
  'Ordinary regiment shooters still have their selected Warbows');
 assert.match(await seaAttackPanel.locator('[data-attack-phase="combat"]').innerText(),/Published melee attack components/);
 const offence=sea.locator(':scope > .game-unit-expandable > .game-attack-panel .game-offensive-effects-panel');
 assert.equal(await offence.isVisible(),true);
 const order=await sea.locator('.game-unit-expandable').evaluate(area=>{
  const children=[...area.children];
  return {offence:children.findIndex(el=>el.classList.contains('game-attack-panel')),
   defence:children.findIndex(el=>el.classList.contains('game-defence-panel'))};
 });
 assert.ok(order.offence>=0&&order.defence>order.offence,
  'Attacks should appear before Defence: '+JSON.stringify(order));
 const razorQuick=offence.locator('.game-offensive-effect[data-effect-id="razor-standard"]');
 assert.equal(await razorQuick.count(),1);
 assert.match(await razorQuick.innerText(),/Armour Bane \(2\)/);
 assert.match(await razorQuick.innerText(),/Natural 6 To Wound/);
 assert.match(await razorQuick.innerText(),/AP improves by 2 for that wound only/);
 assert.match(await razorQuick.innerText(),/not for spells/i);
 assert.equal(await razorQuick.locator('a').filter({hasText:'How Armour Bane (2) works'}).getAttribute('href'),
  'https://tow.whfb.app/special-rules/armour-bane');
 assert.match(await sea.locator('.game-defence-panel [data-save="armour"]').innerText(),/5\+/,
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
 const bsbAttacks=bsb.locator(':scope > .game-unit-expandable > .game-attack-panel');
 assert.equal(await bsbAttacks.isVisible(),true);
 const bsbShooting=bsbAttacks.locator('[data-attack-phase="shooting"]');
 const bsbCombat=bsbAttacks.locator('[data-attack-phase="combat"]');
 assert.match(await bsbShooting.innerText(),/Ruby Ring of Ruin.*Fireball/s);
 assert.equal(await bsbShooting.locator('.game-attack-bound .game-attack-stat')
  .filter({hasText:'BS'}).count(),0,
  'Fireball must use casting rather than the bearer\'s Ballistic Skill');
 assert.match(await bsbShooting.innerText(),/Hunter's Scorn/);
 assert.equal(await bsbShooting.locator('.game-attack-weapon').filter({hasText:'Longbow'}).count(),0,
  'Longbow cannot remain a separate shooting weapon for the bearer of Hunter\'s Scorn');
 assert.equal(await bsbShooting.locator('.game-attack-weapon').filter({hasText:"Hunter's Scorn"}).count(),1);
 const hunterCard=bsbShooting.locator('.game-attack-weapon')
  .filter({hasText:"Hunter's Scorn"});
 assert.match(await hunterCard.innerText(),/Range\s*30"/);
 assert.match(await hunterCard.innerText(),/Strength\s*5/);
 assert.match(await hunterCard.innerText(),/AP\s*-1/);
 assert.equal(await hunterCard.locator('.game-attack-weapon-conditions').count(),1);
 assert.equal(await hunterCard.locator('.game-attack-weapon-conditions').evaluate(x=>x.open),false);
 assert.equal(await hunterCard.locator('a.game-attack-source').getAttribute('href'),
  'https://tow.whfb.app/magic-item/hunters-scorn');
 assert.equal(await bsbShooting.locator('.game-attack-weapon-choice').count(),0,
  'Redundant mundane weapon replacement message should no longer occupy the battle view');
 assert.equal(await bsb.locator('.army-unit-unified-loadout .army-unit-loadout-pill')
  .filter({hasText:'Longbow'}).count(),0,
  'Superseded Longbow must not be shown in the BSB battle equipment panel');
 assert.equal(await bsb.locator('.army-unit-unified-loadout .army-unit-loadout-pill')
  .filter({hasText:"Hunter's Scorn"}).count(),1);
 assert.match(await bsbCombat.innerText(),/Published melee attack components/);
 assert.equal(await bsbCombat.locator('.game-attack-bound').count(),0);
 assert.match(await bsbAttacks.innerText(),/Ruby Ring of Ruin.*Fireball/s);
 assert.match(await bsbAttacks.innerText(),/Shooting phase.*Magic Missile.*Power Level 1/s);
 assert.match(await bsbAttacks.innerText(),/Casting\s*8\+/);
 assert.match(await bsbAttacks.innerText(),/Range\s*24/);
 assert.match(await bsbAttacks.innerText(),/Hits\s*2D6/);
 assert.match(await bsbAttacks.innerText(),/Strength\s*4/);
 assert.match(await bsbAttacks.innerText(),/Flaming Attacks/);
 assert.equal(await bsbAttacks.locator('a').filter({hasText:'Spell rules'}).getAttribute('href'),
  'https://tow.whfb.app/spell/fireball');
 assert.equal(await bsb.locator('.game-effect-card[data-effect-id="banner-of-confidence"]').count(),1);
 assert.equal(await sea.locator('.game-effect-card[data-effect-id="banner-of-confidence"]').count(),0);
 await bsb.locator('.character-unit-picker').selectOption(seaId);
 const sharedBanner=sea.locator(':scope > .game-unit-expandable > .game-effects-panel .game-effect-card[data-effect-id="banner-of-confidence"]');
 assert.equal(await sharedBanner.count(),1);
 assert.equal(await sharedBanner.getAttribute('data-shared'),'true');
 assert.equal(await sea.locator('.game-card-status .game-card-chip').count(),0,
  'Recorded conditional item remains available in Full but is not an active buff');
 assert.equal(await bsb.locator('.game-effect-card[data-effect-id="razor-standard"]').count(),1,
  'A character joined to Sea Guard receives the unit standard effect');
 assert.equal(await bsb.locator('.game-offensive-effect[data-effect-id="razor-standard"]').count(),1,
  'Joined characters see shared Armour Bane in the same visible Offensive effects panel');
 assert.equal(await sea.locator(':scope > .game-unit-expandable > .game-attack-panel .game-attack-bound').count(),0,
  'Joined character bound spell must never appear as a regiment attack');
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
 if(await storm.evaluate(e=>e.classList.contains('owc-view-compact')))
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
 assert.match(await elixir.locator('.game-card-status').innerText(),/Elixir of Power/);
 assert.equal(await elixir.locator('.game-card-status a.owc-active-rule-link').count(),1,
  'An active item opens its original reference without turning the effect off');
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
 assert.equal(await elixir.locator('.game-card-status .owc-active-rule-link').count(),0,
  'Spent item no longer appears as an active header badge');

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
 // Reload opens the army in Compact; expand Full to measure touch controls.
 await page.locator('#gameCharacters .game-character-card').filter({hasText:'202 pts'}).first()
  .locator('.game-unit-expand-toggle').click();
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

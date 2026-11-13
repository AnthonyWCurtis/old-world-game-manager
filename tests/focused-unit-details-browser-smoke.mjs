import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 const search=page.locator('#gameRosterSearch');
 const sea=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 const seaId=await sea.getAttribute('data-unit-id');
 const content=sea.locator(':scope > .game-unit-expandable');
 const table=sea.locator('.army-unit-card-body .army-profile-table');
 await table.waitFor({state:'visible',timeout:20000});
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-compact')),true,
  'The army roster opens with the approved Compact card by default');
 assert.equal(await content.isVisible(),true,'Equipment and characteristics appear directly in the army roster');
 assert.equal(await page.locator('#gameUnitFocusBack').count(),0,'No separate unit details navigation');
 assert.equal(await page.locator('#armyRosterList .army-unit-card').count(),17,'Other army units remain in roster');
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true);
 assert.equal(await content.locator(':scope > .game-attack-panel').isVisible(),false);
 // Only the regiment's own equipment and special rules appear in its pills,
 // even though attached characters have their own nested source cards.
 const ownPills=sea.locator(':scope > .game-unit-expandable > .army-unit-card-body > .owc-compact-loadout > .owc-compact-words .owc-compact-word');
 assert.ok(await ownPills.count()>0);
 assert.ok(!(await ownPills.allTextContents()).some(label=>/Mathlann's Ire|Hunter's Scorn|Elixir of Power/.test(label)),
  'Character selections must not be merged into the Sea Guard pills');
 const assigned=sea.locator('.owc-assigned-drawer');
 assert.equal(await assigned.count(),1,'Regiment has a single reusable assigned-character drawer');
 assert.equal(await assigned.evaluate(el=>el.open),false,'Assigned characters start collapsed');
 assert.equal(await sea.locator('.game-assigned-characters').isVisible(),false);
 await assigned.locator(':scope > summary').click();
 assert.equal(await assigned.evaluate(el=>el.open),true);
 assert.equal(await sea.locator('.game-assigned-characters').isVisible(),true);
 assert.equal(await sea.locator('.game-assignment-editor').isVisible(),true,
  'Original character assignment controls remain accessible');
 const picker=assigned.locator('.regiment-character-picker');
 const ishayaId=await picker.locator('option').filter({hasText:'Ishaya Vess'}).getAttribute('value');
 assert.ok(ishayaId,'Fixture offers Ishaya Vess as a possible assignment');
 await picker.selectOption(ishayaId);
 assert.match(await assigned.locator(':scope > summary').innerText(),/Assigned Characters \(1\)/);
 assert.equal(await assigned.evaluate(el=>el.open),true,'Assignment rerender preserves opened drawer');
 const attached=assigned.locator('.game-attached-character').first();
 await attached.locator(':scope > summary').click();
 assert.equal(await attached.locator('.army-unit-loadout-pill').filter({hasText:"Mathlann's Ire"}).count(),1,
  'The character keeps their own linked equipment inside their details');
 assert.ok(!(await ownPills.allTextContents()).some(label=>/Mathlann's Ire/.test(label)),
  'Assigning a character never injects their rules into the regiment pills');
 await attached.locator(':scope > summary').click();
 await assigned.locator(':scope > summary').click();
 assert.equal(await assigned.evaluate(el=>el.open),false);
 const profiles=table.locator('tbody tr:not(.army-profile-mount-row):not(.army-profile-mount-heading)');
 assert.ok(await profiles.count()>=2);
 assert.match(await profiles.first().innerText(),/Sea Guard/);
 assert.match(await profiles.nth(1).innerText(),/Sea Master/);
 assert.equal(await profiles.first().locator('th,td').count(),10);
 assert.equal(await profiles.nth(1).locator('.owc-different-stat').count(),2,
  'Champion profile highlights two changed stats in gold');
 const drilled=sea.locator('.owc-compact-word[href$="/special-rules/drilled"]').first();
 await drilled.click();
 assert.equal(await page.locator('.owc-rule-dialog').evaluate(d=>d.open),true);
 assert.equal(await page.locator('.owc-rule-original').getAttribute('href'),
  'https://tow.whfb.app/special-rules/drilled');
 await page.locator('.owc-rule-close').first().click();
 const originalCompact=await sea.locator('.owc-compact-loadout').innerText();
 const open=sea.locator('.game-unit-expand-toggle');
 assert.equal(await open.getAttribute('aria-expanded'),'false','Down arrow means Compact roster view');
 assert.equal(await sea.locator('.game-unit-focus-open').count(),0,'No separate Full View button');
 await open.click();
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-full')),true);
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true,
  'Equipment and Special Rules stay above characteristics in Full View');
 assert.equal(await sea.locator('.owc-compact-loadout').innerText(),originalCompact);
 assert.equal(await table.isVisible(),true);
 for(const selector of ['.game-attack-panel','.game-defence-panel','.game-effects-panel']){
  assert.equal(await content.locator(':scope > '+selector).isVisible(),true,selector+' must appear below Compact View');
 }
 assert.equal(await assigned.evaluate(el=>el.open),false,'Full View retains the assigned-character fold');
 await assigned.locator(':scope > summary').click();
 assert.equal(await sea.locator('.game-assigned-characters').isVisible(),true);
 await assigned.locator(':scope > summary').click();
 const order=await content.evaluate(node=>[...node.children].map(c=>c.className));
 const position=cls=>order.findIndex(x=>typeof x==='string'&&x.split(' ').includes(cls));
 assert.ok(position('army-unit-card-body')<position('game-attack-panel')&&
  position('game-attack-panel')<position('game-defence-panel'),
  'The expanded unit keeps Compact View at the top, with battle details beneath');
 assert.deepEqual(await content.locator(':scope > .game-attack-panel .game-attack-phase>h5').allTextContents(),
  ['Shooting Attacks','Combat Attacks']);
 assert.equal(await sea.locator('.game-unit-name-line .game-rename-toggle').isVisible(),true);
 assert.equal(await sea.locator('.game-compact-wounds').isVisible(),true);
 await open.click();
 assert.equal(await content.locator(':scope > .game-attack-panel').isVisible(),false);
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true);
 assert.equal(await open.getAttribute('aria-expanded'),'false');
 assert.equal(await content.isVisible(),true,'Compact view never collapses to name only');
 await open.click();
 assert.equal(await open.getAttribute('aria-expanded'),'true');
 assert.equal(await content.locator(':scope > .game-attack-panel').isVisible(),true);
 await open.click();
 assert.equal(await content.isVisible(),true);
 assert.equal(await content.locator(':scope > .game-attack-panel').isVisible(),false);
 await search.fill("Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);
 const ships=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3').filter({hasText:"Ship's Company"})});
 const second=ships.nth(1);
 await second.locator('.game-unit-expand-toggle').click();
 assert.equal(await second.evaluate(el=>el.classList.contains('owc-view-full')),true);
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-compact')),true,
  'Other cards keep independent view state');
 await second.locator('.game-unit-expand-toggle').click();
 await search.fill('Lothern Sea Guard');
 // Source link, wound counter and gameplay session are preserved through offline reload.
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const restored=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+seaId+'"]');
 assert.equal(await restored.locator('.owc-compact-loadout').isVisible(),true,
  'Compact View restores inside the army list offline');
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No global horizontal overflow at '+viewport.width);
 }
 await restored.locator('.game-rename-toggle').click();
 await restored.locator('.game-unit-rename-input').fill('Centre Sea Guard');
 await restored.locator('.game-unit-rename-save').click();
 const renamed=page.locator('#gameRegiments .army-unit-card[data-unit-id="'+seaId+'"]');
 await renamed.locator('h3:text-is("Centre Sea Guard")').waitFor();
 assert.match(await renamed.locator('.army-unit-nickname').first().innerText(),/Official: Lothern Sea Guard/);
 assert.equal(await renamed.locator('.owc-compact-loadout').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('Roster-first Compact, same-card Full, characteristics, rule viewer, offline and rename: PASS');
}finally{await browser.close();}

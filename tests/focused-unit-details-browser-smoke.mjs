import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',dialog=>dialog.accept());
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
 const visibleRosterCount=await page.locator('#armyRosterList .army-unit-card:visible').count();
 assert.ok(visibleRosterCount>1,'Compact View keeps the whole army roster available');
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),null,'There is no separate focused unit screen');
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),true,'Compact details are inline by default');
 assert.equal(await page.locator('#gameUnitFocusTabs').count(),0,'Unit detail must have no section tabs');
 const table=sea.locator('.army-unit-card-body > .army-profile-scroll .army-profile-table');
 await table.waitFor({state:'visible',timeout:20000});
 const profiles=table.locator('tbody tr:not(.army-profile-mount-row):not(.army-profile-mount-heading)');
 assert.ok(await profiles.count()>=2,'Sea Guard and champion share a compact characteristic table');
 assert.match(await profiles.first().innerText(),/Sea Guard/);
 assert.match(await profiles.nth(1).innerText(),/Sea Master/);
 assert.equal(await profiles.first().locator('th,td').count(),10,'One model column plus nine stats');
 assert.equal(await profiles.nth(1).locator('.owc-different-stat').count(),2,
  'Champion BS and Attacks differences are highlighted in gold');
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-compact')),true,'Roster opens in Compact View');
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true);
 assert.equal(await sea.locator('.army-profile-scroll').isVisible(),true);
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false,
  'Compact view shows source-linked loadout and characteristics, not the entire full card');
 const drilled=sea.locator('.owc-compact-word[href$="/special-rules/drilled"]').first();
 assert.ok(await drilled.count()>0,'Drilled has a source-backed reference');
 await drilled.click();
 assert.equal(await page.locator('.owc-rule-dialog').evaluate(d=>d.open),true,
  'Source pages open inside the same Game Manager');
 assert.equal(await page.locator('.owc-rule-original').getAttribute('href'),
  'https://tow.whfb.app/special-rules/drilled');
 await page.locator('.owc-rule-close').first().click();
 assert.equal(await page.locator('.owc-rule-dialog').evaluate(d=>d.open),false);
 const switchView=sea.locator('.game-unit-focus-open');
 assert.equal(await switchView.isVisible(),true,'Inline Full View control is reachable');
 assert.match(await switchView.getAttribute('aria-label'),/^Show full view/);
 assert.equal(await switchView.getAttribute('aria-pressed'),'false');
 await switchView.click();
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-full')),true,'Full View expands this same card');
 assert.equal(await switchView.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),visibleRosterCount,
  'Full View keeps other units accessible in the roster');
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),true);
 // Shared name, wounds, effects and all original gameplay controls are unchanged.
 assert.deepEqual(await sea.locator('.game-attack-phase>h5').allTextContents(),
  ['Shooting Attacks','Combat Attacks']);
 assert.equal(await sea.locator('.game-unit-name-line .game-rename-toggle').isVisible(),true);
 assert.equal(await sea.locator('.game-compact-wounds').isVisible(),true);
 assert.equal(await sea.locator('.game-unit-expand-toggle').count(),1,
  'There is one collapse arrow for the entire inline unit');
 // Structural approval did not authorize replacing Tactical V2's theme.
 // Wait for the existing card transition and compare the exact shared
 // navy surface token rather than assuming preview charcoal colours.
 const themed=await page.waitForFunction(id=>{
  const card=document.querySelector('#armyRosterList .army-unit-card[data-unit-id="'+id+'"]');
  if(!card)return false;
  const colour=getComputedStyle(card).backgroundColor;
  const surface=getComputedStyle(document.body).getPropertyValue('--tc-surface').trim();
  const probe=document.createElement('span');
  probe.style.backgroundColor=surface;
  document.body.append(probe);
  const expected=getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour===expected?{colour,expected}:false;
 },seaId,{timeout:12000});
 assert.ok((await themed.jsonValue()).colour,
  'Full card must use the existing navy Tactical V2 surface');
 assert.deepEqual(await sea.locator('.owc-compact-loadout .owc-compact-label').allTextContents(),
  ['Equipment & Upgrades','Special Rules'],'Full View retains the source-linked loadout above characteristics');
 for(const selector of [
  '.army-unit-card-body','.game-attack-panel','.game-defence-panel',
  '.owc-compact-loadout','.game-effects-panel','.game-assigned-characters',
  '.game-unit-victory-points'
 ]){
  assert.equal(await sea.locator(selector).first().isVisible(),true,
   selector+' must be visible without opening another tab or section');
 }
 assert.equal(await sea.locator('details.game-focused-disclosure').count(),0,
  'There is no second accordion around the characteristics or loadout');
 const order=await sea.locator(':scope > .game-unit-expandable').evaluate(content=>
  [...content.children].map(node=>node.className));
 const orderOf=cls=>order.findIndex(value=>typeof value==='string'&&value.split(' ').includes(cls));
 assert.ok(orderOf('army-unit-card-body')<orderOf('game-attack-panel')&&
  orderOf('game-attack-panel')<orderOf('game-defence-panel')&&
  orderOf('game-defence-panel')<orderOf('army-unit-unified-loadout')&&
  orderOf('army-unit-unified-loadout')<orderOf('game-effects-panel'),
  'One card reads top-to-bottom: characteristics, attacks, defence, equipment, effects');
 const fold=sea.locator('.game-unit-expand-toggle');
 assert.equal(await fold.getAttribute('aria-expanded'),'true');
 await fold.click();
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),false,
  'The single unit arrow collapses the entire card body');
 assert.equal(await sea.locator('.game-compact-wounds').isVisible(),true,'Wound tracking remains available when folded');
 await fold.click();
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true,
  'Reopening the unit restores Compact View in the same card');
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false);
 await switchView.click();
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),true,
  'Full View remains available after folding and reopening');

 await search.fill("Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3,'Search narrows the roster without entering a focused screen');
 const ships=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Ship\'s Company")')});
 const firstId=await ships.nth(0).getAttribute('data-unit-id');
 const secondId=await ships.nth(1).getAttribute('data-unit-id');
 assert.notEqual(firstId,secondId,'Repeated regiments retain separate imported identities');
 assert.equal(await ships.first().evaluate(el=>el.classList.contains('owc-view-compact')),true);
 await ships.nth(1).locator('.game-unit-focus-open').click();
 assert.equal(await ships.nth(1).evaluate(el=>el.classList.contains('owc-view-full')),true,
  'Only the selected duplicate switches to Full View');
 assert.equal(await ships.first().evaluate(el=>el.classList.contains('owc-view-compact')),true,
  'Switching one duplicate leaves the other in Compact View');
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);
 await ships.nth(1).locator('.game-unit-focus-open').click();
 assert.equal(await ships.nth(1).evaluate(el=>el.classList.contains('owc-view-compact')),true);
 assert.equal(await search.inputValue(),"Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);

 await search.fill('Lothern Sea Guard');
 assert.equal(await sea.evaluate(el=>el.classList.contains('owc-view-full')),true,'Sea Guard keeps its current inline view while searching');
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#armyRosterPage')?.hidden||
  document.querySelectorAll('#savedList .row-item').length>0,null,{timeout:20000});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),null,'Offline reload keeps roster-first navigation');
 assert.equal(await sea.locator('.owc-compact-loadout').isVisible(),true,'Offline reload restores the Compact card');
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false,'Full detail is opt-in after reloading');
 await sea.locator('.game-unit-focus-open').click();
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),true,'Attacks restored offline');
 assert.equal(await sea.locator('.game-defence-panel').isVisible(),true,'Defence restored offline');
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No global horizontal overflow at '+viewport.width);
   const stableTouch=await page.waitForFunction(id=>{
    const card=document.querySelector('#armyRosterList .army-unit-card[data-unit-id="'+id+'"]');
    const buttons=[card?.querySelector('.game-unit-expand-toggle'),card?.querySelector('.game-unit-focus-open')];
    if(buttons.some(button=>!button||!button.isConnected))return false;
    const heights=buttons.map(button=>button.getBoundingClientRect().height);
    const visible=buttons.every(button=>getComputedStyle(button).visibility==='visible');
    return heights.every(height=>height>=44)&&visible?{heights,visible}:false;
   },seaId,{timeout:12000});
   const measured=await stableTouch.jsonValue();
   assert.ok(measured.heights.every(height=>height>=44)&&measured.visible,
    'Inline fold and view controls must be >=44px and visible at '+viewport.width+': '+JSON.stringify(measured));
 }
 const selected=page.locator('#armyRosterList .army-unit-card[data-unit-id="'+seaId+'"]');
 await selected.locator('.game-rename-toggle').click();
 await selected.locator('.game-unit-rename-input').fill('Centre Sea Guard');
 await selected.locator('.game-unit-rename-save').click();
 await page.waitForFunction(id=>document.querySelector('#armyRosterList .army-unit-card[data-unit-id="'+id+'"] h3')?.textContent==='Centre Sea Guard',
  seaId,{timeout:10000});
 assert.equal(await selected.getAttribute('data-unit-id'),seaId,'Renaming preserves imported unit identity');
 assert.match(await selected.locator('.army-unit-nickname').first().innerText(),/Official: Lothern Sea Guard/);
 assert.equal(await page.locator('#gameUnitFocusTabs').count(),0,
  'The full unit remains a single section without tabs after a state rerender');
 assert.equal(await selected.evaluate(el=>el.classList.contains('owc-view-full')),true,
  'Renaming rerenders the roster without resetting the selected Full View');
 assert.equal(await selected.locator('.game-attack-panel').isVisible(),true);
 assert.equal(await selected.locator('.game-defence-panel').isVisible(),true);
 await selected.locator('.game-unit-focus-open').click();
 assert.equal(await selected.locator('.game-attack-panel').isVisible(),false,
  'The view control still switches back to Compact after a state redraw');
 await selected.locator('.game-unit-focus-open').click();
 assert.equal(await selected.locator('.game-attack-panel').isVisible(),true);

 assert.deepEqual(errors,[]);
 console.log('Inline Compact/Full unit profiles, rule links, single fold, duplicates, offline reload and rename: PASS');
}finally{
 await browser.close();
}

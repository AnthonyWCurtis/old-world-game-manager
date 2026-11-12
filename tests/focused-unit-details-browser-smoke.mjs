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
 await sea.locator('.game-unit-focus-open').click();
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),seaId);
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),1,'A focused unit is the only visible card');
 assert.equal(await page.locator('#gameUnitFocusTabs button').count(),4);
 assert.equal(await page.locator('#gameUnitFocusTabs [data-focus-tab="profile"]').getAttribute('aria-pressed'),'true');
 const tiles=sea.locator('.game-profile-stat-group');
 await tiles.first().waitFor({state:'visible',timeout:20000});
 assert.ok(await tiles.count()>=2,'Published Sea Guard and Sea Master each have a separate profile');
 assert.match(await tiles.first().innerText(),/Sea Guard/);
 assert.match(await tiles.nth(1).innerText(),/Sea Master/);
 assert.match(await tiles.first().innerText(),/BS\s*4/);
 assert.match(await tiles.nth(1).innerText(),/BS\s*5/);
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false);
 await page.locator('#gameUnitFocusTabs [data-focus-tab="attacks"]').click();
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),true);
 assert.equal(await sea.locator('.game-defence-panel').isVisible(),false);
 await page.locator('#gameUnitFocusTabs [data-focus-tab="defence"]').click();
 assert.equal(await sea.locator('.game-defence-panel').isVisible(),true);
 assert.equal(await sea.locator('.game-attack-panel').isVisible(),false);
 await page.locator('#gameUnitFocusTabs [data-focus-tab="effects"]').click();
 assert.equal(await sea.locator('.game-effects-panel').isVisible(),true);
 assert.equal(await sea.locator('.game-assigned-characters').isVisible(),true);

 await page.locator('#gameUnitFocusBack').click();
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),null);
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),false,'Back does not leave a giant inline panel open');
 await search.fill("Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);
 const ships=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Ship\'s Company")')});
 const secondId=await ships.nth(1).getAttribute('data-unit-id');
 await ships.nth(1).locator('.game-unit-focus-open').click();
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),secondId,'Duplicate regiment instances stay independent');
 await page.locator('#gameUnitFocusBack').click();
 assert.equal(await search.inputValue(),"Ship's Company");
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),3);

 await search.fill('Lothern Sea Guard');
 await sea.locator('.game-unit-focus-open').click();
 await page.locator('#gameUnitFocusTabs [data-focus-tab="defence"]').click();
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),seaId,'Offline reload restores focused unit');
 assert.equal(await page.locator('#gameUnitFocusTabs [data-focus-tab="defence"]').getAttribute('aria-pressed'),'true','Focused tab restored offline');
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No global horizontal overflow at '+viewport.width);
  const height=await page.locator('#gameUnitFocusBack').evaluate(el=>el.getBoundingClientRect().height);
  const diagnostics=await page.evaluate(()=>{
   const root=document.querySelector('#armyRosterPage'),panel=document.querySelector('#gameUnitsPanel'),
    toolbar=document.querySelector('#gameUnitFocus'),button=document.querySelector('#gameUnitFocusBack');
   return {rootHidden:root.hidden,panelHidden:panel.hidden,toolbarHidden:toolbar.hidden,
    rootDisplay:getComputedStyle(root).display,panelDisplay:getComputedStyle(panel).display,
    toolbarDisplay:getComputedStyle(toolbar).display,buttonDisplay:getComputedStyle(button).display,
    unitId:document.querySelector('#armyRosterList')?.dataset.focusUnit};
  });
  assert.ok(height>=44,'Back touch target '+viewport.width+': '+height+'px '+JSON.stringify(diagnostics));
 }
 assert.deepEqual(errors,[]);
 console.log('Focused Normal Play view, source profile tiles, four panels, duplicate units, Back and offline reload: PASS');
}finally{
 await browser.close();
}

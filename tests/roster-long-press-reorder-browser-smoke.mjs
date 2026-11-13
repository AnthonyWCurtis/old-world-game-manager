import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 const cards=page.locator('#gameCharacters .game-roster-section-content > .army-unit-card');
 assert.equal(await cards.count(),7);
 const before=await cards.evaluateAll(els=>els.map(e=>({id:e.dataset.unitId,index:e.querySelector('.army-unit-index')?.textContent,cost:e.querySelector('.army-unit-points strong')?.textContent})));
 const reset=page.locator('#gameRosterResetOrder');
 assert.equal(await reset.isVisible(),true,'A reset control is available beside roster search');
 assert.equal(await reset.isDisabled(),true,'Initial display order is the imported source order');
 const help=page.locator('#gameRosterReorderHelp');
 assert.match(await help.innerText(),/hold/i);

 const first=cards.first();
 await first.locator('.army-unit-head').scrollIntoViewIfNeeded();
 const one=await cards.nth(0).boundingBox(),two=await cards.nth(1).boundingBox();
 assert.ok(one&&two,'Touch targets are in viewport');
 const client=await context.newCDPSession(page);
 const firstHandle=await cards.first().locator('.army-unit-index').boundingBox();
 assert.ok(firstHandle,'Source index badge is a safe non-control drag handle');
 const from={x:firstHandle.x+firstHandle.width/2,y:firstHandle.y+firstHandle.height/2,id:1},toY=two.y+two.height/2+12;
 const unitGeometry=await first.evaluate(card=>{
   const rect=cls=>card.querySelector(cls)?.getBoundingClientRect().toJSON();
   const header=card.querySelector('.army-unit-head');
   return {card:card.getBoundingClientRect().toJSON(),
    header:rect('.army-unit-head'),identity:rect('.army-unit-identity'),
    index:rect('.army-unit-index'),counter:rect('.game-compact-wounds'),
    button:rect('.game-wound-step'),focus:rect('.game-unit-expand-toggle'),
    grid:getComputedStyle(header).gridTemplateColumns,display:getComputedStyle(header).display};
 });
 const targetInfo=await page.evaluate(({x,y})=>{
  const e=document.elementFromPoint(x,y);
  return {tag:e?.tagName,cls:typeof e?.className==='string'?e.className:null,
   inHeader:!!e?.closest('.army-unit-head'),
   blockedControl:!!e?.closest('button,a,input,select,textarea,label,summary,[contenteditable="true"]'),
   x,y,rect:e?.getBoundingClientRect().toJSON()};
 },from);
 assert.equal(targetInfo.inHeader,true,'Expected header drag point, got '+JSON.stringify(targetInfo));
 assert.equal(targetInfo.blockedControl,false,'Drag hit an interactive control '+JSON.stringify({targetInfo,unitGeometry}));
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
 await page.waitForTimeout(480);
 const dragReady=await page.locator('#armyRosterList').evaluate(el=>el.classList.contains('game-roster-reordering'));
 assert.equal(dragReady,true,'Long press on source index badge must begin a reorder drag (not trigger a button)');
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...from,y:toY}]});
 await page.waitForTimeout(90);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),null,
  'Reordering must not accidentally open the focused unit');
 const after=await cards.evaluateAll(els=>els.map(e=>({id:e.dataset.unitId,index:e.querySelector('.army-unit-index')?.textContent,cost:e.querySelector('.army-unit-points strong')?.textContent})));
 assert.deepEqual(after.slice(0,2).map(x=>x.id),[before[1].id,before[0].id],
  'Long-press drag moves the exact first unit instance down one slot');
 const byId=Object.fromEntries(before.map(item=>[item.id,item]));
 for(const item of after)assert.deepEqual(item,byId[item.id],
  'Reorder never changes source index or imported cost');
 assert.equal(await reset.isEnabled(),true);
 const search=page.locator('#gameRosterSearch');
 await search.fill('Storm Weaver');
 assert.equal(await page.locator('#armyRosterList .army-unit-card:visible').count(),1);
 assert.match(await help.innerText(),/clear.*search/i);
 await search.fill('');
 const moved=cards.nth(1);
 await moved.locator('.army-unit-head').focus();
 await page.keyboard.press('Alt+ArrowUp');
 assert.deepEqual(await cards.evaluateAll(els=>els.slice(0,2).map(e=>e.dataset.unitId)),
  before.slice(0,2).map(x=>x.id),'Keyboard can reorder without dragging');
 assert.equal(await reset.isDisabled(),true,'Restoring source order clears the personal preference');
 await cards.first().locator('.game-unit-expand-toggle').click();
 assert.equal(await page.locator('#armyRosterList').getAttribute('data-focus-unit'),before[0].id);
 await cards.first().locator('.game-unit-expand-toggle').click();

 // Arrange the first unit again, then persist through a full offline reload.
 const header=cards.first().locator('.army-unit-head');
 await header.scrollIntoViewIfNeeded();
 const one2=await cards.nth(0).boundingBox(),two2=await cards.nth(1).boundingBox();
 const secondHandle=await cards.first().locator('.army-unit-index').boundingBox();
 assert.ok(secondHandle);
 const point={x:secondHandle.x+secondHandle.width/2,y:secondHandle.y+secondHandle.height/2,id:2};
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await page.waitForTimeout(480);
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,y:two2.y+two2.height/2+12}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await cards.first().getAttribute('data-unit-id'),before[1].id);
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 const persisted=page.locator('#gameCharacters .game-roster-section-content > .army-unit-card');
 assert.equal(await persisted.first().getAttribute('data-unit-id'),before[1].id,'Personal order restored offline');
 await page.locator('#gameRosterResetOrder').click();
 assert.deepEqual(await persisted.evaluateAll(els=>els.map(x=>x.dataset.unitId)),before.map(x=>x.id),'Reset restores original order');
 for(const width of [320,390,956]){
  await page.setViewportSize({width,height:width===956?440:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No global horizontal overflow at '+width+'px');
 }
 assert.deepEqual(errors,[]);
 console.log('Long-press roster drag, keyboard, undo, duplicate-safe source references, offline persistence: PASS');
}finally{
 await browser.close();
}

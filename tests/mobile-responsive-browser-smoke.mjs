import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {showUnitsAndExpand,showMagic} from './touch-layout-test-helpers.mjs';

const browser=await chromium.launch({headless:true});
const viewports=[
 {width:320,height:740,name:'small phone portrait'},
 {width:375,height:812,name:'phone portrait'},
 {width:390,height:844,name:'phone portrait large'},
 {width:430,height:932,name:'large phone portrait'},
 {width:568,height:320,name:'small phone landscape'},
 {width:667,height:375,name:'phone landscape'},
 {width:844,height:390,name:'large phone landscape'},
 {width:956,height:440,name:'max-size phone landscape'},
 {width:768,height:1024,name:'tablet portrait'},
 {width:1024,height:768,name:'tablet landscape'}
];
const assertPageFits=async(page,step,v)=>{
 const measurement=await page.evaluate(()=>{
  const view=document.documentElement.clientWidth;
  const offenders=[...document.querySelectorAll('body *')].filter(el=>{
   if(getComputedStyle(el).display==='none'||!el.getClientRects().length)return false;
   const r=el.getBoundingClientRect();
   return r.width>0&&(r.right>view+2||r.left< -2);
  }).slice(0,7).map(el=>({tag:el.tagName,className:String(el.className).slice(0,60),
   right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}));
  return {view,scrollWidth:document.documentElement.scrollWidth,offenders};
 });
 assert.ok(measurement.scrollWidth<=v.width+1,
  step+' — '+v.name+' '+v.width+'x'+v.height+': horizontal overflow '+JSON.stringify(measurement));
};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,
  hasTouch:true,isMobile:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 const viewport=await page.locator('meta[name=viewport]').getAttribute('content');
 assert.match(viewport,/width=device-width/);
 assert.match(viewport,/viewport-fit=cover/);
 assert.doesNotMatch(viewport,/user-scalable=no|maximum-scale=1/i,
  'Do not disable user pinch-to-zoom or accessible zoom');
 assert.equal(await page.locator('link[href*="mobile.css"]').count(),1);
 assert.match(readFileSync(new URL('../docs/mobile.css',import.meta.url),'utf8'),
  /safe-area-inset-left/);
 assert.match(readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8'),
  /'\.\/mobile.css'/);

 for(const v of viewports){
  await page.setViewportSize({width:v.width,height:v.height});
  await assertPageFits(page,'import form',v);
  if(v.width<=650){
   const font=await page.locator('#sourceText').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   assert.ok(font>=16,'Safari text input should not automatically zoom: '+font);
   for(const id of ['parseBtn','exampleBtn']){
    const height=await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(height>=44,'Touch target '+id+' too small: '+height+'px');
   }
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await showUnitsAndExpand(page);
 await page.waitForFunction(()=>document.querySelectorAll('.army-profile-scroll').length>0,
  null,{timeout:20000});
 for(const v of viewports){
  await page.setViewportSize({width:v.width,height:v.height});
  await assertPageFits(page,'Game Screen',v);
  const buttons=['gameNavOverview','gameNavUnits','gameNavMagic','backToImporterBtn','gameScreenSaveBtn',
   'gameUnitFocusBack'];
  if(v.width<=650){
   for(const id of buttons){
    const target=id==='gameUnitFocusBack'?page.locator('.game-roster-section-toggle').first():page.locator('#'+id);
    const h=await target.evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(h>=44,'Game Screen touch target '+id+' too small: '+h+'px');
   }
   const wide=await page.locator('.army-profile-scroll').first().evaluate(el=>({
    client:el.clientWidth,scroll:el.scrollWidth,
    table:el.querySelector('table')?.getBoundingClientRect().width
   }));
   assert.ok(wide.scroll>wide.client&&wide.table>=620,
    'Full stats must remain legible and scroll only within the table at '+v.width+'px: '+JSON.stringify(wide));
   assert.equal(await page.locator('.game-roster-search-input').isVisible(),true,'Unit search is primary navigation');
   assert.equal(await page.locator('#gameUnitsPanel .game-screen-jump').isVisible(),false,'Legacy redundant jump navigation is hidden');
  }
 }
 await page.setViewportSize({width:390,height:844});
 const spellbook=page.locator('#gameCharacters .game-character-card .game-wizard-spellbook').first();
 await spellbook.waitFor({state:'attached'});
 await spellbook.locator(':scope > summary').click();
 const search=spellbook.locator('.game-wizard-spell-search');
 const searchFont=await search.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 assert.ok(searchFont>=16,'Search input too small for iOS automatic input zoom');
 await assertPageFits(page,'expanded Wizard',viewports[2]);
 await page.locator('#gameScreenSaveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:20000});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('#importPage').isVisible())
  await page.locator('#savedList .row-item button').filter({hasText:'Open'}).first().click();
 await page.locator('#armyRosterPage').waitFor({state:'visible'});
 await assertPageFits(page,'offline restored Game Screen',viewports[2]);
 assert.equal(await page.locator('link[href*="mobile.css"]').count(),1);
 assert.deepEqual(errors,[]);
 console.log('Adaptive mobile, tablet, portrait, landscape, touch targets, scrollable tables and offline: PASS');
}finally{await browser.close();}

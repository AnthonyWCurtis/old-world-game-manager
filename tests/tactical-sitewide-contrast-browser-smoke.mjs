import assert from 'node:assert/strict';
import {chromium} from 'playwright';

/* Cross-screen, computed-style contrast check. Tests the colours users actually
 * see, not just token declarations. This is intentionally army-agnostic. */
const browser=await chromium.launch({headless:true});
const errors=[],results=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 const audit=async(stage,rootSelector)=>{
  await page.waitForTimeout(90);
  const result=await page.locator(rootSelector).evaluate(root=>{
   function rgba(raw){
    const items=(raw||'').match(/[\d.]+/g)?.map(Number)||[];
    if(items.length<3)return null;
    return [items[0],items[1],items[2],items[3]??1];
   }
   function compose(fore,back){
    const a=fore[3];
    return [0,1,2].map(i=>fore[i]*a+back[i]*(1-a));
   }
   function bg(el){
    const layers=[];
    for(let node=el;node;node=node.parentElement){
     const layer=rgba(getComputedStyle(node).backgroundColor);
     if(layer&&layer[3]>0)layers.unshift(layer);
    }
    let combined=[255,255,255];
    for(const layer of layers)combined=compose(layer,combined);
    return combined;
   }
   function lum(rgb){
    const normalized=rgb.map(c=>{
     const v=c/255;
     return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
    });
    return .2126*normalized[0]+.7152*normalized[1]+.0722*normalized[2];
   }
   function contrast(a,b){
    const x=lum(a),y=lum(b);
    return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
   }
   function visible(el){
    const c=getComputedStyle(el);
    return el.getClientRects().length>0&&c.visibility==='visible'&&c.display!=='none'&&Number(c.opacity)>.5;
   }
   function identity(el){
    const parts=[];
    for(let n=el;n&&parts.length<3;n=n.parentElement){
     const cls=typeof n.className==='string'?n.className.trim().split(/\s+/).slice(0,2).join('.'):'';
     parts.push(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(cls?'.'+cls:''));
    }
    return parts.join(' > ');
   }
   const items=[];
   const candidates=[root,...root.querySelectorAll('*')];
   for(const el of candidates){
    if(!visible(el)||el.closest('[aria-hidden="true"],[inert]')||el.closest('button:disabled')||el.matches('script,style,svg,option'))continue;
    const raw=el.childNodes.length&&[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
    const input=el.matches('input:not([type=checkbox]):not([type=radio]),textarea,select');
    const val=raw|| (input?(el.value||el.getAttribute('placeholder')||'').trim():'');
    if(!val||!raw&&!input)continue;
    const foreground=rgba(getComputedStyle(el).color);
    // Some controls use transparent source text and a visible ::before icon.\n    // Do not treat deliberately non-rendered source text as painted content.\n    if(!foreground||foreground[3]<.05)continue;
    const background=bg(el);
    const blended=compose(foreground,background);
    const ratio=contrast(blended,background);
    if(ratio<4.5){
     items.push({text:val.replace(/\s+/g,' ').slice(0,65),path:identity(el),
      fg:foreground.map(x=>Math.round(x)),bg:background.map(x=>Math.round(x)),
      ratio:Math.round(ratio*100)/100});
    }
   }
   return {scanned:candidates.length,issues:items};
  });
  results.push({stage,scanned:result.scanned,issues:result.issues});
  const keys=new Set(result.issues.map(x=>x.path+' '+x.ratio));
  console.log(stage+': '+result.scanned+' elements; '+result.issues.length+' contrast failures across '+keys.size+' selectors');
 };

 await audit('Home · importer and saved armies','#importPage');
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await audit('Import results and reports','#importPage');
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 await audit('My Army · compact roster','#armyRosterPage');
 await page.locator('#gameNavOverview').click();
 await audit('Overview · battle status','#armyRosterPage');
 await page.locator('#gameNavUnits').click();
 const card=page.locator('#gameRegiments .army-unit-card')
  .filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 await card.locator('.game-unit-focus-open').click();
 for(const tab of ['profile','attacks','defence','effects']){
  await page.locator('#gameUnitFocusTabs [data-focus-tab="'+tab+'"]').click();
  await audit('Unit detail · '+tab,'#armyRosterPage');
 }
 await page.locator('#gameUnitFocusBack').click();
 await page.locator('#gameNavMagic').click();
 await audit('Magic · initial','#armyRosterPage');
 const books=page.locator('#gameKnownSpellbookDrawer');
 if(await books.count()&&await books.isVisible())
  await books.locator(':scope > summary').click();
 const firstBook=books.locator('details.game-wizard-spellbook').first();
 if(await firstBook.count()&&await firstBook.isVisible()){
  if(!(await firstBook.evaluate(el=>el.open)))await firstBook.locator(':scope > summary').click();
 }
 const item=page.locator('#gameItemAbilities .game-effect-card').first();
 if(await item.count())await item.locator('summary').click();
 await audit('Magic · expanded spellbook/item','#armyRosterPage');
 await page.locator('#gameScreenSaveBtn').click();
 await page.locator('#backToImporterBtn').click();
 await audit('Home · populated saved armies','#importPage');

 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No page-wide horizontal overflow at '+viewport.width);
 }
 assert.deepEqual(errors,[],'No browser exceptions during site-wide audit');
 const issues=results.flatMap(result=>result.issues.map(issue=>({...issue,stage:result.stage})));
 // Group by CSS selector and representative colours to avoid a huge card-by-card dump.
 const grouped=new Map();
 for(const issue of issues){
  const key=issue.stage+' '+issue.path+' '+issue.fg.join(',')+'|'+issue.bg.join(',');
  const previous=grouped.get(key);
  if(previous)previous.count++;
  else grouped.set(key,{...issue,count:1});
 }
 console.log('AUDIT SUMMARY: '+results.length+' screens; '+issues.length+' failing text elements; '+grouped.size+' distinct issues');
 console.log('AUDIT FAILURES: '+JSON.stringify([...grouped.values()].sort((a,b)=>a.ratio-b.ratio).slice(0,80),null,2));
 assert.equal(issues.length,0,'Site-wide Tactical Command text contrast: all sampled visible text must meet 4.5:1');
 console.log('Tactical Command site-wide contrast across import, archive, overview, roster, four unit tabs and magic: PASS');
}finally{await browser.close();}

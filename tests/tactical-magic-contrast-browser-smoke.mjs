import assert from 'node:assert/strict';
import {chromium} from 'playwright';

/** Browser-computed WCAG relative luminance: catches regressions caused by the
 * previous light stylesheet overriding the Tactical Command dark theme. */
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 const bsb=page.locator('#gameCharacters .game-character-card').filter({hasText:'202 pts'}).first();
 const panel=bsb.locator('.owc-owner-items');
 await panel.waitFor({state:'attached'});
 await panel.locator(':scope > summary').click();
 await panel.locator('.game-effect-card').first().waitFor({state:'visible'});
 assert.ok(await panel.locator('.game-effect-card').count()>=1,
  'Source-reviewed magic items remain accessible on their owning model');
 await panel.locator('.game-effect-card').first().locator('summary').click();

 const checked=await panel.evaluate(root=>{
  const rgb=value=>{
   const parts=(value||'').match(/[\d.]+/g)?.map(Number)||[];
   return parts.length>=3?parts.slice(0,3):null;
  };
  const luminance=color=>{
   const components=rgb(color);
   if(!components)return null;
   const [r,g,b]=components.map(v=>{
    const x=v/255;
    return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
   });
   return 0.2126*r+0.7152*g+0.0722*b;
  };
  const ratio=(text,bg)=>{
   const a=luminance(text),b=luminance(bg);
   if(a===null||b===null)return 0;
   return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  };
  const read=(label,textElement,surface)=>{
   const foreground=getComputedStyle(textElement).color;
   const background=getComputedStyle(surface).backgroundColor;
   return {label,foreground,background,contrast:ratio(foreground,background)};
  };
  const results=[];
  const headingCount=root.querySelector(':scope > summary');
  results.push(read('Owner item heading',headingCount,root));
  for(const card of root.querySelectorAll('.game-effect-card')){
   const name=card.querySelector('.game-effect-title strong')?.textContent||'Unnamed item';
   results.push(read(name+' title',card.querySelector('.game-effect-title strong'),card));
   results.push(read(name+' item type',card.querySelector('.game-effect-kind'),card));
   const badge=card.querySelector('.game-effect-badge');
   results.push(read(name+' '+badge.textContent, badge,card));
   if(card.open){
    for(const selector of ['.game-effect-description','.game-effect-scope',
      '.game-effect-source','.game-effect-action']){
     const part=card.querySelector(selector);
     if(part)results.push(read(name+' expanded '+selector,part,
      selector==='.game-effect-action'?part:card));
    }
   }
  }
  return results;
 });
 for(const item of checked){
  assert.ok(item.contrast>=4.5,
   item.label+' must have >=4.5:1 contrast, got '+item.contrast.toFixed(2)+
   ': '+item.foreground+' on '+item.background);
 }
 for(const v of [{width:320,height:740},{width:390,height:844},{width:956,height:440}]){
  await page.setViewportSize(v);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
   'No page-wide overflow at '+v.width+'px');
 }
 assert.deepEqual(errors,[]);
 console.log('Tactical magic item names, type labels, badges, expanded details and actions meet 4.5:1 contrast: PASS');
}finally{
 await browser.close();
}

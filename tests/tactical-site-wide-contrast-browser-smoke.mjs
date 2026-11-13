import assert from 'node:assert/strict';
import {chromium} from 'playwright';

/** Contrast audit of every visible primary workflow rather than only Magic cards.
 * Sample real rendered text/background pairs after stylesheet cascade, including
 * composite DOM parts (roster rows, source records, save controls and spell panels).
 * WCAG AA: normal text contrast must be at least 4.5:1.
 */
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 const page=await context.newPage(),errors=[],reports=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 async function audit(name,scope='body'){
  const report=await page.locator(scope).evaluate(root=>{
   const colour=input=>{
    const m=String(input||'').match(/rgba?\(([^)]+)\)/i);
    if(!m)return null;
    const parts=m[1].replace(/\//g,',').split(/[\s,]+/).filter(Boolean).map(Number);
    return parts.length>=3?[parts[0],parts[1],parts[2],parts[3]??1]:null;
   };
   const blend=(front,back)=>{
    const a=front[3];
    return [front[0]*a+back[0]*(1-a),front[1]*a+back[1]*(1-a),front[2]*a+back[2]*(1-a),1];
   };
   const background=element=>{
    const stack=[];
    for(let el=element;el;el=el.parentElement)stack.push(el);
    let colourValue=[9,19,33,1];
    for(const el of stack.reverse()){
     const c=colour(getComputedStyle(el).backgroundColor);
     if(c&&c[3]>0)colourValue=blend(c,colourValue);
    }
    return colourValue;
   };
   const lum=rgb=>{
    const [r,g,b]=rgb.map(v=>{
     const x=v/255;
     return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
    });
    return .2126*r+.7152*g+.0722*b;
   };
   const ratio=(fg,bg)=>{
    const a=lum(fg),b=lum(bg);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   };
   const visible=el=>{
    if(!el.isConnected||el.closest('[hidden],[aria-hidden="true"]'))return false;
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0;
   };
   const nodes=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   const failures=[],samples=[];let checked=0;
   while(nodes.nextNode()){
    const node=nodes.currentNode;
    const label=(node.nodeValue||'').replace(/\s+/g,' ').trim();
    const el=node.parentElement;
    if(!el||!label||!/[A-Za-z0-9]/.test(label)||label.length<2||
       /^(STYLE|SCRIPT|NOSCRIPT|OPTION)$/.test(el.tagName)||!visible(el))continue;
    const computed=getComputedStyle(el);
    if(parseFloat(computed.fontSize)<10||computed.color==='transparent')continue;
    // Skip text intentionally removed from visual layout (icon-only open buttons).
    if(parseFloat(computed.fontSize)===0)continue;
    const f=colour(computed.color);
    if(!f)continue;
    const bg=background(el);
    const actual=blend(f,bg);
    const value=ratio(actual,bg);
    const sample={text:label.slice(0,55),selector:el.tagName.toLowerCase()+
      (el.className&&typeof el.className==='string'?'.'+el.className.trim().replace(/\s+/g,'.'):''),
      contrast:Math.round(value*100)/100,fg:computed.color,bg:bg.map(x=>Math.round(x)).slice(0,3).join(',')};
    checked++;
    if(value<4.5)failures.push(sample);
    if(samples.length<4)samples.push(sample);
   }
   return {checked,failures:failures.slice(0,90),failureCount:failures.length,samples};
  });
  reports.push({screen:name,...report});
  console.log('CONTRAST '+name+' '+report.failureCount+'/'+report.checked+' below 4.5:1 '+JSON.stringify(report.failures.slice(0,23)));
 }
 await audit('home/import');
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#saveBtn').click();
 await page.waitForFunction(()=>document.querySelectorAll('#savedList .row-item').length>0);
 await audit('import result + saved armies');
 await page.locator('#viewRosterBtn').click();
 await page.locator('#gameUnitsPanel').waitFor({state:'visible'});
 await audit('army roster');
 const sea=page.locator('#gameRegiments .army-unit-card').filter({has:page.locator('h3:text-is("Lothern Sea Guard")')}).first();
 await sea.locator('.game-unit-focus-open').click();
 assert.equal(await page.locator('#gameUnitFocusTabs').count(),0);
 await audit('unit full expanded card');
 const defence=sea.locator('details.game-defence-details').first();
 if(await defence.count()){
  await defence.locator(':scope > summary').click();
  await audit('unit expanded defence sources');
 }
 assert.equal(await sea.locator('.game-unit-expandable').isVisible(),true,
  'The full unit remains inline when changing navigation tabs');
 await page.locator('#gameNavMagic').click();
 await audit('magic');
 await page.locator('#gameItemAbilities .game-effect-card').first().locator('summary').click();
 await audit('magic expanded item');
 const spellbook=page.locator('#gameKnownSpellbookDrawer');
 if(await spellbook.count()){
  await spellbook.locator(':scope > summary').click();
  const firstBook=spellbook.locator('details.game-wizard-spellbook').first();
  if(await firstBook.count())await firstBook.locator(':scope > summary').click();
  await audit('magic expanded wizard spellbook');
 }
 await page.locator('#gameNavOverview').click();
 await audit('overview');
 const overviewDrawer=page.locator('details.game-overview-item-drawer').first();
 if(await overviewDrawer.count()){
  await overviewDrawer.locator(':scope > summary').click();
  await audit('overview expanded equipment');
 }
 for(const width of [320,390,956]){
  await page.setViewportSize({width,height:width===956?440:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
   'No global overflow at '+width+'px');
 }
 assert.deepEqual(errors,[]);
 const failed=reports.filter(r=>r.failureCount);
 assert.equal(failed.length,0,'Across-screen text contrast failures: '+
  failed.map(x=>x.screen+': '+x.failureCount+' — '+JSON.stringify(x.failures.slice(0,5))).join('; '));
 console.log('Tactical V2 whole-site 4.5:1 text contrast: PASS');
}finally{await browser.close();}

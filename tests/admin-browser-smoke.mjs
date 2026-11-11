import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ADMIN_HTML,ADMIN_SCRIPT} from '../worker/admin-page.mjs';

const ORIGIN='https://old-world-unmatched-reports.oldworldcompanion.workers.dev';
const file='report-20261111T131552339Z-edefe906-ec56-4c92-8f77-0205df47e648.txt';
const report={
 filename:file,reportId:'edefe906-ec56-4c92-8f77-0205df47e648',
 submitted:'2026-11-11T13:15:52Z',format:'old-world-builder / regular-text',
 faction:'Wood Elf Realms',entries:[
 {key:file+'#1',ordinal:1,type:'unit',name:'Orion',unit:'Orion',kind:'unknown',
  sourceLine:8,sourceUrl:null,review:{status:'new',note:'',fixUrl:''}},
 {key:file+'#2',ordinal:2,type:'selection',name:'<img src=x onerror=alert(1)>',
  unit:'Wood Elf Beast Pack',kind:'option',sourceLine:64,
  sourceUrl:'https://tow.whfb.app/unit/wood-elf-beast-pack',
  review:{status:'new',note:'',fixUrl:''}}
 ]
};
const data={reports:[report],totalReports:1,totalItems:2,truncated:false,
 counts:{new:2,investigating:0,'needs-info':0,fixed:0,'not-an-issue':0}};
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[],posts=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(ORIGIN+'/admin',route=>route.fulfill({
  status:200,contentType:'text/html',body:ADMIN_HTML,
  headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}
 }));
 await page.route(ORIGIN+'/admin/client.js',route=>route.fulfill({
  contentType:'text/javascript',body:ADMIN_SCRIPT
 }));
 await page.route(ORIGIN+'/admin/api/reports',route=>route.fulfill({
  contentType:'application/json',body:JSON.stringify(data)
 }));
 await page.route(ORIGIN+'/admin/api/review',async route=>{
  const body=route.request().postDataJSON();posts.push(body);
  const entry=report.entries.find(x=>x.ordinal===body.ordinal);
  entry.review={status:body.status,note:body.note,fixUrl:body.fixUrl};
  data.counts.new=report.entries.filter(x=>x.review.status==='new').length;
  data.counts.investigating=report.entries.filter(x=>x.review.status==='investigating').length;
  await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})});
 });
 await page.goto(ORIGIN+'/admin',{waitUntil:'domcontentloaded'});
 await page.locator('#reportQueue .report-entry').first().waitFor({state:'attached'});
 assert.match(await page.locator('#reportCounts').innerText(),/Reports/);
 assert.equal(await page.locator('img').count(),0,'Untrusted report data must not become HTML');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.locator('#reportSearch').fill('Orion');
 assert.equal(await page.locator('#reportQueue .report-entry').count(),1);
 const item=page.locator('#reportQueue .report-entry').first();
 assert.match(await item.innerText(),/Orion/);
 await item.locator('select').selectOption('investigating');
 await item.locator('input[type="text"]').fill('Checking the unit page');
 await item.locator('button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#reportCounts')?.textContent?.includes('Investigating'));
 assert.equal(posts.length,1);
 assert.equal(posts[0].filename,file);
 assert.equal(posts[0].ordinal,1);
 assert.equal(posts[0].status,'investigating');
 assert.equal(posts[0].note,'Checking the unit page');
 await page.locator('#statusFilter').selectOption('investigating');
 assert.equal(await page.locator('#reportQueue .report-entry').count(),1);
 await page.locator('#reportSearch').fill('<img');
 await page.locator('#statusFilter').selectOption('all');
 assert.equal(await page.locator('#reportQueue .report-entry').count(),1);
 assert.equal(await page.locator('img').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Admin 390px report search, status update and untrusted-text safety: PASS');
}finally{await browser.close();}

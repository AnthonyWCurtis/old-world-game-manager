import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#examples').selectOption('single-sea-guard');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('details.unit-data-details').first().waitFor({timeout:25000});
 await page.waitForFunction(()=>document.querySelector('#unitDataStatus')?.textContent.includes('Unit profiles available for 1/1'),{timeout:25000});
 const before=await page.locator('.roster-cost').first().innerText();
 assert.match(before,/387/);
 const panel=page.locator('details.unit-data-details').first();
 await panel.locator('summary').click();
 assert.match(await panel.innerText(),/Model characteristics/);
 assert.match(await panel.innerText(),/Source cost: 10 points per model/);
 assert.match(await panel.innerText(),/Naval Discipline/);
 assert.match(await panel.innerText(),/Optional rules \(not automatically active\)/);
 assert.match(await panel.innerText(),/0-1 unit per 1,000 points may:/);
 assert.match(await panel.innerText(),/up to a total of 25 points/);
 assert.equal(await panel.locator('table.unit-data-stats tbody tr').count(),2);
 assert.equal(await page.locator('.roster-cost').first().innerText(),before);
 // Simulate revisiting the same unit with the source network unavailable.
 await page.route('https://tow.whfb.app/**',r=>r.abort());
 await page.locator('#sourceRefreshBtn').click();
 await page.waitForTimeout(700);
 assert.equal(await panel.locator('table.unit-data-stats tbody tr').count(),2);
 // Descriptive mount-state entries remain in the roster but are not source matches.
 await page.locator('#examples').selectOption('owb-regular');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#units .tag.info').first().waitFor({timeout:10000});
 assert.equal(await page.locator('#units .tag.info').count(),5);
 const descriptive=await page.locator('#units .selection:has(> .tag.info)').evaluateAll(
   nodes=>nodes.map(n=>({text:n.querySelector('.selection-name')?.textContent||'',
    links:n.querySelectorAll('a').length})));
 assert.equal(descriptive.length,5);
 assert.ok(descriptive.every(x=>x.text==='On foot'&&x.links===0));
 const metrics=await page.locator('#metrics').innerText();
 assert.match(metrics,/Informational entries/);
 assert.match(await page.locator('#armyMeta').innerText(),/2,599/);
 await page.locator('#copyUnmatchedBtn').click();
 const debug=await page.locator('#unmatchedDebugFallback').inputValue();
 assert.ok(!debug.includes('SELECTION: On foot'));
 // Page content fits a phone; only the characteristics table can scroll inside.
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=3,'Unexpected horizontal page overflow: '+overflow);
 assert.deepEqual(errors,[],'Browser page errors: '+errors.join('; '));
 console.log('Mobile browser passed: Sea Guard profiles and 5 On foot informational labels, no fake source links or global overflow.');
}finally{await browser.close();}

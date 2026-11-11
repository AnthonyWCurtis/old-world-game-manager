import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {showUnitsAndExpand} from './touch-layout-test-helpers.mjs';

// Synthetic reproduction of the three-line option fragments from actual
// anonymous report edefe906-ec56-4c92-8f77-0205df47e648.
// No player's full army list was submitted or reconstructed.
const sample=`===
Woodland March [500 pts]
Warhammer: The Old World, Wood Elf Realms, Battle March
===
++ Characters [405 pts] ++
Orion [405 pts]
- Spear of Kurnous
++ Rare Units [95 pts] ++
Wood Elf Beast Pack [95 pts]
- 2x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
- 2x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
- 1x Deepwood Hound [Hand weapons (Claws + fangs
- tusks
- teeth)]
Created with "Old World Builder"`;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://tow.whfb.app/**',route=>route.abort());
 await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
 await page.locator('#sourceText').fill(sample);
 await page.locator('#parseBtn').click();
 await page.locator('#result').waitFor({state:'visible'});
 assert.equal(await page.locator('#units details.unit').count(),2);
 await page.waitForFunction(()=>document.querySelector('#unitDataStatus')?.textContent
  ?.includes('2/2 roster entries'),null,{timeout:20000});
 const nameRows=await page.locator('#units .selection-name').allTextContents();
 assert.equal(nameRows.filter(x=>x.includes('2x Deepwood Hound')).length,2);
 assert.equal(nameRows.filter(x=>x.includes('1x Deepwood Hound')).length,1);
 assert.equal(nameRows.filter(x=>x.trim()==='tusks').length,0);
 assert.equal(nameRows.filter(x=>x.trim()==='teeth)]').length,0);
 assert.match(await page.locator('#metrics').innerText(),/0\s*Unmatched selections/);
 assert.match(await page.locator('#armyMeta').innerText(),/500/);
 const links=await page.locator('#units .selection a').evaluateAll(nodes=>nodes.map(x=>x.href));
 assert.ok(links.includes('https://tow.whfb.app/magic-item/the-spear-of-kurnous'));
 assert.ok(links.filter(x=>x==='https://tow.whfb.app/unit/deepwood-hound').length>=3);
 await page.locator('#viewRosterBtn').click();
 await showUnitsAndExpand(page);
 assert.match(await page.locator('#armyRosterList').innerText(),/Orion/);
 assert.match(await page.locator('#armyRosterList').innerText(),/Wood Elf Beast Pack/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);
 console.log('Wood Elf reports: Orion, Spear and 3 composite Beast choices, 390px mobile: PASS');
}finally{await browser.close();}

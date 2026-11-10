import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 await page.locator('#units .tag.info').first().waitFor({state:'attached',timeout:10000});
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
 // Wood Elf source matching: 3 genuine parent-backed matches and two unresolved
 // references from the user's reported list, without changing 748 points.
 const woodElfBase=readFileSync(new URL('../docs/examples/wood-elves.txt',import.meta.url),'utf8');
 const woodElfReport=woodElfBase
   .replace('- A Resplendence of Luminescents',
     '- The Briar-bow\n- A Resplendence of Luminescents')
   .replace('- Swiftshiver Shards',
     "- Swiftshiver Shards\n- The Kinbands of Modryn\n- Lord's Bowmen")
   .replace('8 Wardancers [128 pts]\n- Hand weapon',
     '8 Wardancers [128 pts]\n- Hand weapon\n- 9x Additional hand weapon');
 await page.locator('#sourceText').fill(woodElfReport);
 await page.locator('#parseBtn').click();
 await page.waitForFunction(()=>document.querySelector('#unitDataStatus')?.textContent.includes('Unit profiles available for 5/5'),null,{timeout:30000});
 assert.match(await page.locator('#armyMeta').innerText(),/748/);
 await page.locator('#copyUnmatchedBtn').click();
 const woodElfDebug=await page.locator('#unmatchedDebugFallback').inputValue();
 for(const unresolved of ['The Briar-bow','The Kinbands of Modryn']){
  assert.ok(woodElfDebug.includes('SELECTION: '+unresolved),'Unverified entry must remain unmatched: '+unresolved);
 }
 for(const resolved of ['Level 1 Wizard',"Lord's Bowmen",'9x Additional hand weapon']){
  assert.ok(!woodElfDebug.includes('SELECTION: '+resolved),'Source-backed entry still unmatched: '+resolved);
 }
 // Winter Muster (5 units / 750 points): both nested Mage wizard references
 // must become source-linked after the versioned parent-unit JSON finishes loading.
 const winterMuster=[
  '===','Winter Muster [750 pts]',
  'Warhammer: The Old World, High Elf Realms, Combined Arms','===','',
  '++ Characters [200 pts] ++','',
  'Handmaiden of the Everqueen [90 pts]','- Hand weapon','- General','',
  'Mage [110 pts]','- Hand weapon','- Wizard [Level 2 Wizard]',
  '- On foot','- High Magic','',
  '++ Core Units [435 pts] ++','',
  '16 Sisters of Avelorn [247 pts]','- Hand weapon','- Bow of Avelorn','',
  '16 Lothern Sea Guard [188 pts]','- Hand weapons','- Shields','',
  '++ Special Units [115 pts] ++','',
  'Lothern Skycutters [115 pts]','- Hand weapons','',
  'Created with "Old World Builder"',''
 ].join('\n');
 await page.locator('#sourceText').fill(winterMuster);
 await page.locator('#parseBtn').click();
 await page.waitForFunction(()=>{
   const selections=[...document.querySelectorAll('#units .selection')];
   return ['Wizard [Level 2 Wizard]','Level 2 Wizard'].every(label=>{
    const entry=selections.find(n=>n.querySelector('.selection-name')?.textContent===label);
    return entry?.querySelector('.tag')?.textContent?.includes('Matched') &&
     entry.querySelector('a')?.href==='https://tow.whfb.app/unit/mage';
   });
 },null,{timeout:30000});
 assert.match(await page.locator('#armyMeta').innerText(),/750/);
 const winterSelected=await page.locator('#units .selection').evaluateAll(nodes=>nodes
  .filter(n=>['Wizard [Level 2 Wizard]','Level 2 Wizard']
    .includes(n.querySelector('.selection-name')?.textContent))
  .map(n=>({
    name:n.querySelector('.selection-name')?.textContent,
    status:n.querySelector('.tag')?.textContent,
    url:n.querySelector('a')?.href
  })));
 assert.equal(winterSelected.length,2);
 assert.ok(winterSelected.every(x=>x.url==='https://tow.whfb.app/unit/mage'));
 await page.locator('#copyUnmatchedBtn').click();
 const winterReport=await page.locator('#unmatchedDebugFallback').inputValue();
 assert.ok(!winterReport.includes('SELECTION: Wizard'));
 assert.ok(!winterReport.includes('SELECTION: Level 2 Wizard'));
 // Page content fits a phone; only the characteristics table can scroll inside.
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=3,'Unexpected horizontal page overflow: '+overflow);
 assert.deepEqual(errors,[],'Browser page errors: '+errors.join('; '));
 console.log('Mobile browser passed: Sea Guard, On foot, Wood Elf and two Mage wizard references for Winter Muster.');
}finally{await browser.close();}

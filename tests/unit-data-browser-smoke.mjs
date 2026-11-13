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
 const sampleUnmatchedButton=page.locator('#copyUnmatchedBtn');
 if(await sampleUnmatchedButton.isEnabled()){
  await sampleUnmatchedButton.click();
  const debug=await page.locator('#unmatchedDebugFallback').inputValue();
  assert.ok(!debug.includes('SELECTION: On foot'));
 }else{
  assert.match(await sampleUnmatchedButton.textContent(),/No unmatched references/);
 }
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
 const unmatchedButton=page.locator('#copyUnmatchedBtn');
 if(await unmatchedButton.isEnabled()){
  await unmatchedButton.click();
  const winterReport=await page.locator('#unmatchedDebugFallback').inputValue();
  assert.ok(!winterReport.includes('SELECTION: Wizard'));
  assert.ok(!winterReport.includes('SELECTION: Level 2 Wizard'));
 }else{
  assert.match(await unmatchedButton.textContent(),/No unmatched references/);
  assert.equal(await page.locator('#unmatchedDebugFallback').isHidden(),true);
 }
 // Synthetic six-unit 586-point Old World Builder scaffold reproduces the
 // reported Shadow Warriors entry #4 without inventing the user's full list.
 const ulthuan=[
  '===','The Warriors Of Ulthuan [586 pts]',
  'Warhammer: The Old World, High Elf Realms, Combined Arms','===','',
  '++ Characters [190 pts] ++','',
  'Noble [100 pts]','',
  'Mage [90 pts]','',
  '++ Core Units [100 pts] ++','',
  '10 Lothern Sea Guard [100 pts]','',
  '++ Special Units [196 pts] ++','',
  '6 Shadow Warriors [86 pts]','- Shadow Walker','',
  '5 Swordmasters of Hoeth [110 pts]','',
  '++ Rare Units [100 pts] ++','',
  'Eagle-Claw Bolt Thrower [100 pts]','',
  'Created with "Old World Builder"',''
 ].join('\n');
 await page.locator('#sourceText').fill(ulthuan);
 await page.locator('#parseBtn').click();
 await page.waitForFunction(()=>{
  const items=[...document.querySelectorAll('#units .selection')];
  const shadow=items.find(x=>x.querySelector('.selection-name')?.textContent==='Shadow Walker');
  return shadow?.querySelector('.tag')?.textContent?.includes('Matched') &&
   shadow?.querySelector('a')?.href==='https://tow.whfb.app/unit/shadow-warriors';
 },null,{timeout:30000});
 assert.match(await page.locator('#armyMeta').innerText(),/586/);
 const shadowMatched=await page.locator('#units .selection').evaluateAll(items=>{
  const item=items.find(x=>x.querySelector('.selection-name')?.textContent==='Shadow Walker');
  return item?{label:item.querySelector('.tag')?.textContent,link:item.querySelector('a')?.href}:null;
 });
 assert.ok(shadowMatched?.label?.includes('Matched'));
 assert.equal(shadowMatched.link,'https://tow.whfb.app/unit/shadow-warriors');
 const ulthuanButton=page.locator('#copyUnmatchedBtn');
 if(await ulthuanButton.isEnabled()){
  await ulthuanButton.click();
  const unmatched=await page.locator('#unmatchedDebugFallback').inputValue();
  assert.ok(!unmatched.includes('SELECTION: Shadow Walker'));
 }else{
  assert.match(await ulthuanButton.textContent(),/No unmatched references/);
 }
 // New Recruit points-first format with medium-confidence detection:
 // Rangers Ol Deadeye and Irondrakes Standard Runes are reference-linked
 // from the exact parent options, with 13 instances and 2,500 points intact.
 const dwarfs=readFileSync(new URL(
  '../tests/fixtures/new-recruit-dwarf-unmatched-2500.txt',import.meta.url),'utf8');
 await page.locator('#sourceText').fill(dwarfs);
 await page.locator('#parseBtn').click();
 await page.waitForFunction(()=>{
  const items=[...document.querySelectorAll('#units .selection')];
  return [
   ['Ol Deadeye','https://tow.whfb.app/unit/rangers'],
   ['Standard Runes','https://tow.whfb.app/magic-items/standard-runes']
  ].every(([name,url])=>{
   const entry=items.find(n=>n.querySelector('.selection-name')?.textContent===name);
   return entry?.querySelector('.tag')?.textContent?.includes('Matched') &&
    entry.querySelector('a')?.href===url;
  });
 },null,{timeout:30000});
 assert.match(await page.locator('#armyMeta').innerText(),/2,500/);
 const refs=await page.locator('#units .selection').evaluateAll(nodes=>
  nodes.filter(n=>['Ol Deadeye','Standard Runes'].includes(n.querySelector('.selection-name')?.textContent))
   .map(n=>({name:n.querySelector('.selection-name')?.textContent,
    status:n.querySelector('.tag')?.textContent,url:n.querySelector('a')?.href})));
 assert.equal(refs.length,2);
 assert.ok(refs.every(r=>r.status.includes('Matched')));
 assert.deepEqual(refs.map(r=>r.url),[
  'https://tow.whfb.app/unit/rangers',
  'https://tow.whfb.app/magic-items/standard-runes'
 ]);
 const dwarfUnmatchedBtn=page.locator('#copyUnmatchedBtn');
 if(await dwarfUnmatchedBtn.isEnabled()){
  await dwarfUnmatchedBtn.click();
  const report=await page.locator('#unmatchedDebugFallback').inputValue();
  assert.ok(!report.includes('SELECTION: Ol Deadeye'));
  assert.ok(!report.includes('SELECTION: Standard Runes'));
 }else{
  assert.match(await dwarfUnmatchedBtn.textContent(),/No unmatched references/);
 }
 // v0.5.0: use the prominent post-import action to open the dedicated
 // full-screen army roster without losing the imported data or any source stats.
 await page.locator('#examples').selectOption('single-sea-guard');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.waitForFunction(()=>
  document.querySelector('#unitDataStatus')?.textContent.includes('Unit profiles available for 1/1'),
  null,{timeout:30000});
 const importedText=await page.locator('#sourceText').inputValue();
 const launchHeight=await page.locator('#viewRosterBtn').evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(launchHeight>=44,'Army roster launch button is too small to tap: '+launchHeight);
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:10000});
 assert.equal(await page.locator('#importPage').isHidden(),true);
 assert.match(page.url(),/#army-roster$/);
 assert.equal(await page.locator('#armyRosterHeading').innerText(),'Test');
 assert.match(await page.locator('#armyRosterList .army-unit-card').first().innerText(),/Lothern Sea Guard/);
 await page.locator('#tacticalArmyAudit > summary').click();
 const armyMetrics=await page.locator('#armyRosterSummary').innerText();
 assert.match(armyMetrics,/387 pts/);
 assert.match(armyMetrics,/1\s*Unit entries/);
 assert.match(armyMetrics,/33\s*Models with known counts/);
 assert.equal(await page.locator('#armyRosterList .army-unit-card').count(),1);
 assert.match(await page.locator('.army-unit-card .army-unit-head').innerText(),/33\/33/);
 assert.match(await page.locator('.army-unit-card .army-unit-head').innerText(),/387 pts/);
 assert.equal(await page.locator('.army-profile-table thead th').allTextContents().then(x=>x.join(' ')),
  'Model M WS BS S T W I A Ld');
 assert.equal(await page.locator('.army-profile-table tbody tr').count(),2);
 assert.match(await page.locator('.army-profile-table tbody tr').first().innerText(),/Sea Guard/);
 assert.match(await page.locator('.army-profile-table tbody tr').nth(1).innerText(),/Sea Master/);
 const sourceUrl=await page.locator('.army-unit-card .army-source-link').first().getAttribute('href');
 assert.equal(sourceUrl,'https://tow.whfb.app/unit/lothern-sea-guard');
 const rosterOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(rosterOverflow<=3,'Army roster global horizontal overflow: '+rosterOverflow);
 await page.locator('#backToImporterBtn').click();
 await page.locator('#importPage').waitFor({state:'visible',timeout:10000});
 assert.equal(await page.locator('#armyRosterPage').isHidden(),true);
 assert.equal(await page.locator('#sourceText').inputValue(),importedText);
 assert.match(await page.locator('#armyMeta').innerText(),/387/);

 // Model-group counts from a different exporter remain visible as imported,
 // even when its source profile is not in the local shard cache yet.
 await page.locator('#examples').selectOption('nr-tow-model-groups');
 await page.locator('#exampleBtn').click();
 await page.locator('#parseBtn').click();
 await page.locator('#viewRosterBtn').click();
 await page.locator('#armyRosterPage').waitFor({state:'visible',timeout:10000});
 await page.locator('#gameRosterSearch').fill('Primal Warherds');
 const special=page.locator('#armyRosterList .army-unit-card').filter({hasText:'Primal Warherds'}).first();
 await special.locator('.game-unit-focus-open').click();
 assert.equal(await special.evaluate(card=>card.classList.contains('owc-view-full')),true,
  'Full view keeps imported model-group details readable');
 assert.match(await special.innerText(),/21\/21/);
 assert.match(await special.innerText(),/11× Gor/);
 assert.match(await special.innerText(),/10× Ungor/);
 await page.locator('#backToImporterBtn').click();
 await page.locator('#importPage').waitFor({state:'visible',timeout:10000});
 // Page content fits a phone; only the characteristics table can scroll inside.
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=3,'Unexpected horizontal page overflow: '+overflow);
 assert.deepEqual(errors,[],'Browser page errors: '+errors.join('; '));
 console.log('Mobile browser passed: previous reference checks plus full roster navigation, profile stats, counts, points, back buttons and model groups.');
}finally{await browser.close();}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isGameManagerPageText, extractArmyFromPage} from '../docs/import-guard.js';

const raw=readFileSync(new URL('../docs/examples/nr-tow-footer.txt',import.meta.url),'utf8');
const normalizedLines=text=>text.replace(/\r\n/g,'\n');
const appHead='Warhammer: The Old World\nGame Manager · Browser Edition v0.2.3\nImport army list\n';
const page=exportText=>appHead+
  'Paste exported list\n'+exportText+'\nTry a supplied test list\nLoad example\nAnalyse import\n'+
  'Army roster\n9\nUnit instances\nReadable army list\n';

test('Normal New Recruit export is not falsely rejected as app page',()=>{
 assert.equal(isGameManagerPageText(raw),false);
 assert.equal(extractArmyFromPage(raw),null);
});
test('A whole-page copy is detected even if it contains a genuine New Recruit footer',()=>{
 const paste=page(raw);
 assert.equal(isGameManagerPageText(paste),true);
 const extracted=extractArmyFromPage(paste);
 assert.ok(extracted,'One intact export must be recoverable');
 assert.equal(normalizedLines(extracted.text),normalizedLines(raw.trim()));
 assert.equal(extracted.unitCount,9);
 assert.equal(extracted.derivedPoints,1979);
 assert.equal(extracted.format.exporter,'new-recruit');
 assert.equal(extracted.format.layout,'tow');
});
test('Nested old Game Manager page recovers original export, not the page itself',()=>{
 const nested=appHead+'Paste exported list\n'+page(raw);
 assert.equal(isGameManagerPageText(nested),true);
 const extracted=extractArmyFromPage(nested);
 assert.ok(extracted);
 assert.equal(normalizedLines(extracted.text),normalizedLines(raw.trim()));
 assert.equal(extracted.unitCount,9);
 assert.equal(extracted.derivedPoints,1979);
});
test('Unrelated interface text and multiple different army exports cannot be silently recovered',()=>{
 assert.equal(extractArmyFromPage(appHead+'Paste exported list\nHello\nTry a supplied test list\nAnalyse import\n'),null);
 const twoDifferent=appHead+'Paste exported list\n'+raw+
  '\nTry a supplied test list\nPaste exported list\n'+
  raw.replace('480 - Archmage','481 - Archmage')+
  '\nTry a supplied test list\nAnalyse import\n';
 assert.equal(isGameManagerPageText(twoDifferent),true);
 assert.equal(extractArmyFromPage(twoDifferent),null);
});
test('UI red warning and explicit extraction action are wired into the import path',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 assert.ok(html.includes('id="pasteRecovery"'));
 assert.ok(html.includes('id="extractListBtn"'));
 assert.ok(app.includes("isGameManagerPageText(text)"));
 assert.ok(app.includes("isGameManagerPageText(input)"));
 assert.ok(app.includes("extractArmyFromPage($('sourceText').value)"));
 assert.ok(app.includes("title.textContent='✕ Game Manager page pasted"));
});

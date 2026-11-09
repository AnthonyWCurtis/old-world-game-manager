import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectFormat} from '../docs/parser.js';

const read=id=>readFileSync(new URL('../docs/examples/'+id+'.txt',import.meta.url),'utf8');
test('Each supported exporter exposes its detected name and layout',()=>{
  for(const [fixture,exporter,layout] of [
    ['owb-regular','old-world-builder','regular-text'],
    ['ingude-markdown','ingude','markdown'],
    ['nr-tow-footer','new-recruit','tow'],
    ['bb-compact','battle-builder','compact']
  ]){
    const f=detectFormat(read(fixture));
    assert.equal(f.exporter,exporter,fixture);
    assert.equal(f.layout,layout,fixture);
    assert.equal(f.confidence,'high',fixture);
  }
});
test('Unknown text stays unrecognised; inferred points-first builder is not claimed as confirmed',()=>{
  const bad=detectFormat('This is not a roster, no headings or supported format');
  assert.equal(bad.exporter,'unknown');
  assert.equal(bad.layout,'unknown');
  const inferred=detectFormat(read('nr-tow-wrapped'));
  assert.equal(inferred.exporter,'new-recruit');
  assert.equal(inferred.layout,'tow');
  assert.equal(inferred.confidence,'medium');
  assert.equal(inferred.evidence.includes('exporter attribution'),false);
});
test('Live status and hidden manual override have required controls and listeners',()=>{
 const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../docs/styles.css',import.meta.url),'utf8');
 for(const id of ['sourceText','formatDetection','detectedFormat','formatDetails','format']){
    assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('<details class="manual-format">'));
 assert.ok(js.includes("addEventListener('input',updateFormatDetection)"));
 assert.ok(js.includes("addEventListener('change',updateFormatDetection)"));
 assert.ok(js.includes("Format not recognised"));
 assert.ok(js.includes("friendlyExporters"));
 assert.ok(css.includes('[data-state="detected"] strong'));
 assert.ok(css.includes('[data-state="unrecognised"] strong'));
});

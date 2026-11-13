import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCoverage,renderCoverageMarkdown} from '../scripts/render-sitemap-audit.mjs';
const source='https://tow.whfb.app/unit/test-mage';
const fixture=()=>({status:'pass-with-warnings',
 counts:{sitemapUnits:2,unitWarnings:2,indexedReferences:12},
 collections:{armies:{entries:3,sourceSnapshotCheckedAt:'2026-11-09'},magic:{entries:9,status:'source-indexed-only'}},
 errors:[],scope:'Stored index only',warnings:[
  {code:'EXTRACTION_WARNINGS',id:'a',name:'Test Mage',sourceUrl:source,
   detail:JSON.stringify(['Unmapped source fields present: wizardLevel, magicLore','Option rich text present but hierarchy not extracted'])},
  {code:'EXTRACTION_WARNINGS',id:'b',name:'Test Wizard',sourceUrl:'https://tow.whfb.app/unit/test-wizard',
   detail:JSON.stringify(['Unmapped source fields present: wizardLevel'])},
  {code:'NO_ARMY_MEMBERSHIP',id:'a',name:'Test Mage',sourceUrl:source,detail:'May be valid'}
 ]});
test('counts distinct affected units independently for each warning field',()=>{
 const summary=summarizeCoverage(fixture());
 assert.equal(summary.fields.find(g=>g.name==='wizardLevel').count,2);
 assert.equal(summary.fields.find(g=>g.name==='magicLore').count,1);
 assert.equal(summary.codes.find(g=>g.name==='NO_ARMY_MEMBERSHIP').count,1);
});
test('displays source links and separates extraction scope from source correctness',()=>{
 const md=renderCoverageMarkdown(fixture());
 assert.match(md,/wizardLevel — 2 unit/);
 assert.ok(md.includes('[Source]('+source+')'));
 assert.match(md,/Stored index only/);
 assert.match(md,/not confirmed rules errors/);
});
test('does not render untrusted urls or markup from warnings',()=>{
 const r=fixture();
 r.warnings[0].sourceUrl='https://evil.invalid/unit/a';
 r.warnings[0].name='<script>alert(1)</script>';
 const md=renderCoverageMarkdown(r);
 assert.match(md,/Source unavailable/);
 assert.doesNotMatch(md,/<script>/);
 assert.doesNotMatch(md,/evil\.invalid/);
});
test('invalid report is not silently treated as successful',()=>{
 assert.throws(()=>summarizeCoverage({counts:{}}),/Expected sitemap/);
});

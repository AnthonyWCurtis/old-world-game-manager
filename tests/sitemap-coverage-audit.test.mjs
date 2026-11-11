import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCoverage,runAudit} from '../scripts/audit-sitemap-coverage.mjs';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';

const army='https://tow.whfb.app/army/test-army';
const unit='https://tow.whfb.app/unit/test-unit';
const fixture=()=>{
 const sitemap={source:{url:'https://tow.whfb.app/sitemap/armies',checkedAt:'2026-11-11'},
  counts:{armies:1,units:1},
  entries:[{kind:'army',name:'Test Army',url:army},
   {kind:'unit',name:'Test Unit',url:unit}]};
 const catalogue={counts:{units:1},shards:1,source:{commit:'test-pinned-commit'},
  entries:[{id:'unit:test-unit',name:'Test Unit',sourceUrl:unit,shard:'00',hasWarnings:false}]};
 const record={id:'unit:test-unit',name:'Test Unit',
  source:{sourceUrl:unit,verificationStatus:'source-extracted'},
  modelProfiles:[{name:'Test Model'}],extractionWarnings:[],
  listedInArmies:[{armyId:'army:test-army'}]};
 const shards={'00':{schemaVersion:1,records:{'unit:test-unit':record}}};
 return {sitemap,catalogue,shards,record};
};
test('complete matching snapshot passes without inferring legality',()=>{
 const {sitemap,catalogue,shards}=fixture();
 const report=auditCoverage(sitemap,catalogue,shards);
 assert.equal(report.status,'pass-with-warnings');
 assert.equal(report.counts.errors,0);
 assert.equal(report.counts.warnings,0);
 assert.equal(report.counts.shardUnits,1);
 assert.match(report.scope,/no army legality/);
});
test('missing catalogue unit and malformed full records are visible',()=>{
 const {sitemap,catalogue,shards}=fixture();
 catalogue.entries=[];
 const report=auditCoverage(sitemap,catalogue,shards);
 assert.ok(report.errors.some(e=>e.code==='MISSING_CATALOGUE_UNIT'));
 assert.ok(report.errors.some(e=>e.code==='ORPHAN_SHARD_RECORD'));
 assert.equal(report.status,'fail');
});
test('source discrepancies and extraction limitations are separately categorised',()=>{
 const {sitemap,catalogue,shards,record}=fixture();
 record.source.sourceUrl='https://tow.whfb.app/unit/wrong';
 record.modelProfiles=[];
 record.extractionWarnings=['Some option missing'];
 record.listedInArmies=[];
 catalogue.entries[0].hasWarnings=true;
 const report=auditCoverage(sitemap,catalogue,shards);
 assert.ok(report.errors.some(e=>e.code==='SHARD_SOURCE_MISMATCH'));
 assert.ok(report.errors.some(e=>e.code==='NO_MODEL_PROFILES'));
 assert.ok(report.warnings.some(e=>e.code==='EXTRACTION_WARNINGS'));
 assert.ok(report.warnings.some(e=>e.code==='NO_ARMY_MEMBERSHIP'));
});
test('real repository snapshot produces a complete 581-record report',async()=>{
 const report=await runAudit({output:join(tmpdir(),'old-world-audit-test-'+process.pid+'.json')});
 assert.equal(report.counts.sitemapArmies,19);
 assert.equal(report.counts.sitemapUnits,581);
 assert.equal(report.counts.catalogueUnits,581);
 assert.equal(report.counts.shardUnits,581);
 assert.equal(report.errors.length,0,JSON.stringify(report.errors.slice(0,10)));
});

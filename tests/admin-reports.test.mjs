import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReportFile,validateReview,summarizeReports} from '../worker/admin-reports.mjs';

const filename='report-20261111T131552339Z-edefe906-ec56-4c92-8f77-0205df47e648.txt';
const sample=readFileSync(new URL('../reports/unmatched/'+filename,import.meta.url),'utf8');

test('parse real report file with 11 entries and source context, no player/full army',()=>{
 const report=parseReportFile(filename,sample);
 assert.equal(report.filename,filename);
 assert.equal(report.reportId,'edefe906-ec56-4c92-8f77-0205df47e648');
 assert.equal(report.faction,'Wood Elf Realms');
 assert.equal(report.format,'old-world-builder / regular-text');
 assert.equal(report.entries.length,11);
 assert.deepEqual(report.entries[0],{
  ordinal:1,type:'unit',name:'Orion',unit:'Orion',kind:'unknown',sourceLine:8,
  sourceUrl:null,key:filename+'#1'
 });
 assert.equal(report.entries[2].name,'2x Deepwood Hound [Hand weapons (Claws + fangs');
 assert.equal(report.entries[2].sourceUrl,'https://tow.whfb.app/unit/wood-elf-beast-pack');
 assert.equal(JSON.stringify(report).includes('IP address'),false);
});

test('reject path traversal, malformed names, XSS-friendly URLs and invalid report files',()=>{
 for(const name of ['../../../etc/passwd','ALL_UNMATCHED.txt','report-a.txt',
  'report-20261111T131552339Z-edefe906-ec56-4c92-8f77-0205df47e648.txt/anything'])
  assert.throws(()=>parseReportFile(name,sample),/file/i);
 const tampered=sample.replace('https://tow.whfb.app/unit/wood-elf-beast-pack','javascript:alert(1)');
 const report=parseReportFile(filename,tampered);
 assert.equal(report.entries[2].sourceUrl,null);
 const modified=sample.replace('SELECTION: Spear of Kurnous','SELECTION: <img src=x onerror=alert(1)>');
 assert.equal(parseReportFile(filename,modified).entries[1].name,'<img src=x onerror=alert(1)>');
});

test('triage status and comment validation reject URLs outside the allowed sources and bad status',()=>{
 const valid=validateReview({filename,ordinal:2,status:'investigating',note:'Check nested selections',fixUrl:''});
 assert.equal(valid.key,filename+'#2');
 assert.equal(valid.status,'investigating');
 assert.throws(()=>validateReview({...valid,status:'admin'}),/status/i);
 assert.throws(()=>validateReview({...valid,ordinal:0}),/ordinal|entry/i);
 assert.throws(()=>validateReview({...valid,note:'a'.repeat(1000)}),/note/i);
 assert.throws(()=>validateReview({...valid,fixUrl:'javascript:alert(1)'}),/link|URL/i);
 assert.throws(()=>validateReview({...valid,status:'fixed'}),/fix|evidence/i);
 const fixed=validateReview({filename,ordinal:2,status:'fixed',note:'Resolved in parser',
  fixUrl:'https://github.com/AnthonyWCurtis/old-world-game-manager/pull/25'});
 assert.equal(fixed.status,'fixed');
 assert.equal(fixed.fixUrl,'https://github.com/AnthonyWCurtis/old-world-game-manager/pull/25');
});

test('summarize reports tracks per-entry review status without modifying report content',()=>{
 const first=parseReportFile(filename,sample);
 const review={schemaVersion:1,entries:{
  [filename+'#1']:{status:'investigating',note:'Catalog missing',fixUrl:''},
  [filename+'#2']:{status:'fixed',note:'Parser fix',fixUrl:'https://github.com/AnthonyWCurtis/old-world-game-manager/pull/25'}
 }};
 const before=JSON.stringify(first);
 const result=summarizeReports([first],review);
 assert.equal(result.reports.length,1);
 assert.equal(result.totalItems,11);
 assert.equal(result.counts.investigating,1);
 assert.equal(result.counts.fixed,1);
 assert.equal(result.counts.new,9);
 assert.equal(result.reports[0].entries[0].review.status,'investigating');
 assert.equal(JSON.stringify(first),before);
});

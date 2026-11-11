import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const refresh=readFileSync(new URL('../scripts/refresh-source-profiles.mjs',import.meta.url),'utf8');

test('every audit-flagged wizard can enter the bounded source refresh queue',()=>{
 assert.match(refresh,/wizardLevel\|magicLore/);
 assert.match(refresh,/wizardReview:true/);
 assert.match(refresh,/MAX_PER_RUN=35/);
});
test('a model-only refresh is not reported as verified wizard extraction',()=>{
 assert.match(refresh,/wizardExtractionStatus:job\.wizardReview/);
 assert.match(refresh,/wizardUnresolved\+\+/);
 assert.match(refresh,/wizardChecked>0 && wizardExtracted===0/);
 assert.match(refresh,/No wizard facts could be extracted/);
});
test('failed or unresolved wizard parsing cannot invent magic data',()=>{
 assert.match(refresh,/\.\.\.\(wizardMagic\?\{wizardMagic\}: \{\}\)/);
 assert.match(refresh,/extractWizardMagic\(html,job\.url,magicIndex\)/);
});

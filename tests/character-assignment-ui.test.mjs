import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../docs/'+p,import.meta.url),'utf8');

test('game screen supports assignment controls in both directions and nested detail expansion',()=>{
 const page=src('army-roster-page.js');
 assert.match(page,/renderArmyRosterPage\(container,army,records=\{\},fallbackProfiles=\{\},session/);
 assert.match(page,/character-unit-picker/);
 assert.match(page,/regiment-character-picker/);
 assert.match(page,/game-attached-character/);
 assert.match(page,/game-character-remove/);
 assert.match(page,/onAssignment\(/);
 assert.match(page,/game-membership-label/);
 assert.doesNotMatch(page,/innerHTML/);
});

test('game screen explains unverified joining without inventing combat bonuses',()=>{
 const html=src('index.html');
 assert.match(html,/id="battleSessionStatus"/);
 assert.match(html,/characters\/characters-and-units/);
 assert.match(html,/recorded.*not.*verified/i);
 assert.match(html,/special-rules\/fly/);
 assert.match(html,/special-rules\/ethereal/);
 const css=src('styles.css');
 assert.match(css,/\.game-assignment-editor/);
 assert.match(css,/\.game-attached-character/);
 assert.match(css,/\.game-character-remove/);
});

test('v1 offline cache contains new battle state modules',()=>{
 const cache=src('sw.js');
 assert.match(cache,/\.\/battle-session\.js/);
 assert.match(cache,/\.\/battle-session-store\.js/);
});

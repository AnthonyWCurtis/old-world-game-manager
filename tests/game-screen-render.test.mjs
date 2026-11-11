import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=path=>readFileSync(new URL('../docs/'+path,import.meta.url),'utf8');

test('v1 Game Screen is entered from the import result, with distinct character and regiment areas',()=>{
 const html=code('index.html');
 assert.match(html,/Enter Game Screen/);
 assert.match(html,/BATTLE COMPANION/);
 assert.match(html,/id="gameScreenJumpCharacters"/);
 assert.match(html,/id="gameScreenJumpRegiments"/);
 assert.match(html,/id="armyRosterPage"/);
 const app=code('app.js');
 assert.match(app,/gameScreenJumpCharacters/);
 assert.match(app,/gameScreenJumpRegiments/);
 assert.match(app,/renderArmyRosterPage\(\$\('armyRosterList'\),current,unitDataRecords,sourceProfiles,battleSession,handleCharacterAssignment,handleShieldUsage\)/);
});

test('read-only roster rendering takes imported source and groups known characters without guessing',()=>{
 const renderer=code('army-roster-page.js');
 assert.match(renderer,/createGameScreenModel/);
 assert.match(renderer,/game-character-group/);
 assert.match(renderer,/game-regiments-group/);
 assert.match(renderer,/textContent/);
 assert.doesNotMatch(renderer,/\bfetch\(/);
 assert.doesNotMatch(renderer,/innerHTML/);
});

test('mobile game screen has large touch targets and horizontal containment',()=>{
 const css=code('styles.css');
 assert.match(css,/\.game-screen-jump/);
 assert.match(css,/\.game-screen-jump[^}]*min-height:44px/);
 assert.match(css,/\.army-profile-scroll\{[^}]*overflow-x:auto/);
 assert.match(css,/\.game-character-group/);
});

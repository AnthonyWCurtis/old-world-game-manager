import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../docs/'+file,import.meta.url),'utf8');

test('Game Screen has spell panel and explicit player confirmation controls',()=>{
 const html=read('index.html'),controls=read('spell-controls.js');
 assert.match(html,/id="spellControlPanel"/);
 assert.match(controls,/selectedWizardSpells/);
 assert.match(controls,/game-spell-confirm/);
 assert.match(controls,/game-spell-target/);
 assert.match(controls,/game-spell-cast/);
 assert.match(controls,/game-spell-end/);
 assert.match(controls,/game-spell-expire/);
 assert.match(controls,/spell\.sourceUrl|rule\.sourceUrl/);
 assert.doesNotMatch(controls,/innerHTML/);
});

test('Spell UI distinguishes 5+ Ward from -1 incoming To Hit and warns about duration and assignment',()=>{
 const renderer=read('army-roster-page.js');
 assert.match(renderer,/game-defence-incoming/);
 assert.match(renderer,/game-defence-movement/);
 const defence=read('defence-engine.js');
 assert.match(defence,/spellEffectsFor/);
 assert.match(defence,/attackModifiers/);
 assert.match(defence,/movementRestrictions/);
 assert.match(defence,/spellWarnings/);
 const html=read('index.html');
 assert.match(html,/until.*next.*Start of Turn/i);
 assert.match(html,/player.confirm/i);
});

test('app callbacks handle activations, individual endings, and player-selected Start of Turn expiration',()=>{
 const app=read('app.js');
 assert.match(app,/renderSpellControls/);
 assert.match(app,/activateSpell/);
 assert.match(app,/endSpell/);
 assert.match(app,/expireAtNextStartOfTurn/);
 assert.match(app,/handleSpellCast/);
 assert.match(app,/handleSpellEnd/);
 assert.match(app,/handleSpellsExpire/);
 assert.match(app,/handleSpellEventClear/);
 assert.match(app,/writeBattleSession\(state\)/);
});

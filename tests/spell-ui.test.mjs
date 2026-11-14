import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../docs/'+file,import.meta.url),'utf8');

test('Wizard profiles have spell selection and explicit player confirmation controls',()=>{
 const html=read('index.html'),controls=read('spell-controls.js');
 assert.doesNotMatch(html,/id="spellControlPanel"/);
 assert.doesNotMatch(html,/id="gameWorkspaceNav"/);
 assert.match(read('army-roster-page.js'),/owc-wizard-magic/);
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
 const controls=read('spell-controls.js');
 assert.match(controls,/next Start of Turn/i);
 assert.match(controls,/confirm a successful/i);
});

test('app callbacks handle activations, individual endings, and player-selected Start of Turn expiration',()=>{
 const app=read('app.js');
 assert.match(read('army-roster-page.js'),/renderSpellControls/);
 assert.match(app,/activateSpell/);
 assert.match(app,/endSpell/);
 assert.match(app,/expireAtNextStartOfTurn/);
 assert.match(app,/handleSpellCast/);
 assert.match(app,/handleSpellEnd/);
 assert.match(app,/handleSpellsExpire/);
 assert.match(app,/handleSpellEventClear/);
 assert.match(app,/writeSourceSafeSession\(army,nextState\)/);
 assert.match(app,/if\(!await readyBattleSession\(army\)\)return;/);
});

test('Wizard compact list merges active and known spells with footer-based editing',()=>{
 const controls=read('spell-controls.js');
 const roster=read('army-roster-page.js');
 const book=read('wizard-spellbook-ui.js');
 const css=read('unit-view-modes.css');
 assert.match(controls,/renderCompactWizardSpells/);
 assert.match(controls,/if\(wizardId\)return renderCompactWizardSpells/);
 assert.match(controls,/const all=\[\.\.\.chosen\]/);
 assert.match(controls,/\.\.\.active,\.\.\.events/);
 assert.match(controls,/owc-magic-spell-note/);
 assert.match(controls,/game-spell-confirm/);
 assert.match(controls,/Record another cast/);
 assert.match(controls,/Next Start of Turn · expire all temporary spells/);
 assert.match(roster,/owc-wizard-magic-footer/);
 assert.match(book,/Edit spells \(/);
 assert.match(css,/owc-magic-spell>summary/);
 assert.match(css,/owc-wizard-magic-footer/);
});

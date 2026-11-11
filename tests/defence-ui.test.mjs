import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../docs/'+p,import.meta.url),'utf8');

test('mobile roster renders separate armour, conditional Ward and Regeneration values',()=>{
 const render=source('army-roster-page.js');
 assert.match(render,/import \{evaluateDefences\} from '\.\/defence-engine\.js'/);
 assert.match(render,/game-defence-panel/);
 assert.match(render,/game-defence-values/);
 assert.match(render,/data-save/);
 assert.match(render,/game-defence-conditional/);
 assert.match(render,/game-defence-champion/);
 assert.match(render,/game-defence-shield-used/);
 assert.match(render,/onShieldUse/);
 assert.doesNotMatch(render,/innerHTML/);
});

test('game screen describes equipment-only and conditional saves, not a full combat result',()=>{
 const html=source('index.html');
 assert.match(html,/Equipment-only armour/i);
 assert.match(html,/Magic Missiles/);
 assert.match(html,/Charmed Shield/);
 assert.match(html,/source-backed.*conditional/i);
 const css=source('styles.css');
 assert.match(css,/\.game-defence-panel/);
 assert.match(css,/\.game-defence-values/);
 assert.match(css,/\.game-defence-shield-used/);
});

test('battle state persistence tracks one-use item without changing original selections',()=>{
 const app=source('app.js');
 const store=source('battle-session-store.js');
 assert.match(app,/markCharmedShieldUsed/);
 assert.match(app,/handleShieldUsage/);
 assert.match(app,/onShieldUse/);
 assert.match(store,/usedCharmedShields/);
 const cache=source('sw.js');
 assert.match(cache,/\.\/defence-engine\.js/);
});

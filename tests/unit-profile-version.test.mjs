import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNIT_PROFILES_VERSION} from '../docs/army-roster-page.js';

const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Unit Profiles has an independent starting version of v0.2',()=>{
 assert.equal(UNIT_PROFILES_VERSION,'0.2');
 const html=source('docs/index.html');
 assert.match(html,/<section id="gameUnitsPanel"/);
 assert.match(html,/id="unitProfilesVersion">v0\.3<\/strong>/);
 assert.match(html,/What’s new\?/);
 assert.match(html,/Champion titles are resolved from each unit’s own source options/);
});
test('the visible version is wired to a single profile-display version constant',()=>{
 const app=source('docs/app.js');
 const ui=source('docs/army-roster-page.js');
 assert.match(app,/import \{renderArmyRosterPage, UNIT_PROFILES_VERSION\}/);
 assert.match(app,/version\.textContent='v'\+UNIT_PROFILES_VERSION/);
 assert.match(ui,/export const UNIT_PROFILES_VERSION='0\.3'/);
});
test('version history is available and the offline shell is revised',()=>{
 const notes=source('docs/UNIT-PROFILES-VERSIONS.md');
 const sw=source('docs/sw.js');
 assert.match(notes,/## v0\.3 — 12 November 2026/);
 assert.match(sw,/CACHE_NAME='game-manager-v1-shell-20261112-unit-profiles-v0-3'/);
 assert.match(sw,/'\.\/army-roster-page\.js'/);
 assert.match(sw,/'\.\/index\.html'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=()=>readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
const store=()=>readFileSync(new URL('../docs/battle-session-store.js',import.meta.url),'utf8');
test('version 2 preserves old saved snapshots and creates separate battle_sessions store',()=>{
 assert.match(app(),/indexedDB\.open\(DBNAME,2\)/);
 assert.match(app(),/createObjectStore\('battle_sessions'/);
 assert.match(store(),/indexedDB\.open\(DBNAME,2\)/);
 assert.match(store(),/createObjectStore\('snapshots'/);
 assert.match(store(),/createObjectStore\('battle_sessions'/);
});
test('assignments are restored for imported and previously saved rosters, never included in imported units',()=>{
 const src=app();
 assert.match(src,/readBattleSession\(armySessionKey\(army\)\)/);
 assert.match(src,/writeSourceSafeSession\(army,state/);
 assert.match(src,/await sessionReadPending/);
 assert.match(src,/if\(!await readyBattleSession\(army\)\)return;/);
 assert.match(src,/writeBattleSession\(pendingSourceSession\)/);
 assert.match(src,/renderArmyRosterPage\(\$\('armyRosterList'\),current,unitDataRecords,sourceProfiles,battleSession/);
 assert.match(src,/await restoreCurrentBattleSession\(\)/);
 assert.match(src,/battleSessionStatus/);
});

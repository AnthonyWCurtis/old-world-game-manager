import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../docs/'+p,import.meta.url),'utf8');

test('v1 registers a versioned same-origin offline app shell',()=>{
 const html=read('index.html'),app=read('app.js'),offline=read('offline.js'),sw=read('sw.js');
 assert.match(html,/\.\/app\.js\?v=1\.0\.0-alpha\.2/);
 assert.match(app,/registerOfflineSupport/);
 assert.match(offline,/navigator\.serviceWorker\.register/);
 assert.match(sw,/game-manager-v1-shell/);
 for(const file of ['index.html','app.js','parser.js','army-roster-page.js','game-screen-model.js','army-state.js','offline.js','unit-data.js','styles.css']){
  assert.ok(sw.includes("'./"+file+"'"),file+' must be available in the offline app shell');
 }
});

test('service worker only intercepts same-origin site assets and falls back on offline navigation',()=>{
 const sw=read('sw.js');
 assert.match(sw,/url\.origin!==self\.location\.origin/);
 assert.match(sw,/request\.mode==='navigate'/);
 assert.match(sw,/caches\.match/);
 assert.match(sw,/cache\.match/);
 assert.match(sw,/activate/);
 assert.doesNotMatch(sw,/tow\.whfb\.app/);
});

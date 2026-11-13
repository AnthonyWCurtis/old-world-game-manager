import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
const read=p=>readFileSync(new URL('../docs/'+p,import.meta.url),'utf8');

test('v1 registers a versioned same-origin offline app shell',()=>{
 const html=read('index.html'),app=read('app.js'),offline=read('offline.js'),sw=read('sw.js');
 assert.match(html,/\.\/app\.js\?v=1\.0\.0-alpha\.5/);
 assert.match(app,/registerOfflineSupport/);
 assert.match(offline,/navigator\.serviceWorker\.register/);
 assert.match(sw,/game-manager-v1-shell/);
 for(const file of ['index.html','app.js','parser.js','army-roster-page.js','game-screen-model.js','army-state.js','offline.js','unit-data.js','styles.css']){
  assert.ok(sw.includes("'./"+file+"'"),file+' must be available in the offline app shell');
 }
});

test('offline cache includes the transitive static JavaScript import graph',()=>{
 const directory=new URL('../docs/',import.meta.url);
 const files=readdirSync(directory).filter(name=>name.endsWith('.js')&&name!=='sw.js');
 const sw=read('sw.js');
 const shell=new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]));
 const imports=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]\.\/([^'"?]+)(?:\?[^'"]*)?['"]/g;
 for(const file of files){
  if(!shell.has(file))continue;
  const code=read(file);
  for(const match of code.matchAll(imports)){
   assert.ok(shell.has(match[1]),file+' imports '+match[1]+' which must be cached offline');
  }
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

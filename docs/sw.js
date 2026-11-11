/* Versioned offline app shell. No upstream rules pages are intercepted or mirrored. */
const CACHE_NAME='game-manager-v1-shell-20261111-mobile-layout-v1';
const CACHE_PREFIX='game-manager-v1-shell-';
const APP_SHELL=[
 './',
 './index.html',
 './styles.css',
 './mobile.css',
 './app.js',
 './parser.js',
 './import-guard.js',
 './unmatched-debug.js',
 './report-ui.js',
 './report-submission.js',
 './match-status.js',
 './live-source.js',
 './unit-data.js',
 './unit-detail-ui.js',
 './selection-information.js',
 './unit-selection-matcher.js',
 './wizard-references.js',
 './army-roster-page.js',
 './game-screen-model.js',
 './defence-engine.js',
 './spell-engine.js',
 './spell-controls.js',
 './player-customization.js',
 './wizard-spellbook-ui.js',
 './reference-records/magic-index.json',
 './army-state.js',
 './battle-session.js',
 './battle-session-store.js',
 './offline.js',
 './catalog.js',
 './examples/manifest.json'
];
const scopePath=new URL('./',self.registration.scope).pathname;
const appPaths=new Set(APP_SHELL.map(path=>new URL(path,self.registration.scope).pathname));

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
   .map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(scopePath))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){
     const cache=await caches.open(CACHE_NAME);
     await cache.put(new URL('./index.html',self.registration.scope),response.clone());
    }
    return response;
   }catch{
    const cached=await caches.match(new URL('./index.html',self.registration.scope));
    return cached||Response.error();
   }
  })());
  return;
 }
 // Cached same-origin app modules can be reused offline across query-versioned URLs.
 // Unit data shards remain under their own IndexedDB cache, not a global SW mirror.
 if(!appPaths.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
 })());
});

/* Versioned offline app shell. No upstream rules pages are intercepted or mirrored. */
const CACHE_NAME='game-manager-v1-shell-20261111-online-refresh-v1';
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
 // Code is network-first while online. The old cache-first handler could
 // render a fresh index.html with stale JS modules (and an obsolete spell UI).
 // Persist each file under its canonical, query-free URL so versioned imports
 // always receive the latest cached response when the device is offline.
 if(!appPaths.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const cacheKey=new URL(url.pathname,self.location.origin);
  const isCode=/\.(?:js|css)$/.test(url.pathname);
  if(isCode){
   try{
    const fresh=await fetch(request,{cache:'no-cache'});
    if(fresh.ok)await cache.put(cacheKey,fresh.clone());
    return fresh;
   }catch{
    return await cache.match(cacheKey)||Response.error();
   }
  }
  const cached=await cache.match(cacheKey);
  if(cached)return cached;
  const fresh=await fetch(request);
  if(fresh.ok)await cache.put(cacheKey,fresh.clone());
  return fresh;
 })());
});

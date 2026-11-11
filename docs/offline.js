/** Best-effort offline setup; a failed service worker must never block imports. */
export async function registerOfflineSupport(){
 if(typeof navigator==='undefined'||!('serviceWorker' in navigator)||
    typeof location==='undefined')return {status:'unsupported'};
 try{
  const registration=await navigator.serviceWorker.register('./sw.js',{
   scope:'./',updateViaCache:'none'
  });
  // iOS Home Screen apps may stay open a long time. Explicitly check for
  // a newer worker whenever opened online; never make startup depend on it.
  if(navigator.onLine)void registration.update().catch(()=>{});
  return {status:'registered',registration};
 }catch(error){
  return {status:'unavailable',message:String(error?.message||error)};
 }
}

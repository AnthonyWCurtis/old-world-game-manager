/**
 * Extract only the printed "Armour Value: N+" field on public unit pages.
 * This is a published unit/chassis value, not an attack-specific final save,
 * model-by-model allocation, or equipment calculation.
 */
const ORIGIN='https://tow.whfb.app';
const textOnly=html=>String(html||'')
 .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>/gi,' ')
 .replace(/<[^>]*>/g,' ')
 .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,
  (_,hex,dec)=>String.fromCodePoint(Number.parseInt(hex||dec,hex?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi,x=>({
  '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':String.fromCharCode(39)})[x.toLowerCase()]||x)
 .replace(/\s+/g,' ').trim();
export function extractPublishedArmourValue(html,sourceUrl){
 let url;
 try{url=new URL(sourceUrl);}catch{return null;}
 if(url.origin!==ORIGIN||url.search||url.hash||
    !/^\/unit\/[a-z0-9-]+$/.test(url.pathname)||typeof html!=='string')return null;
 const page=textOnly(html);
 // Only a literal labelled entry, not mentions in equipment/rules prose.
 const matches=[...page.matchAll(/\bArmour\s+Value\s*:\s*([2-7])\s*\+/gi)];
 if(matches.length!==1)return null;
 const value=Number(matches[0][1]);
 return {value,label:value+'+',appliesTo:'published unit/chassis (model scope unverified)',
  sourceUrl:url.href,verificationStatus:'source-page-extracted',
  evidence:'Explicit Armour Value field on the source unit page'};
}

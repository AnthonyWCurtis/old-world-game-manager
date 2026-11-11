/**
 * Source-only wizard facts from the public HTML unit page.
 * Conservative: no defaults inferred from unit name, faction or imported options.
 */
const SOURCE='https://tow.whfb.app';
const entity=s=>String(s||'').replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,
 (_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10)))
 .replace(/&(?:nbsp|amp|lt|gt|quot|apos|rsquo|lsquo);/gi,c=>({
 '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
 '&rsquo;':'’','&lsquo;':'‘'})[c.toLowerCase()]||c);
const textOnly=html=>entity(String(html||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
 .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const validUnitUrl=url=>{
 try{const u=new URL(url);return u.origin===SOURCE&&!u.search&&!u.hash&&/^\/unit\/[a-z0-9-]+$/.test(u.pathname);}
 catch{return false;}
};
const validLore=e=>e?.kind==='lore'&&typeof e.name==='string'&&
 /^https:\/\/tow\.whfb\.app\/the-lores-of-magic\/[a-z0-9-]+$/.test(e.url||'');
export function extractWizardMagic(html,sourceUrl,magicIndex){
 if(!validUnitUrl(sourceUrl)||typeof html!=='string'||!Array.isArray(magicIndex?.entries))
  return null;
 const page=textOnly(html);
 // Only explicit sentences in the unit's Magic section are accepted.
 const match=page.match(/\bMagic:\s*([^.!?]{1,140}?)\s+is a Level ([1-4]) Wizard who uses spells from\s+([^.!?]{1,350})\./i);
 if(!match)return null;
 const baseLevel=Number(match[2]);
 const loreText=match[3];
 const alternatives=loreText.split(/\s*,\s*|\s+or\s+|\s+and\s+/i)
  .map(s=>s.trim().replace(/^(?:or|and) +/i,'').trim()).filter(Boolean);
 if(!alternatives.length||alternatives.length>20)return null;
 const choices=[];
 for(const name of alternatives){
  const refs=magicIndex.entries.filter(e=>validLore(e)&&norm(e.name)===norm(name));
  if(refs.length!==1)return null; // unresolved names must not get guessed links
  if(!choices.some(c=>c.url===refs[0].url))choices.push({name:refs[0].name,url:refs[0].url});
 }
 const upgrades=[];
 for(const item of page.matchAll(/\bBe a Level ([1-4]) Wizard\b\s*(?:\(\s*)?\+\s*(\d+)\s*points?/gi)){
  const level=Number(item[1]),points=Number(item[2]);
  if(level<=baseLevel||!Number.isSafeInteger(points)||upgrades.some(x=>x.level===level))continue;
  upgrades.push({level,additionalPoints:points});
 }
 upgrades.sort((a,b)=>a.level-b.level);
 return {baseLevel,availableLores:choices,levelUpgrades:upgrades,
  sourceUrl,verificationStatus:'source-page-extracted',
  evidence:'Magic section; explicit wizard level, lore names and option text only'};
}

import { parseArmy, normalizeImportText } from './parser.js?v=0.1.4';
const $=id=>document.getElementById(id);
let current=null;
const make=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const missing=f=>f?.value==null?'Unknown':String(f.value);
const showError=msg=>{$('error').hidden=!msg;$('error').textContent=msg||'';};
const sourceOverride=()=>{const val=$('format').value;if(val==='auto')return null;const [exporter,layout]=val.split(':');return {exporter,layout};};
const DBNAME = 'old-world-game-manager-imports';
const STORE = 'snapshots';
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('Browser local storage unavailable. You can still analyse and export JSON.'));
  const req=indexedDB.open(DBNAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Could not open browser storage'));
 });
}
async function dbOperation(mode,action){
 const db=await openDB();
 try {return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  const req=action(store);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Browser storage error'));
  tx.onerror=()=>reject(tx.error||Error('Browser storage transaction failed'));
 });}finally {db.close();}
}
const readAll=()=>dbOperation('readonly',store=>store.getAll());
const readOne=id=>dbOperation('readonly',store=>store.get(id));
const removeOne=id=>dbOperation('readwrite',store=>store.delete(id));
const storeOne=row=>dbOperation('readwrite',store=>store.put(row));
function downloadJSON(filename,contents){
 const blob=new Blob([JSON.stringify(contents,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

const points=n=>n==null?'—':Number(n).toLocaleString('en-GB')+' pts';
const label=(f)=>f?.value==null?'Unknown':f.value;
function badge(matched){return make('span',matched?'tag':'tag amb',matched?'✓ Matched':'! Unmatched');}
function appendSelection(where,s,depth=0,unmatchedOnly=false){
 if(unmatchedOnly&&s.matchStatus==='matched'&&!s.children.some(x=>x.matchStatus!=='matched'))return;
 const item=make('div','selection');if(depth)item.style.marginLeft=`${Math.min(depth,4)*18}px`;
 item.append(badge(s.matchStatus==='matched'));
 const main=make('div','selection-main');const top=make('div','selection-name',s.raw);const small=make('div','selection-kind',`${s.kind}${s.owner?(s.owner.startsWith('g')?' · model group':' · attached to '+s.owner):''} · source line ${s.line}`);main.append(top,small);
 if(s.reference){const a=make('a','',`Source: tow.whfb.app`);a.href=s.reference.url;a.target='_blank';a.rel='noopener noreferrer';main.append(a);}
 item.append(main);where.append(item);
 for(const child of s.children)appendSelection(where,child,depth+1,unmatchedOnly);
}
// The roster is a view of the parsed data, not a second army parser.
 // Unit order follows the original input, including duplicate unit instances.
function renderRoster(army){
 const holder=$('roster');holder.replaceChildren();
 const sectionById=new Map(army.sections.map(s=>[s.id,s]));
 let lastSection=undefined,sectionIndex=0;
 for(const unit of army.units){
  const sectionId=unit.sectionId??null;
  if(sectionId!==lastSection){
   const section=sectionById.get(sectionId);
   const heading=make('h3','roster-heading',section?.name??'Uncategorised');
   const count=army.units.filter(u=>(u.sectionId??null)===sectionId).length;
   heading.append(make('span','roster-section-count',count+' entries'));
   holder.append(heading);
   sectionIndex=0;
   lastSection=sectionId;
  }
  sectionIndex++;
  const card=make('article','roster-entry');
  const top=make('div','roster-entry-head');
  top.append(make('span','roster-number',String(sectionIndex)+'.'));
  const unitName=unit.quantity?.value==null?unit.name:unit.quantity.value+'× '+unit.name;
  top.append(make('strong','roster-name',unitName));
  top.append(make('span','roster-cost',points(unit.reportedPoints?.value)));
  card.append(top);
  const entries=[];
  // Group consecutive selections by source line; model groups retain their own lines.
  for(const selection of unit.selections??[]){
   const last=entries[entries.length-1];
   if(last?.type==='selections' && last.line===selection.line)last.items.push(selection.raw);
   else entries.push({type:'selections',line:selection.line,items:[selection.raw]});
  }
  for(const group of unit.modelGroups??[]){
   entries.push({type:'group',line:group.line,raw:group.raw,
    name:group.name,quantity:group.quantity,options:(group.selections??[]).map(s=>s.raw)});
  }
  entries.sort((a,b)=>(a.line??0)-(b.line??0));
  if(entries.length){
   const details=make('div','roster-entry-details');
   for(const entry of entries){
    if(entry.type==='selections'){
     details.append(make('div','roster-options',entry.items.join(' · ')));
    }else{
     const groupText=entry.raw?.trim()||entry.quantity+'× '+entry.name;
     const groupRow=make('div','roster-group',groupText);
     details.append(groupRow);
     // Source group text already includes its own options; don't repeat them.
    }
   }
   card.append(details);
  }
  holder.append(card);
 }
}
function render(){
 if(!current)return;
 $('result').hidden=false;$('armyTitle').textContent=label(current.army.name)||'Unnamed army';
 $('formatLabel').textContent=`${current.format.exporter} · ${current.format.layout} · ${current.format.confidence} confidence`;
 const fields=[['Faction',current.army.faction],['Composition',current.army.composition],['Game format',current.army.gameFormat],['Player',current.army.player],['Imported total',current.army.reportedPoints],['Calculated sum',current.army.derivedPoints],['Points limit',current.army.limitPoints]];
 $('armyMeta').textContent=fields.map(([k,f])=>`${k}: ${k.toLowerCase().includes('total')||k.toLowerCase().includes('sum')||k.toLowerCase().includes('limit')?points(f.value):label(f)}`).join('  ·  ');
 const m=$('metrics');m.replaceChildren();for(const [value,title] of [[current.stats.unitCount,'Unit instances'],[current.stats.selectionCount,'Selections (incl. nested)'],[current.stats.matchedSelections,'Matched selections'],[current.stats.unmatchedSelections,'Unmatched selections']]){
  const d=make('div','metric'),v=make('strong','',value),t=make('span','',title);d.append(v,t);m.append(d);
 }
 const diag=$('diagnostics');diag.replaceChildren();$('diagnosticCount').textContent=`${current.diagnostics.length} messages`;
 if(!current.diagnostics.length)diag.append(make('p','muted small','No structural warnings. This does not mean all reference data is matched.'));
 for(const d of current.diagnostics)diag.append(make('div','notice',`${d.severity.toUpperCase()} · ${d.code}${d.line?' · line '+d.line:''}: ${d.message}`));
 const displaySource=normalizeImportText(current.originalText);
 $('rawText').textContent=displaySource.text;
 $('encodedPanel').hidden=displaySource.encoding!=='percent-encoded';
 $('encodedText').textContent=displaySource.encoding==='percent-encoded'?current.originalText:'';
 renderRoster(current);
 const unitHolder=$('units');unitHolder.replaceChildren();const only=$('unmatchedOnly').checked;
 const sections=[...current.sections.map(s=>({id:s.id,name:s.name,points:s.reportedPoints.value})),{id:null,name:'Uncategorised',points:null}];
 for(const sec of sections){
  const all=current.units.filter(u=>u.sectionId===sec.id),uList=only?all.filter(u=>u.matchStatus!=='matched'||u.selections.some(s=>s.matchStatus!=='matched'||s.children.some(x=>x.matchStatus!=='matched'))||u.modelGroups.some(g=>g.selections.some(s=>s.matchStatus!=='matched'||s.children.some(x=>x.matchStatus!=='matched')))):all;
  if(!uList.length)continue;
  unitHolder.append(make('h3','section-heading',`${sec.name} · ${all.length} entries${sec.points!=null?' · '+points(sec.points):''}`));
  for(const u of uList){
   const d=make('details','unit');const summary=make('summary');const left=make('div','unit-top');left.append(badge(u.matchStatus==='matched'));left.append(make('span','',u.quantity.value==null?u.name:`${u.quantity.value}× ${u.name}`));
   const right=make('div','unit-right',points(u.reportedPoints.value));summary.append(left,right);d.append(summary);
   const body=make('div','unit-body');body.append(make('p','muted small',`Source line ${u.line} · quantity ${u.quantity.origin} · ${u.matchStatus} reference`));
   if(u.reference){const a=make('a','small','Open unit reference ↗');a.href=u.reference.url;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
   for(const s of u.selections)appendSelection(body,s,0,only);
   for(const g of u.modelGroups){const gr=make('div','group');gr.append(make('strong','',`${g.quantity}× ${g.name}${g.pointsPerModel!=null?' · displayed model cost '+points(g.pointsPerModel):''}`));
    for(const s of g.selections)appendSelection(gr,s,0,only);body.append(gr);}
   d.append(body);unitHolder.append(d);
  }
 }
 $('saveBtn').disabled=false;$('jsonBtn').disabled=false;
}
$('parseBtn').addEventListener('click',async()=>{
 showError('');$('parseBtn').disabled=true;
 try{const input=$('sourceText').value; if(input.trim().length<10||input.length>500000)throw Error('Provide a list between 10 and 500,000 characters.'); current=parseArmy(input,sourceOverride());render();$('result').scrollIntoView({behavior:'smooth'});}
 catch(e){showError(e.message);}finally{$('parseBtn').disabled=false;}
});
$('unmatchedOnly').addEventListener('change',render);
$('saveBtn').addEventListener('click',async()=>{
 showError('');if(!current)return;
 try{const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),title:current.army.name.value,exporter:current.format.exporter,layout:current.format.layout,original_text:current.originalText,result:current};await storeOne(row);render();await refresh();alert('Saved in this browser on this device.');}catch(e){showError(e.message);}
});
$('jsonBtn').addEventListener('click',()=>{if(!current)return;downloadJSON('army-import.json',current);});
async function refresh(){const rows=(await readAll()).sort((a,b)=>b.created_at.localeCompare(a.created_at));const holder=$('savedList');holder.replaceChildren();if(!rows.length){holder.append(make('p','muted small','No saved snapshots yet.'));return;}
 for(const r of rows){const line=make('div','row-item');const info=make('div');info.append(make('strong','',r.title||'Unnamed army'),make('div','muted small',`${r.exporter} · ${r.layout} · ${new Date(r.created_at).toLocaleString()}`));
  const buttons=make('div');const open=make('button','smallbtn','Open');open.addEventListener('click',async()=>{try{const loaded=await readOne(r.id);if(!loaded)throw Error('Saved snapshot not found');current=loaded.result;$('sourceText').value=loaded.original_text;$('format').value='auto';render();$('result').scrollIntoView();}catch(e){showError(e.message);}});
  const del=make('button','smallbtn','Delete');del.addEventListener('click',async()=>{if(!confirm('Permanently delete this saved snapshot?'))return;await removeOne(r.id);await refresh();});buttons.append(open,del);line.append(info,buttons);holder.append(line);
 }
}
$('exampleBtn').addEventListener('click',async()=>{
 const id=$('examples').value;if(!id)return;
 try{const r=await fetch('./examples/'+encodeURIComponent(id)+'.txt');if(!r.ok)throw Error('Could not load sample');$('sourceText').value=await r.text();$('format').value='auto';current=null;$('result').hidden=true;$('saveBtn').disabled=true;$('jsonBtn').disabled=true;showError('');}
 catch(e){showError(e.message);}
});
fetch('./examples/manifest.json').then(r=>{if(!r.ok)throw Error('Could not load sample manifest');return r.json();}).then(items=>{for(const item of items){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;$('examples').append(opt);}}).catch(e=>showError(e.message));
$('refreshBtn').addEventListener('click' ,()=>refresh().catch(e=>showError(e.message)));
$('backupBtn').addEventListener('click',async()=>{try{const rows=await readAll();if(!rows.length)throw Error('No saved snapshots to back up yet.');downloadJSON('old-world-game-manager-backup.json',{schemaVersion:1,exportedAt:new Date().toISOString(),snapshots:rows});}catch(e){showError(e.message);}});
refresh().catch(e=>showError(e.message));

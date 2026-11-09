/**
 * Clipboard-friendly report containing ONLY currently unmatched reference records
 * and their source context. No full roster, player identity or cached rules text.
 *
 * This is a snapshot of the in-memory army AFTER cached/live matching updates.
 */
const shown = value => value===null||value===undefined||value===''?'Unknown':String(value);
const count = value => Number.isFinite(value)?value:'?';
const say = (label,value) => label+': '+shown(value);
const unmatched = entry => entry?.matchStatus !== 'matched';
const nested = entry => Array.isArray(entry?.children)?entry.children:[];

export function collectUnmatched(army){
 const result=[];
 if(!army || !Array.isArray(army.units))return result;
 const sections=new Map((army.sections||[]).map(section=>[section.id,section.name]));
 for(const [index,unit] of army.units.entries()){
  const context={
   unit:unit.name,
   unitOccurrence:index+1,
   unitLine:unit.line,
   unitHeading:unit.rawHeading,
   section:sections.get(unit.sectionId)||'Not specified in export',
   unitUrl:unit.reference?.url||null
  };
  if(unmatched(unit))result.push({type:'unit',...context,name:unit.name,
   sourceLine:unit.line,raw:unit.rawHeading||unit.name});
  function visit(selections,group=null,parent=null){
   for(const selection of selections||[]){
    if(unmatched(selection))result.push({
     type:'selection',...context,name:selection.name,
     kind:selection.kind||'unspecified',
     sourceLine:selection.line,
     raw:selection.raw||selection.name,
     groupName:group?.name||null,
     groupQuantity:group?.quantity??null,
     groupLine:group?.line??null,
     groupRaw:group?.raw||null,
     parentSelection:parent?.name||null
    });
    visit(nested(selection),group,selection);
   }
  }
  visit(unit.selections);
  for(const group of unit.modelGroups||[])visit(group.selections,group);
 }
 return result;
}
export function formatUnmatchedDebug(army,{appVersion='unknown'}={}){
 const records=collectUnmatched(army);
 const units=records.filter(r=>r.type==='unit').length;
 const selections=records.filter(r=>r.type==='selection').length;
 const lines=[
  'Warhammer: The Old World — Unmatched Reference Debug',
  'Game Manager: v'+appVersion,
  'Export format: '+shown(army?.format?.exporter)+' / '+shown(army?.format?.layout)+
    ' ('+shown(army?.format?.confidence)+' confidence)',
  'Army: '+shown(army?.army?.name?.value),
  'Faction: '+shown(army?.army?.faction?.value),
  'Calculated points: '+shown(army?.army?.derivedPoints?.value),
  'Unit instances: '+count(army?.stats?.unitCount),
  'Selections: '+count(army?.stats?.selectionCount),
  'Unmatched units: '+units,
  'Unmatched selections: '+selections,
  '',
  'These entries lack a matched source reference. They are not necessarily invalid.',
  'No complete army list, player identity or cached rules text is included.',
  ''
 ];
 if(!records.length)lines.push('No unmatched records found.');
 for(const [i,record] of records.entries()){
  lines.push('['+(i+1)+'] '+(record.type==='unit'?'UNIT':'SELECTION')+': '+shown(record.name));
  if(record.type==='selection')lines.push(say('Kind',record.kind));
  lines.push(
   say('Parent unit',record.unit)+' (entry '+record.unitOccurrence+')',
   say('Section',record.section),
   say('Source line',record.sourceLine),
   say('Original text',record.raw)
  );
  if(record.type==='selection'){
   lines.push(say('Unit heading',record.unitHeading));
   if(record.groupName)lines.push('Model group: '+record.groupQuantity+'× '+record.groupName+
      ' (line '+shown(record.groupLine)+')');
   if(record.groupRaw)lines.push(say('Model group source',record.groupRaw));
   if(record.parentSelection)lines.push(say('Nested under',record.parentSelection));
  }
  if(record.unitUrl)lines.push(say('Parent unit reference',record.unitUrl));
  lines.push('Reference status: unmatched','');
 }
 return lines.join('\n').trimEnd()+'\n';
}

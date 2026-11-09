/**
 * Guard against pasting a Game Manager page dump back into the import box.
 * Such dumps contain a real army export plus rendered results and can lead to
 * duplicate units and incorrect point totals if passed to the army parser.
 * Recovery is explicit and only offered when one complete, clean export can
 * be identified between page controls. No faction/unit names are hardcoded.
 */
import {detectFormat, parseArmy} from './parser.js?v=0.2.3';

const sourceLines = text => String(text||'').replace(/\r\n?/g,'\n').split('\n');
const isExportField = line => /^Paste exported list$/i.test(line);
const endsExportField = line => /^(?:Try a supplied test list|Readable army list|Saved imports)$/i.test(line);
const isAppHeader = line => /^Game Manager\s*[·-]\s*Browser Edition v\d+(?:\.\d+)*/i.test(line);
const isAppTitle = line => /^Import army list$/i.test(line);
export function isGameManagerPageText(text) {
 if(typeof text!=='string'||!text.includes('Game Manager'))return false;
 const lines=sourceLines(text).map(s=>s.trim());
 return lines.some(isAppHeader)&&lines.some(isAppTitle)&&lines.some(isExportField)
   && lines.some(s=>/^Analyse import$|^Try a supplied test list$/i.test(s));
}
export function extractArmyFromPage(text) {
 if(!isGameManagerPageText(text))return null;
 const lines=sourceLines(text);
 const candidates=[];
 for(let i=0;i<lines.length;i++){
  if(!isExportField(lines[i].trim()))continue;
  let end=i+1;
  while(end<lines.length&&!endsExportField(lines[end].trim()))end++;
  const candidate=lines.slice(i+1,end).join('\n').trim();
  if(!candidate)continue;
  // Reject nested copies of our UI and any residual navigation/results.
  if(isGameManagerPageText(candidate)||
     sourceLines(candidate).some(s=>isAppHeader(s.trim())||isExportField(s.trim())))continue;
  const fmt=detectFormat(candidate);
  if(fmt.exporter==='unknown'||fmt.layout==='unknown')continue;
  const parsed=parseArmy(candidate);
  if(parsed.units.length===0||parsed.stats.unparsedLines!==0||
     parsed.diagnostics.some(d=>d.severity==='error'||d.code==='ARMY_SUM_MISMATCH'||d.code==='SECTION_SUM_MISMATCH'))continue;
  candidates.push({text:candidate,format:fmt,unitCount:parsed.units.length,
   derivedPoints:parsed.army.derivedPoints.value});
 }
 // Do not guess which army to use if a page contains multiple distinct exports.
 const unique=new Map(candidates.map(c=>[c.text,c]));
 return unique.size===1?[...unique.values()][0]:null;
}

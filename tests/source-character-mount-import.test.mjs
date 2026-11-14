import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArmy} from '../docs/parser.js';
import {applyUnitDataReferences,getSelectedUnitReferenceDetails} from '../docs/unit-data.js';
import {applySourceScopedSelectionReferences,findSourceScopedSelectionReference} from '../docs/unit-selection-matcher.js';
import {resolveSelectedMountProfiles} from '../docs/resolve-selected-mount-profiles.js';
import {selectedMountProfileGroups} from '../docs/selected-mount-profile-rows.js';
import {shardForId} from '../scripts/build-browser-unit-data.mjs';

const root=new URL('../docs/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('unit-data/index.json',root),'utf8'));
function sourceRecord(slug){
 const id='unit:'+slug;
 const shard=shardForId(id);
 const record=JSON.parse(readFileSync(new URL('unit-data/shards/'+shard+'.json',root),'utf8')).records[id];
 assert.ok(record,'Expected published source record for '+id);
 return record;
}
const recordBySlug={
 'sea-guard-garrison-commander':sourceRecord('sea-guard-garrison-commander'),
 prince:sourceRecord('prince'),
 archmage:sourceRecord('archmage')
};
const fetcher=async url=>{
 const path=String(url).replace(/^\.\//,'');
 const file=JSON.parse(readFileSync(new URL(path,root),'utf8'));
 return {ok:true,json:async()=>file};
};
async function importSelectedMount(example,characterName,mountName,mountType){
 const original=readFileSync(new URL('examples/'+example,root),'utf8');
 const army=parseArmy(original);
 applyUnitDataReferences(army,index);
 const character=army.units.find(unit=>unit.name===characterName);
 assert.ok(character,'Missing imported '+characterName+' in '+example);
 const source=recordBySlug[characterName.toLowerCase().replaceAll(' ','-')];
 assert.ok(source);
 const mount=character.selections.find(selection=>selection.name===mountName);
 assert.ok(mount,'Missing selected '+mountName+' in '+example);
 // Prove source-scoped resolution even when global matching has no link.
 mount.reference=null;
 mount.matchStatus='unmatched';
 applySourceScopedSelectionReferences(army,{[character.id]:source});
 assert.equal(mount.reference?.url,'https://tow.whfb.app/unit/'+
  (mountName==='Lothern Skycutter'?'lothern-skycutter':'star-dragon'));
 assert.equal(mount.reference.evidence,'published-character-mount-option');
 assert.equal(mount.reference.parentSourceUrl,source.source.sourceUrl);
 const fetched=await getSelectedUnitReferenceDetails(army,index,{fetcher});
 assert.deepEqual(fetched.errors,[]);
 const resolved=resolveSelectedMountProfiles(character,fetched.byUrl);
 assert.equal(resolved.length,1);
 assert.equal(resolved[0].mountType,mountType);
 const groups=selectedMountProfileGroups(resolved,fetched.byUrl,{},character);
 assert.equal(groups.length,1);
 assert.ok(groups[0].profiles.length>0);
 assert.equal(groups[0].profiles[0].name,mountName);
 assert.equal(army.originalText,original);
 return {army,character,mount,groups};
}
test('OWB character Skycutter option loads its real source model rows beside the rider',async()=>{
 const {character,mount,groups}=await importSelectedMount('owb-regular.txt',
  'Sea Guard Garrison Commander','Lothern Skycutter','chariot');
 assert.ok(mount.children?.some(child=>child.name==='Eagle-Eye Bolt Thrower'));
 assert.ok(groups[0].profiles[0].characteristics.W!==undefined);
 assert.equal(character.selections.filter(s=>s.reference?.type==='mount').length,1);
});
test('New Recruit Prince and Archmage on Star Dragons retain rider/mount split profiles',async()=>{
 for(const name of ['Prince','Archmage']){
  const {groups}=await importSelectedMount('nr-tow.txt',name,'Star Dragon','riddenMonster');
  assert.equal(groups[0].profiles[0].characteristics.W,'(+6)');
  assert.equal(groups[0].profiles[0].characteristics.T,'(+3)');
  assert.equal(groups[0].profiles[0].characteristics.A,6);
 }
});
test('Mount options require exact parent source evidence; no global-name or legality guess',()=>{
 const prince=recordBySlug.prince;
 const sky=recordBySlug['sea-guard-garrison-commander'];
 const child={name:'Star Dragon'};
 const unit={reference:{url:prince.source.sourceUrl}};
 assert.equal(findSourceScopedSelectionReference(unit,prince,child)?.url,
  'https://tow.whfb.app/unit/star-dragon');
 assert.equal(findSourceScopedSelectionReference(unit,sky,child),null);
 assert.equal(findSourceScopedSelectionReference(unit,prince,{name:'Star Dragon lookalike'}),null);
 assert.equal(findSourceScopedSelectionReference(unit,prince,{name:'On foot'}),null);
 assert.equal(findSourceScopedSelectionReference(unit,prince,{name:'Elven Steed'})?.url,
  'https://tow.whfb.app/unit/elven-steed');
 const unrelated={...prince,source:{...prince.source,verificationStatus:'unverified'}};
 assert.equal(findSourceScopedSelectionReference(unit,unrelated,child),null);
});

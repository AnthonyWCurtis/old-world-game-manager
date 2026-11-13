/**
 * Stage 2 modifier foundation. This is a pure, opt-in contract evaluator, not
 * an attack or save-roll engine. All eligibility facts must be supplied by a
 * caller that has verified the corresponding model/component and event.
 * Unsupported/unknown circumstances retain the base number and a trace.
 *
 * Example sources reviewed 2026-11-12:
 * https://tow.whfb.app/special-rules/armour-bane
 * https://tow.whfb.app/magic-item/charmed-shield
 */
const list=value=>Array.isArray(value)?value:[];
const validSource=source=>source?.verificationStatus==='verified'&&
 typeof source.verifiedOn==='string'&&/^https:\/\/tow\.whfb\.app\/[a-z0-9/-]+\/?$/.test(source.url||'');
const matches=(a,b)=>a?.kind===b?.kind&&a?.key===b?.key;
const sameRecipient=(a,b)=>!!a?.unitId&&a.unitId===b?.unitId&&
 a.modelId===b.modelId&&a.componentId===b.componentId;

/** Returns a reversible, auditable proposal: no game state is mutated. */
export function evaluateModifiers({base,modifiers=[],context={}}={}){
 if(!Number.isFinite(base))throw new TypeError('A finite numeric base is required.');
 let value=base;
 const applied=[],skipped=[],unresolved=[],trace=[];
 const usedGroups=new Set();
 const record=(entry,reason,unknown=false)=>{
  (unknown?unresolved:skipped).push({id:entry.id,reason});
  trace.push(`${entry.id||'unidentified modifier'}: ${reason}; value remains ${value}.`);
 };
 for(const entry of list(modifiers)){
  if(!entry||typeof entry!=='object'||!entry.id){continue;}
  if(!validSource(entry.source)){record(entry,'source interpretation is unverified',true);continue;}
  if(!entry.owner?.unitId||!sameRecipient(entry.recipient,context.recipient)){
   record(entry,'recipient model or component does not match',!entry.owner?.unitId);continue;
  }
  if(!matches(entry.target,context.target)||entry.trigger?.phase!==context.phase||
      entry.trigger?.event!==context.event){record(entry,'target or event does not match');continue;}
  if(!entry.duration?.kind||!entry.stacking?.group||!entry.stacking?.policy){
   record(entry,'duration or stacking policy is unknown',true);continue;
  }
  if(entry.duration.kind==='through-turn'){
   if(!Number.isSafeInteger(context.turn)||!Number.isSafeInteger(entry.duration.expiresAfter)){
    record(entry,'turn expiry context is incomplete',true);continue;
   }
   if(context.turn>entry.duration.expiresAfter){record(entry,'modifier expired');continue;}
  }else if(entry.duration.kind!=='event'&&entry.duration.kind!=='ongoing'){
   record(entry,'unsupported duration policy',true);continue;
  }
  if(entry.trigger.dice){
   const basis=entry.trigger.dice.basis;
   if(!['natural','modified'].includes(basis)||!Number.isFinite(context.dice?.[basis])){
    record(entry,'dice basis or original roll is unknown',true);continue;
   }
   if(context.dice[basis]!==entry.trigger.dice.equals){
    record(entry,`${basis} roll does not satisfy trigger`);continue;
   }
  }
  const unknown=list(entry.prerequisites).find(x=>context.facts?.[x.key]===undefined);
  if(unknown){record(entry,`unresolved prerequisite: ${unknown.key}`,true);continue;}
  const unmet=list(entry.prerequisites).find(x=>context.facts[x.key]!==x.required);
  if(unmet){record(entry,`unmet prerequisite: ${unmet.key}`);continue;}
  const missingCondition=list(entry.conditions).find(x=>context.facts?.[x.key]===undefined);
  const missingExclusion=list(entry.exclusions).find(x=>context.facts?.[x.key]===undefined);
  if(missingCondition||missingExclusion){
   record(entry,`condition unknown: ${(missingCondition||missingExclusion).key}`,true);continue;
  }
  if(list(entry.conditions).some(x=>context.facts[x.key]!==x.equals)||
     list(entry.exclusions).some(x=>context.facts[x.key]===x.equals)){
   record(entry,'condition failed or exclusion applies');continue;
  }
  if(!['exclusive','stack'].includes(entry.stacking.policy)){
   record(entry,'stacking rule is not established',true);continue;
  }
  if(entry.stacking.policy==='exclusive'&&usedGroups.has(entry.stacking.group)){
   record(entry,'exclusive modifier group has already been applied');continue;
  }
  const op=entry.operation;
  if(!Number.isFinite(op?.value)||!['add','replace'].includes(op.type)){
   record(entry,'operation or numeric effect is not verified',true);continue;
  }
  const old=value;
  value=op.type==='add'?value+op.value:op.value;
  applied.push(entry.id);
  if(entry.stacking.policy==='exclusive')usedGroups.add(entry.stacking.group);
  trace.push(`${entry.id}: ${old} ${op.type==='add'?`+ (${op.value})`:`replaced by ${op.value}`} = ${value}. ${entry.trace||''}`.trim());
 }
 return {base,value,applied,skipped,unresolved,trace};
}

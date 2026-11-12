/**
 * Read-only published mount benefit register. No rule is activated for the
 * rider unless the assembled split profile and any exceptions are verified.
 * Rules attached to a weapon are never treated as model-wide benefits.
 */
const ORIGIN='https://tow.whfb.app';
const RULES=Object.freeze({
 chariot:'https://tow.whfb.app/characters/split-profile-chariot-mount',
 riddenMonster:'https://tow.whfb.app/characters/split-profile-ridden-monster',
 cavalry:'https://tow.whfb.app/troop-types-in-detail/split-profile-cavalry',
 faq:'https://tow.whfb.app/faq/universal-special-rules',
 weaponsFaq:'https://tow.whfb.app/faq'
});
const safe=url=>typeof url==='string'&&
 /^https:\/\/tow\.whfb\.app\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(url);
const rule=(name,sourceUrl,scope,detail,status='conditional')=>({
 name,sourceUrl,scope,detail,status
});
export function publishedMountBenefits(mountRecord,mountType){
 if(!mountRecord||!safe(mountRecord?.source?.sourceUrl)||
    mountRecord.source.verificationStatus!=='source-extracted'||
    !Object.hasOwn(RULES,mountType)||!['chariot','riddenMonster','cavalry'].includes(mountType))
  return null;
 const sourceUrl=RULES[mountType],benefits=[],specialRules=[];
 const mountedType=mountType==='chariot'?'chariot':mountType==='riddenMonster'?'ridden monster':'cavalry';
 benefits.push(rule('Split-profile special rules',sourceUrl,'model',
  'Special rules generally apply across split-profile elements unless a specific rule or FAQ says otherwise. Verify each named rule before applying.'));
 if(mountType==='chariot'){
  benefits.push(rule('Movement',sourceUrl,'combined model',
   'Use the drawing beasts’ Movement, or the chariot’s if it has none.'));
  benefits.push(rule('Wounds',sourceUrl,'combined model',
   'Add the character’s Wounds to the chariot’s Wounds; only after mount association and both profiles are verified.'));
  benefits.push(rule('Toughness',sourceUrl,'enemy To Wound rolls',
   'Use the higher of character and chariot Toughness.'));
 }else if(mountType==='riddenMonster'){
  benefits.push(rule('Movement',sourceUrl,'combined model','Use the mount’s Movement.'));
  benefits.push(rule('Toughness and Wounds',sourceUrl,'combined model',
   'Mount profile may explicitly improve character Toughness and/or Wounds. No generic addition is inferred.'));
 }else{
  benefits.push(rule('Rider armour',sourceUrl,'combined model','Use the rider’s armour value; this is not the mount’s separate armour value.'));
 }
 benefits.push(rule('Impact Hits and Stomp Attacks',RULES.faq,'mount attack component',
  'Made by the mount/chariot as specified, not duplicated for the rider. Rider-specific Impact Hits are resolved separately.'));
 benefits.push(rule('Separate attacks',sourceUrl,'each profile element',
  'Rider, crew and beasts use their own offensive characteristics and weapons.'));
 const classes=[['startingRules','standard on mount'],['optionalRules','optional — not selected by this link']];
 for(const [field,classification] of classes)
  for(const entry of Array.isArray(mountRecord[field])?mountRecord[field]:[]){
   const name=String(entry?.name||'').trim();
   if(!name||!safe(entry.sourceUrl))continue;
   const isImpact=/^(?:Impact Hits|Stomp Attacks)\b/i.test(name);
   specialRules.push({
    name,sourceUrl:entry.sourceUrl,classification,
    appliesTo:isImpact?'mount attack component; not copied to rider':
     'possible split-profile rule; individual applicability requires review',
    status:isImpact?'component-specific':field==='optionalRules'?'not-selected':'requires-rule-review'
   });
  }
 return {mountType,mountLabel:mountedType,sourceUrl:mountRecord.source.sourceUrl,
  ruleUrl:sourceUrl,benefits,specialRules,
  weaponRuleExclusion:{sourceUrl:RULES.weaponsFaq,
   detail:'Weapon-granted rules apply only to attacks with that weapon; not automatically to mount attacks.'},
  verificationStatus:'reference-only; mount attachment and transfer conditions not verified'};
}

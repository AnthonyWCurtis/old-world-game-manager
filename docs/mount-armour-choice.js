/**
 * Model-scope armour choice rules. Never guess a mount from unit names.
 * Call only with an explicitly identified, source-verified mount category.
 */
export const MOUNT_ARMOUR_RULES=Object.freeze({
 chariot:'https://tow.whfb.app/characters/split-profile-chariot-mount',
 riddenMonster:'https://tow.whfb.app/characters/split-profile-ridden-monster',
 cavalry:'https://tow.whfb.app/troop-types-in-detail/split-profile-cavalry',
 faq:'https://tow.whfb.app/faq/characters',
 barding:'https://tow.whfb.app/weapons-of-war/barding'
});
const validValue=x=>Number.isInteger(x)&&x>=2&&x<=7;
export function compareRiderMountArmour({mountType,riderValue=null,mountValue=null,
 mountSourceUrl=null,modelScopeVerified=false}={}){
 if(!['chariot','riddenMonster','cavalry'].includes(mountType))
  return {status:'unresolved',reason:'Mount profile classification not verified; no armour rule selected'};
 if(!modelScopeVerified)
  return {status:'unresolved',reason:'Mounted model and mount profile association not verified',
   ruleUrl:MOUNT_ARMOUR_RULES[mountType]};
 if(!validValue(riderValue)&&riderValue!==null)return {status:'unresolved',reason:'Invalid rider armour input'};
 if(!validValue(mountValue)&&mountValue!==null)return {status:'unresolved',reason:'Invalid mount armour input'};
 const choices=[...(validValue(riderValue)?[{owner:'rider',value:riderValue,label:riderValue+'+'}]:[])];
 if(mountType==='cavalry'){
  return {status:'conditional',mountType,choices,
   ruleUrl:MOUNT_ARMOUR_RULES.cavalry,
   note:'Normal cavalry split profile uses rider armour. Barding, if verified selected, improves that model armour; mount armour is not an alternative.'};
 }
 if(validValue(mountValue)){
  try{
   const u=new URL(mountSourceUrl);
   if(u.origin!=='https://tow.whfb.app'||u.search||u.hash||
      !/^\/unit\/[a-z0-9-]+$/.test(u.pathname))throw Error('unsafe');
  }catch{
   return {status:'unresolved',reason:'Mount armour lacks an exact approved source URL',
    ruleUrl:MOUNT_ARMOUR_RULES[mountType]};
  }
  choices.push({owner:'mount',value:mountValue,label:mountValue+'+',sourceUrl:mountSourceUrl});
 }
 return {status:choices.length?'choice-required':'unresolved',mountType,choices,
  ruleUrl:MOUNT_ARMOUR_RULES[mountType],faqUrl:MOUNT_ARMOUR_RULES.faq,
  note:'A ridden monster/chariot allows a choice of rider or mount armour. Rider shield does not improve mount armour. Magic armour benefits cannot be kept when using mount armour. Do not automatically pick the numerically lower value.'};
}

/** Tactical Command destinations. View-only: never modifies stored armies or combat state. */
export function wireTacticalHome(doc=document){
 const jump=(buttonId,targetId)=>{
  const button=doc.getElementById(buttonId),target=doc.getElementById(targetId);
  if(!button||!target)return;
  button.addEventListener('click',()=>{
   // Do not create a history entry or lose the current import on navigation.
   target.scrollIntoView({block:'start',behavior:'smooth'});
   target.tabIndex=-1;
   target.focus({preventScroll:true});
  });
 };
 jump('tacticalImportNav','tacticalImportPanel');
 jump('tacticalSavedNav','tacticalSavedArmies');
}

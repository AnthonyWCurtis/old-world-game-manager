/**
 * Legacy-compatible read projection for imported rosters saved in IndexedDB.
 * Never reparse or mutate a past army just because a newer parser exists.
 */
export function restoreStoredImport(row){
 const saved=row?.result;
 if(!saved||typeof saved!=='object'||!saved.army||!Array.isArray(saved.units))
  throw Error('Saved army is missing its parsed roster; restore a JSON backup or import again.');
 const original=typeof saved.originalText==='string'?saved.originalText:
  typeof row.original_text==='string'?row.original_text:'';
 return {...saved,originalText:original};
}

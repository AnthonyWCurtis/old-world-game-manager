# Source-backed character-granted special rules and effect coverage audit
12 November 2026

## Bug verified
- https://tow.whfb.app/unit/ishaya-vess lists **Precision Strikes** in its published special rules; the source-extracted `unit:ishaya-vess` record already contains the rule name and canonical URL.
- https://tow.whfb.app/special-rules/precision-strikes states that **a Lothern Sea Guard unit joined by Ishaya Vess improves the Armour Piercing of its weapons by 1**.
- The importer loads Ishaya and the published rule into `unitDataRecords` and the equipment/rule display. The separate `projectArmyEffects` logic only models reviewed magic items and spells; it does not project character-granted special rules. Therefore the unit Effects tab and attack panel silently omit this source-backed conditional benefit.
- This is **not** proof that every special rule missing from the small registry is a buff. Many are independent, personal or informational rules.

## Approach
1. Leave the original importer, model, source record, source URLs, spell engine and battle-state serialization untouched.
2. Introduce a **declarative, source-verified special-rule effect registry**, with explicit owner and target source URLs, source rule link, assignment trigger and short conditional effect. Generic engine matches source-extracted `startingRules` by both name and URL; no faction logic baked into the projection algorithm.
3. Use the existing per-instance manual assignment to display Precision Strikes **only on the correctly joined Lothern Sea Guard**, not on any Ship's Company or other regiment or every character. Also show the character's rule on the character's own Effects tab as a conditional granted ability, **not** as an attack modifier for Ishaya herself.
4. The effect does **not** change base model characteristics, auto-compute hit/wound/armour rolls or silently assume legal joining. Display it as source-backed **Conditional · Recorded join**, with provenance and scope.
5. Expose other source-listed special rules in a folded **Published special rules (reference only)** section of each source-verified unit's Effects tab. This is an audit trail, not an automatic buff claim; each rule retains a source link and never gains guessed calculations.
6. Replace vague equipment counts in compact cards with a small number of named verified benefit chips, and put the full list plus conditions in Effects. Use generic `quickLabel` metadata where available; no hardcoded roster/faction cases in UI. Preserve status and source links.

## Strict safeguards
- Only exact unit-reference and source-record URLs from tow.whfb.app and matching source-extracted starting rules may activate a reviewed character rule. A missing record, unverified source, different reference, wrong target or absent assignment must fail closed.
- Rule mappings are **data/configuration**, not conditional code paths keyed to faction or nicknames.
- Duplicated units remain separate by imported instance ID, and renaming has no effect.
- The app remains offline static, and all former features/tests continue working.

## Acceptance
Node engine tests using the actual shipped source record, mobile browser regression for joining/removing Ishaya, separate Razor Standard and Precision Strikes rows, correct non-target absence, conditional text and source link. Other published rules remain visible as explicitly reference-only. Full importer/mobile/reference tests green, cache bumped before merge.

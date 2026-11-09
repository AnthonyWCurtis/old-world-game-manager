# High Elf Realms reference records (v0.4 data foundation)

This directory contains source-linked unit reference records for future Game Manager matching and gameplay features. The source of truth is exclusively https://tow.whfb.app. **Record coverage is not the same as full option/rules verification.**

The complete High Elf Realms index currently contains **45 distinct units** in eight source categories. Two named character records (Ishaya Vess and Korhil Lionmane) have been individually reviewed; 43 additional records were generated from their public unit pages by a bounded, deterministic extractor.

## Current High Elf Realms records
- `high-elf-realms/ishaya-vess.json`: Ishaya Vess, fixed profile, equipment, linked magic weapon and seven special rules.
- `high-elf-realms/korhil-lionmane.json`: Korhil Lionmane, fixed equipment with an optional Chieftain's Chariot, distinct magic items and special rules. The chariot has its own separately sourced crew, lions, weapons, component characteristics and rules.
- `high-elf-realms/*.json`: 43 additional source-extracted entries covering every remaining unit indexed under the army page; each includes model-profile rows, displayed cost, unit metadata and linked reference names/URLs where available.
- `manifest.json`: explicit discovery list for the static browser website; no directory listing or API is required.
- `scripts/build-high-elf-reference-index.mjs`: bounded script to retrieve and refresh the 45 indexed records without overwriting Ishaya/Korhil's manually reviewed detail.

## Evidence and status

- `verified-on-tow`: individually reviewed record with its own sourced equipment, rules, effects and exclusions. Currently only Ishaya and Korhil.
- `source-extracted`: source page fetched and structured characteristics and/or points extracted. `pageLinkedReferences` are links *mentioned* on the page, not verified automatic equipment, known innate abilities, or proof of upgrade eligibility.
- `source-indexed`: page URL was confirmed on the army index, but detailed extraction was unavailable; missing data must remain null, not guessed.
- The source index has 45 units and **43/43 new pages were fetched successfully in the initial run**. New pages may change; refreshes retain prior successful records when a page fails.
- Base profiles keep `(+2)` modifiers and null/unknown stat values rather than flattening mount and rider stats incorrectly.


- The primary unit page is kept in `source.url`; each equipment item and rule retains its own confirmed URL.
- `verified-on-tow` means the named reference was checked on that page, **not** that the specific imported army is legal.
- `verifiedOn` is the check date. `sourceVersion: null` means no independently confirmed source release/version was available.
- `interpretationChecks.status: derived` denotes a calculation or synthesis from listed source pages; `source-derived` denotes a scoped reading of an explicit rule.
- `configuration.fixed` describes whether the source unit offers any configurable options; `equipmentFixed` can remain true even with an optional mount. `availableOptions` contains only options explicitly offered by the same unit page.
- `mountProfiles` record optional mounts independently from rider characteristics, preserving separate crew, beasts, attacks, armour, source pages and applicability notes. A mount must not inherit Korhil-only rules simply because it shares a model.
- `legalityVerified` and `engineImplemented` are false until separately verified and implemented.
- Preserve unit-specific context for command options, magical equipment, role designations and rule interactions. Do not turn a rule existing on a page into proof that another unit can take it.
- Avoid guessed source URLs, blanket aliases, guessed characteristics, and copying full rules text. Prefer concise interpretations with evidence URLs.

The High Elf roster is now completely **indexed**, but the 43 machine-extracted records still need proper per-unit equipment, configurable upgrades and innate rule verification before they can be called equivalent to the two curated characters.

These records are an **incremental data foundation**. The current browser importer does not yet load this manifest into its live matching engine. Source-profile discovery, catalogue matching and JSON army export are unchanged. A later integration can use this manifest to reconcile unit-specific selections with verified page details.

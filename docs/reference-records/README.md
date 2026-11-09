# Verified unit-reference records (v0.4 data foundation)

This directory contains individually verified, structured unit reference records for future Game Manager matching and gameplay features. The source of truth is exclusively https://tow.whfb.app.

## Current High Elf Realms records
- `high-elf-realms/ishaya-vess.json`: Ishaya Vess, fixed profile, equipment, linked magic weapon and seven special rules.
- `high-elf-realms/korhil-lionmane.json`: Korhil Lionmane, fixed equipment with an optional Chieftain's Chariot, distinct magic items and special rules. The chariot has its own separately sourced crew, lions, weapons, component characteristics and rules.
- `manifest.json`: explicit discovery list for the static browser website; no directory listing or API is required.

## Evidence and status

- The primary unit page is kept in `source.url`; each equipment item and rule retains its own confirmed URL.
- `verified-on-tow` means the named reference was checked on that page, **not** that the specific imported army is legal.
- `verifiedOn` is the check date. `sourceVersion: null` means no independently confirmed source release/version was available.
- `interpretationChecks.status: derived` denotes a calculation or synthesis from listed source pages; `source-derived` denotes a scoped reading of an explicit rule.
- `configuration.fixed` describes whether the source unit offers any configurable options; `equipmentFixed` can remain true even with an optional mount. `availableOptions` contains only options explicitly offered by the same unit page.
- `mountProfiles` record optional mounts independently from rider characteristics, preserving separate crew, beasts, attacks, armour, source pages and applicability notes. A mount must not inherit Korhil-only rules simply because it shares a model.
- `legalityVerified` and `engineImplemented` are false until separately verified and implemented.
- Preserve unit-specific context for command options, magical equipment, role designations and rule interactions. Do not turn a rule existing on a page into proof that another unit can take it.
- Avoid guessed source URLs, blanket aliases, guessed characteristics, and copying full rules text. Prefer concise interpretations with evidence URLs.

These records are an **incremental data foundation**. The current browser importer does not yet load this manifest into its live matching engine. Source-profile discovery, catalogue matching and JSON army export are unchanged. A later integration can use this manifest to reconcile unit-specific selections with verified page details.

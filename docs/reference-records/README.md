# Reference database collections (v0.4 data foundation)

This directory contains source-linked unit reference records for future Game Manager matching and gameplay features. The source of truth is exclusively https://tow.whfb.app. **Record coverage is not the same as full option/rules verification.**

The complete High Elf Realms index currently contains **45 distinct units** in eight source categories. Two named character records (Ishaya Vess and Korhil Lionmane) have been individually reviewed; 43 additional records were generated from their public unit pages by a bounded, deterministic extractor.

## Collections

The [collection registry](collections.json) lists the independent reference datasets:

- [High Elf Realms units](manifest.json): 45 unit URLs with individual JSON records (2 manually reviewed, 43 source-extracted).
- [Rules/reference sitemap](rules-index.json): **1,833 unique reference-page URLs** from [tow.whfb.app/sitemap/rules](https://tow.whfb.app/sitemap/rules), spanning 32 sitemap section links and 31 URL categories on 9 November 2026. See the compact [rules summary](rules-summary.json) for current counts.
- [Magic lore and spell sitemap](magic-index.json): **170 unique source URLs** from [tow.whfb.app/sitemap/magic](https://tow.whfb.app/sitemap/magic): 29 lore pages, 139 spell pages and 2 magic guidance/reference pages. [Magic summary](magic-summary.json) records counts, source time and selected examples.
- Some sitemap entries are gameplay rules, others are equipment, magic, army lists, or other indexed topics. Do not classify everything as a universal special rule.

## Rules sitemap indexing

`scripts/build-rules-reference-index.mjs` performs one bounded HTML request to the publicly accessible rules sitemap and retains only the published labels and exact links. The GitHub Actions workflow refreshes this collection weekly (and can be triggered manually), checking that the sitemap has plausible coverage before replacing the previous index.

Each entry carries `verificationStatus: source-indexed`: its URL and label came directly from the sitemap, but **the text and interpretation of the target page have not been reviewed**. The collection records ambiguous labels with multiple possible pages; they must not be auto-assigned without context. No rule text is mirrored, invented or inferred by the index builder.

This collection is independent of the 45 unit records. The browser importer in v0.3.3 has not yet been integrated with this static index; building the data source is the first step toward reliable automatic matching.

## Magic sitemap indexing

`scripts/build-magic-reference-index.mjs` retrieves the public magic sitemap in a single bounded request. It separates the **Magic Lore Index** from the **Spell Index**, identifying 29 lore pages, two non-lore guidance pages and 139 spell pages in the 9 November 2026 snapshot. All titles and URLs originate from the sitemap; entries have `verificationStatus: source-indexed`.

The two guidance pages, **Spell Categories (Lores)** and **Spells & Spell Generation**, are identified separately from actual magic lores. A magic link is *not evidence* that a particular wizard can select a spell, that a spell has the effect described in an external army list, or that spell generation is legal.

A bounded GitHub Action refreshes the index weekly or on demand, preserves the previous snapshot if new data appears incomplete, and records any ambiguous names rather than making an unsafe guess. The static collection is discoverable through [collections.json](collections.json) but is **not yet wired into the browser's live matching engine**. Pages shared by this sitemap and the rules sitemap should eventually be deduplicated by exact URL when their indices are combined.

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

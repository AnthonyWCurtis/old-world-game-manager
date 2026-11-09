# Reference database collections (v0.4 data foundation)

The Game Manager maintains four source-linked, independently refreshable reference indices from **https://tow.whfb.app**. The [collection registry](collections.json) lists the paths used to discover these static datasets.

| Collection | Data | Source | Summary |
| --- | --- | --- | --- |
| [Armies](armies-index.json) | 19 army URLs and 581 global unit URLs | [Armies sitemap](https://tow.whfb.app/sitemap/armies) | [Summary](armies-summary.json) |
| [Rules](rules-index.json) | 1,833 source-linked references, including 652 special-rule pages | [Rules sitemap](https://tow.whfb.app/sitemap/rules) | [Summary](rules-summary.json) |
| [Magic](magic-index.json) | 29 magic lores, 139 spells and 2 magic guidance pages | [Magic sitemap](https://tow.whfb.app/sitemap/magic) | [Summary](magic-summary.json) |
| [Magic Items & Abilities](magic-items-index.json) | 71 type/guidance pages and 768 individual item/ability pages | [Magic Items sitemap](https://tow.whfb.app/sitemap/magic-items) | [Summary](magic-items-summary.json) |

The counts above are from the **9 November 2026** source snapshots and may change when the upstream site changes. Some URLs appear in more than one sitemap; deduplicate by exact URL when combining collections rather than adding counts across indices.

## Global Armies index

The `Army Index` lists army page references and the `Unit Index` lists global unit page references. All 45 High Elf unit URLs previously present in a standalone High Elf collection are also in the global Armies index. The separate High Elf JSON records, their manifest and the dedicated High Elf extraction script/workflow have been deleted to avoid a redundant dataset.

**Important limitation:** the global Armies index contains **names, types, URLs and provenance only**. It does **not** contain the detailed High Elf characteristics, equipment, magic items, special rules or option restrictions that were stored in the deleted unit records. Nor does a globally listed unit imply membership of a specific faction or a legal army composition.

The controlled importer `scripts/build-armies-reference-index.mjs` makes one bounded public sitemap request, restricts URLs to the source origin, separates army and unit page types, checks for ambiguous labels and rejects unexpectedly incomplete source data.

## Rules and Magic

- `scripts/build-rules-reference-index.mjs` indexes real source URLs and titles from the Rules sitemap. This index includes gameplay topics, equipment, special rules, magic and other references. It does not verify rule text or interpretation.
- `scripts/build-magic-reference-index.mjs` separates the Magic Lore Index (29 lores and 2 reference pages) from the Spell Index (139 spell pages). A matching page does not establish the spell's effect or whether a given wizard may select it.

All three collections retain `verificationStatus: source-indexed`. This means a title and URL were located in a source sitemap; it does **not** mean gameplay rules, army legality, point values, option availability or spell eligibility have been verified.

The GitHub Actions refresh workflows run weekly or manually, updating these separate datasets only after sanity checks. The current v0.3.3 browser importer **does not yet read these static collection files** to improve match statuses.

## Magic Items and Abilities index

The public [Magic Items (and Abilities) sitemap](https://tow.whfb.app/sitemap/magic-items) has two distinct sections: **Type Index** and **Item(/Ability) Index**. The 9 November 2026 snapshot contains **71 type or guidance links** (`/magic-items/…`) and **768 individual item or ability links** (`/magic-item/…`), for 839 unique source URLs and no ambiguous names.

This collection is broader than magical equipment: it also links abilities, gifts, honours, runes and faction-specific magic item sections. We preserve the source label, its section, exact URL, source date and `verificationStatus: source-indexed`. A trailing asterisk in a label is retained for display and ignored for conservative exact-name lookup (for example, `Charmed Shield*` matches `Charmed Shield`). The separate [Magic](magic-index.json) collection holds **spell and lore** references; the two must not be conflated.

The bounded `scripts/build-magic-items-reference-index.mjs` performs one public sitemap request. Its weekly/manual GitHub Actions refresh rejects untrusted URLs, unexpected index sizes and suspicious shrinkage, preserving the last successful snapshot. All item page effects, costs and who may select them remain **unverified** until separately checked against their source pages. The existing browser importer does not yet consume these new reference collections.

## Source provenance

Each index includes the source URL, retrieval timestamp, and verification status. Unmatched or ambiguous names must not be resolved through invented links, guessed aliases or unverified faction relationships. No full rule text is mirrored.

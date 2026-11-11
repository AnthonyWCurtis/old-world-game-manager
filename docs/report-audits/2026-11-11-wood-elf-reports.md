# Audit: anonymous unmatched reports (9–11 November 2026)

**Reviewed:** 2026-11-11  
**Rules reference policy:** All verified Warhammer identities and options come exclusively from https://tow.whfb.app. Verified source links do **not** establish points or army legality.

## Scope and provenance
Three anonymous submissions under `reports/unmatched/report-*.txt`, made 2026-11-09 and 2026-11-11, contained 22 recorded entry occurrences. Original submissions are **never rewritten**. They did **not** contain full pasted lists or a player identity.

### Report 1: Chaos Dwarfs (2026-11-09)
Nine entries (Sorcerer-Prophet Wizard and level, Bale Taurus, Hobgoblin Khan ranged-weapon descriptor, command entries for Infernal Guard and Hobgoblins) are already covered by the reviewed source catalogue. The historical resolver already counted these as resolved before this work. No additional unverified rules were introduced.

### Report 2: Wood Elf Waystalker and Glade Guard (2026-11-11)
- **The Briar-bow**, parent **Waystalker**, source line 11 — **UNRESOLVED**. The [published Waystalker page](https://tow.whfb.app/unit/waystalker) lists a general magic-item allowance but not this named item; no standalone exact item page was verified on tow.whfb.app. Do not fabricate an item link or assume the reported army selection is illegal.
- **The Kinbands of Modryn**, parent **Glade Guard**, source line 26 — **UNRESOLVED**. The [published Glade Guard page](https://tow.whfb.app/unit/glade-guard) does not list this named choice. Do not fabricate a special-rule/item page. An exporter or supplement may have additional source material not represented in the current audited source.

### Report 3: Wood Elf Orion and Beast Pack (2026-11-11)
- **Orion** (unit, line 8) — **FIXED** as an exact reviewed alias for [Orion, the King in the Woods](https://tow.whfb.app/unit/orion-the-king-in-the-woods), whose source record is in the version-pinned 581-unit snapshot. The original exported name remains `Orion`. The source currently lists 405 pts and T6; the importer does **not** alter submitted points/statistics.
- **Spear of Kurnous** (equipment, line 12) — **FIXED** with a parent-specific alias to [The Spear of Kurnous](https://tow.whfb.app/magic-item/the-spear-of-kurnous). Its source scope is [Orion's published equipment](https://tow.whfb.app/unit/orion-the-king-in-the-woods), not an unconditional global entitlement.
- **3× Deepwood Hound selections broken into 9 fragments** (lines 62–64, 67–69, 72–74 in archived report) — **FIXED** at the OWB multiline parser. Reported sequences consist of `2x Deepwood Hound [Hand weapons (Claws + fangs`, `tusks`, `teeth)]` (twice), and an equivalent `1x` entry. The parser now conditionally joins adjacent dash-prefixed lines to form one complete balanced bracketed selection, preserving the exact original text and first source line. Source-backed component option matches use the parent [Wood Elf Beast Pack](https://tow.whfb.app/unit/wood-elf-beast-pack) and [Deepwood Hound](https://tow.whfb.app/unit/deepwood-hound) records, with the exact published 1–3 count range. The child 'Hand weapons' remains a separate qualified equipment description, *not* an extra paid beast selection.
- Historic archived fragments are excluded from the unresolved aggregate **only** if an exact, contiguous 3-line pattern and verified parent URL are present. Incomplete or unrelated records are never silently discarded.

## Expected consolidated tally after GitHub Actions rebuild

- 3 source report files, 22 archived occurrences.
- 11 source-linked matches (previously 9; now +Orion and +Spear of Kurnous).
- 9 parser-repaired historic fragment occurrences.
- 2 unresolved occurrences corresponding to 2 distinct entries: The Briar-bow and The Kinbands of Modryn.

Review-status records in `reports/admin/reviews.json` are an independent user-managed ledger. Fixes are evidence-backed in this commit/PR; this audit does not claim admin statuses were changed.

## Tests

- `tests/reported-wood-elf-fixes.test.mjs`: exact aliases, parent scope, source-shard linkage, 3 joined vs 9 fragmented selections, literal source preservation, count-range bounds, no joins of unrelated bullets, historical report aggregation, two intentionally unresolved names.
- `tests/reported-wood-elf-browser-smoke.mjs`: 390px Chrome browser import, source data loading and Game Screen without horizontal scroll.
- Full `node --test` regression suite and previously shipped mobile/offline flows must pass before merge.

**Limitations:** The anonymous reports contain unmatched names only, not a whole roster. We cannot validate the original selections' army composition or reproduce any unsubmitted choices. Do not expand the list of 'fixed' reports by guessing. The two names without an audited tow.whfb.app source remain genuinely outstanding.

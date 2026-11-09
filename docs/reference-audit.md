# Marks Orges — first reference-link audit
Verified: 9 November 2026
Source of truth: https://tow.whfb.app

This is a **name-to-source audit**, not an army legality check or a verification of all rules, statistics, point values, and permitted combinations. We do not assign invented rules to a selection. All existing imported unit identities, reported costs, qualifiers, and source text are preserved.

## Findings

The 2,599-point Battle Builder **Compact** test roster has 17 unit instances, 74 selection instances (including repetition), and 0 unparsed lines. Before this audit, 50 selections were linked to references and 24 were unmatched. After this audit, **71 are linked and 3 remain unmatched**.

The following 12 distinct selection names were linked, accounting for 21 previously unmatched occurrences:

| Selection | Occurrences | Verified rules-index reference |
| --- | ---: | --- |
| Shield | 1 | https://tow.whfb.app/weapons-of-war/shield |
| General | 1 | https://tow.whfb.app/characters/selecting-your-general |
| Mathlann's Ire | 1 | https://tow.whfb.app/magic-item/mathlanns-ire |
| Level 3 Wizard | 1 | https://tow.whfb.app/magic/levels-of-wizardry |
| Battle Standard Bearer | 1 | https://tow.whfb.app/characters/the-battle-standard-bearer-model |
| Longbow | 1 | https://tow.whfb.app/weapons-of-war/longbow |
| Sea Guard (Elven Honour) | 5 | https://tow.whfb.app/magic-item/sea-guard |
| Lothern Skycutter (mount) | 1 | https://tow.whfb.app/unit/lothern-skycutter |
| Level 1 Wizard | 2 | https://tow.whfb.app/magic/levels-of-wizardry |
| Full Command | 1 | https://tow.whfb.app/command-groups |
| Repeater Bolt Thrower | 4 | https://tow.whfb.app/war-machines/bolt-throwers |
| Ambushers | 2 | https://tow.whfb.app/special-rules/ambushers |

**Not linked:** `On foot` (3). This phrase denotes the absence of a mount; we found no independent named equipment, skill or spell to attach to it. It remains recorded in the import and is explicitly unmatched. Its appearance does not imply invalidity.

## Unit-scoped supporting references

These page-level links clarify why the *label* is relevant within the cited unit entry; they do not declare the complete army legal.

- Storm Weaver Level 3 upgrade: https://tow.whfb.app/unit/storm-weaver
- Mage Level 1 wizard level and Sea Guard Honour access: https://tow.whfb.app/unit/mage
- Sea Guard Garrison Commander Lothern Skycutter mount: https://tow.whfb.app/unit/sea-guard-garrison-commander
- Lothern Sea Guard command options: https://tow.whfb.app/unit/lothern-sea-guard
- Eagle-Claw Repeater Bolt Thrower equipment: https://tow.whfb.app/unit/eagle-claw-bolt-thrower
- Army composition and BSB option: https://tow.whfb.app/warhammer-armies/sea-guard-garrison

## Importer design safeguards

- All reviewed additions in `docs/catalog.js` have `sourceStatus: 'verified-on-tow'`, `verifiedOn: '2026-11-09'`, and a concrete source URL.
- Entries with specific applicability (e.g., `Level 3 Wizard`, `Sea Guard`, a chariot mount) are matched only against the relevant parent unit names.
- The match engine does **not** independently verify that a character can purchase each honour, item or mount, or that army limits and percentages are respected.
- Regression tests at `tests/reference-audit.test.mjs` assert 17/74/71/3 and verify that all 19 test list fixtures still parse. CI is in `.github/workflows/verify-importer.yml`.

Do not conflate **linked to a source** with **legally permitted**, **correctly costed**, or **fully rules-verified**.

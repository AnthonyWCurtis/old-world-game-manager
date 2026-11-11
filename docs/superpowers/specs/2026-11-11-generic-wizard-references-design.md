# Generic Wizard Rule References — Design

**Date:** 11 November 2026  
**Status:** Approved in conversation: generic rules recognition, with separate character-specific eligibility validation.

## Goal

Resolve imported `Wizard` and `Level 1 Wizard` through `Level 4 Wizard` consistently across army exporters without adding one-off mappings per character. The cited [Wizard rules](https://tow.whfb.app/magic/wizards) and [Levels of Wizardry](https://tow.whfb.app/magic/levels-of-wizardry) establish general names and levels, not eligibility. A [Storm Weaver](https://tow.whfb.app/unit/storm-weaver) is a Level 1 Wizard by default with published upgrades to Levels 2 and 3, but not Level 4.

## Chosen approach

Introduce a narrowly scoped `docs/wizard-references.js` matching pass for exact canonical selection labels, independent of per-unit data. Apply it to new imports and restored saved armies immediately, before network calls. It resolves **general rules identification only**, marking `eligibilityVerified: false` and carrying source URL and evidence. Do **not** treat general matches as legal choices or effective spellcasting levels.

Retain parent-specific published checks in `docs/unit-selection-matcher.js` and allow stronger verified evidence to replace a generic rule reference. An absence of parent-specific proof leaves the generic rules link, *not* a claim of eligibility. Preserve unrelated/manual references and every raw selection, price, quantity and model group.

For the supplied Mark Orgers Final OWB fixture (2,599 points, 17 unit entries), nested `Wizard [Level 3 Wizard]` must resolve the parent `Wizard` link without affecting the published `Level 3 Wizard` selection, point totals or other reference states. Recognition applies offline too.

## Alternatives

- Add global catalogue entries and change catalogue precedence: easy but would alter `parseArmy` outputs and all existing source-scoped test preconditions, conflating the parser's interpretation with rule references.
- Continue adding wizard entries per character: fails to scale and spreads general rules into faction-specific mappings.
- **Chosen:** isolated post-parse rule-index pass, reusable for future generic rules and compatible with existing parser tests.

## Boundaries / tests

- Exact names after Unicode/spacing normalisation, and only kind `wizard-level`. Do not match `Level 5 Wizard`, `Wizard Level 3`, `Wizard's Staff`, `Wizard Apprentice`, or unrelated selections.
- Process nested selections and model-group selections; do not modify descriptors such as `On foot`.
- Respect existing reviewed/manual, parent-specific, and source links; idempotent and repeatedly safe.
- Confirm all four levels link to `/magic/levels-of-wizardry` and `Wizard` links to `/magic/wizards`.
- The UI must distinguish reference recognition from eligibility; link-only matches cannot grant spell ability, upgrades, or cost changes.
- Browser cache/version must be advanced so the deployed site actually picks up the new pass, and CI plus mobile/browser checks must pass before updating `main`.

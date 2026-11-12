# Normal Play focused unit details — design (2026-11-12)

## Context and goal
The compact grouped roster released in PR #53 has a serious usability issue: expanding a unit produces a long uninterrupted sequence of characteristics, all equipment, attacks, defence, item effects and assignments. On an iPhone this is difficult to navigate during a tabletop game.

Make the primary path **army roster → focused unit view → Profile / Attacks / Defence / Effects**, with an always-visible Back to army action. The user approved this visual interaction after seeing the conceptual compact cards and focused unit view. Existing tested data and manual battle controls remain authoritative.

## Recommended design
Keep existing `renderArmyRosterPage` and its real DOM panels, rather than implementing a second profile/rules renderer. A view-only focus layer in `roster-compact-navigation.js` can show only the selected card and its active subpanel while retaining the same actual DOM nodes and event listeners. The roster itself stays compact with key confirmed status chips and one clear Open unit action. Existing **Show details** expansion remains a secondary advanced route for backward compatibility; tapping the card itself opens the focused view.

The focused view uses separate subpanels:
- **Profile:** base model characteristics with one labelled nine-stat tile grid **per model profile** (no blended stats or inferred buffs); a disclosure for the complete original table and a disclosure for Equipment & special rules plus source links and warnings. Missing source profiles stay explicitly unavailable.
- **Attacks:** existing Shooting and Combat panels, including warnings and verified equipment effects. Never calculate dice or assume eligibility.
- **Defence:** existing equipment-only armour, Ward/Regeneration, temporary spells, warnings and source links.
- **Effects:** existing source-scoped effects, wizard spellbook, item use, character assignment and nested attached characters. Nothing is duplicated or stripped.

## View behaviour
- Roster groups and search keep their existing source-driven, persistent behaviour. Display imported names/nicknames, quantities, points and source-backed summary status. Duplicates have distinct controls and identities.
- Selecting a card opens focused detail, hides unrelated roster cards and section labels **visually only**, and retains its original DOM position so existing event handlers and unit IDs continue to work.
- Back returns to the prior search and section-open state without changing battle state. Tabs retain their choice across a unit-specific rerender. The selected unit/tab are stored as view preferences scoped to the exact army and restored after reload/offline use. If the unit no longer exists, return to the roster.
- Legacy Show/Hide details controls remain available but visually subordinate. Focus mode is the primary option.
- Preserve custom renames, manual character assignments, magic states, used-item toggles, and all original selections. No faction-specific logic or new gameplay rules.
- Remain mobile-first: usable 320–956px, >=44px controls, no page-wide horizontal scroll, safe-area, keyboard-focus visible and accessible labels.

## Out of scope
No Guided Play, automatic turn sequencing, attack/damage resolution, effects legality, points checks, source-data changes, or deployment to main without explicit review.

## Acceptance criteria
A compact roster opens a one-unit screen via the card title and Open unit control. Profile/Attacks/Defence/Effects show only their relevant actual panels; profile tiles match the source-provided separate models. Search, duplicates, nickname updates, assignment controls, active effects, page history, service-worker offline restoration and old inline detail access remain functional. The full existing automated suites plus a new focused-screen browser regression pass.
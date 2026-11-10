# v0.5.1 Source-scoped Orc & Goblin reference resolution — Design

**Status:** Agreed in conversation, 2026-11-10

## Intent
Eliminate the five unmatched selection references in the reported Cali cup Orc & Goblin Tribes v0.4.5 import (one Night Goblin Oddnob "Level 4 Wizard" and four Night Goblin Mob "Full Command"), without changing parsed selections, army/unit points, unit counts, army legality status, or inventing rules.

## Scope
Use the existing browser-side, source-scoped resolver in `docs/unit-selection-matcher.js`, and the 581-unit version-pinned JSON snapshot from `tow.whfb.app`. No new backend, scraping, fuzzy matching, or price calculation. The incomplete user-supplied report is not a complete original army fixture.

## Options considered
1. Hardcode the five matches in the importer — simplest, but not reusable.
2. **Chosen:** Extend the existing exact-parent, source-backed resolver — reusable across supported exporters, with negative tests.
3. Match selection labels globally — rejected because it produces misleading green ticks.

## Behavior
- Resolve `Level N Wizard` when the exact parent unit record explicitly contains `Be a Level N Wizard (+X points)` or `May be a Level N Wizard (+X points)`. The source option is a reference, not an independently validated army-cost decision.
- Resolve `Full Command` only when the same source record uniquely includes an explicitly named champion upgrade, a standard-bearer upgrade and a musician upgrade, and the champion title appears as a source model profile. All three components must have unique documented options; unmatched if missing/ambiguous.
- Attach a single source-scoped reference to `Full Command`, with evidence listing the three component upgrades. Do **not** expand the imported selection into additional selection rows, alter reported points or perform legality validation.
- Keep per-occurrence identity for all four Night Goblin Mob instances. Prefer existing reviewed/manual matches over generated references. Repeated resolver runs should not change counts.
- Keep unverified or unsupported situations unmatched (invalid parent URL, missing source records, partial/ambiguous command groups).

## Acceptance
A synthetic five-occurrence regression reproduces the five references using source JSON for Night Goblin Oddnob and Night Goblin Mob: five before, zero after; source links are both real parent URLs; original selection names, source lines, and points unchanged. Independent negative cases remain unmatched. Full `node --test tests/*.test.mjs` and GitHub CI must pass. No change to the user's 2,000-point reported total; independent arithmetic is out of scope.
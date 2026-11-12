# Stage 1 rules coverage implementation plan

**Goal:** Establish the auditable baseline requested by the project lead; no missing gameplay implementation and no merge.
**Architecture:** Offline Node tooling joins the four committed source indexes by canonical URL, preserves source occurrences and variants, and attaches separately reviewed scope-limited implementation evidence. Generated JSON and Markdown are checked for drift in CI. All whole-game denominators remain unknown until catalogue closure, atomic interpretation and interaction enumeration.
**Tech stack:** Existing dependency-free Node ES modules and node:test; existing Playwright mobile/offline checks.
**Spec:** Project lead's Stage 1 request (2026-11-12), reproduced by the goals and constraints below.

## Constraints and design decisions
- Exclusive factual source https://tow.whfb.app; respect robots and access failures; no bulk crawling.
- Existing snapshots retain capture dates; audit date never substitutes for source verification.
- Canonical IDs derive from exact source path (no speculative cross-URL semantic merges). Occurrence labels/values and conditions remain distinct.
- No source link, manual reminder, partial calculation or conditional projection counts as complete.
- Separate rule candidates, contextual pages, source records, catalogue gaps, interpretations, implementations, tests, interactions and imported fixture measurements.
- Fresh checkout and task branch from main fbff8957e25de1bac222a5ca5f63211d2f16b909; no pre-existing user changes.
- Implementation uses existing offline modules; generic runtime and mobile assets remain unchanged.

## Tasks
- [x] Add failing integrity tests: canonical variants, exhaustive provenance, conservative classifications, complete/test evidence gates, unknown denominators, deterministic regeneration and missing-source visibility.
- [x] Add register generator, evidence manifest and JSON/report outputs; validate all pointers and hashes; fail on unsupported claims.
- [x] Independently build imported-fixture selection measurement, with unresolved selections and optional-rule safeguards.
- [x] Write methodology, independent audit findings and dependency-ordered top-20 backlog.
- [x] Run complete Node suite, generation drift check and existing mobile/offline browser checks; independent code/test review and address material findings.
- [ ] Commit, push focused task branch, open PR, inspect CI. Do not merge or begin Stage 2.

## Review focus
False completion from manual/partial support; source dates confused with audit dates; numerical/conditional variants collapsed; unknown FAQs/interactions treated as denominator zero; importer fixtures mistaken for production army telemetry.

## Execution notes
2026-11-12: Baseline 71 test files pass. Independent catalogue and engine auditors engaged. Existing source snapshot counts independently recalculated. Author implements tooling; specialist agent implements fixture adapter and fresh reviewer checks final diff. User explicitly authorised execution through PR, so no intermediate design approval gate is introduced.

Independent review: fixed null-key imported gap identity contamination, interaction validation, omitted evidence/tool/fixture hashes, and manual-only deficit wording. Added tamper tests for deleted catalogue entries, locator/date claims and undated spell verification. Complete runtime/mobile assets remain byte-identical to main.

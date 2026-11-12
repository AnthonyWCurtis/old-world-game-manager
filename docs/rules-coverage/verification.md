# Stage 1 verification record

Baseline: `fbff8957e25de1bac222a5ca5f63211d2f16b909`, latest main fetched again during delivery. Local runtime: Node v24.22.1; CI uses Node 22. No gameplay/runtime assets changed.

## Local checks

- Baseline `node --test tests/*.test.mjs`: 71 files passed, no failures.
- Final `node --test tests/*.test.mjs`: 73 files passed, no failures (71 existing plus two coverage test files).
- `node scripts/build-rules-coverage.mjs --check`: byte-identical register, metrics, Markdown and imported-selection outputs.
- Existing sitemap audit: 0 errors; 272 warnings, including 269 extraction-warning records. Warnings are retained, not waived as mechanical correctness.
- Existing source projector audit: 581 source-extracted records, 3,536 starting special-rule occurrences, 699 manual, 2 conditional inherited, 2,835 reference-only, 322 optional; no structural problems.
- `node tests/unit-data-browser-smoke.mjs`: passed on the existing 390px mobile viewport.
- All 20 existing Verify v1 Game Screen browser scripts passed: tactical site-wide contrast, tactical magic contrast, tactical command, focused unit details, roster long-press reorder, compact roster, v1, stage3, stage4, stage4b, player customization, mobile responsive, known-spell battle, offline stale-cache refresh, game-screen return navigation, touch layout, source special-rule effects, source core-rule effects, effects engine and reported Wood Elf fixes. These include offline cache/reload/recovery regressions. Playwright 1.56.1 and its pinned Chromium were used.

The sandbox initially blocked Chromium/server sockets and test subprocesses; browser checks were rerun successfully outside that process sandbox. The audit tests now compare generated artifacts in-process rather than requiring subprocess launch. No access failures were treated as successful verification.

## Independent review

Separate catalogue and engine auditors recalculated the counts and reviewed the merged PRs. A fresh code/test reviewer found material problems in the new coverage tooling. All were addressed before delivery:

- Unlinked/foreign selections could inherit a source-less gap ID: regression first failed, then passed after null keys were excluded.
- Interaction modes/constituents/code/tests could escape integrity checks: evidence now validates and unknown modes fail closed.
- Test/evidence files, scripts, profiles and example exports lacked hashes: input manifest now includes them.
- The deficit metric excluded manual-only support: it now includes manual entries and separately reports all candidates lacking full implementation.
- Additional tamper tests cover deleted catalogue records, false locators/dates and invented verification dates on undated spells.

Existing gameplay inconsistencies remain documented in audit.md and the dependency backlog. No missing rules were implemented during Stage 1. Source provenance and helper regression tests do not establish exhaustive source interpretation or full mechanics.

## Hosted CI

The PR's live checks are authoritative for hosted CI. `Verify rules coverage baseline` runs the complete Node suite, artifact drift check and existing source/sitemap audits, and uploads the coverage artifacts. Existing mobile/offline workflow runs separately. Final delivery reports the observed CI state; this committed record does not assume an unobserved hosted result.

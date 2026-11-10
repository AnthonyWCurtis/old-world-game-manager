# Repository cleanup audit — 10 November 2026

**Scope:** documentation consolidation and a non-destructive review of GitHub branches, historical build assets and data sources. This is **not** an instruction to delete code, snapshots, archived reports or branches without a separately reviewed decision.

## Completed in this documentation change

- Replace the long top-level README with a concise description of what **v0.5.0 really implements**, the agreed future interactive battle companion, and a phased roadmap.
- Retain the previous README **verbatim** under [PROJECT_HISTORY.md](../PROJECT_HISTORY.md), except for a new archive notice, to preserve historical release notes and links without burying project direction.
- Separate **existing capability** from **agreed target**: offline army-specific caching, source updates, complete game-screen profiles, character assignment, derived saves, buffs and combat are **not** shipped merely because they appear on the roadmap.
- Add this audit so later repository maintenance can proceed against explicit evidence.

## Repository snapshot

- **Repository:** [AnthonyWCurtis/old-world-game-manager](https://github.com/AnthonyWCurtis/old-world-game-manager).
- **Default branch on audit:** `main`, commit `c7834659ae59da9ce745d4cb5e4fa82c27c70c82`; released browser version `v0.5.0`.
- **Open feature PR:** [#19 — v0.5.1 source-matching fixes](https://github.com/AnthonyWCurtis/old-world-game-manager/pull/19), targeting `main`. Its changes are **not part of main** at audit time.
- **Branches present before this documentation branch:** 23, including `main`; the new docs branch makes 24 until merged/removed.
- **Main tree:** 156 tracked entries at the audit commit, including 32 `docs/unit-data/shards/*.json` records.

## Preserve: important live dependencies

| Item | Why it is kept |
| --- | --- |
| `docs/` | GitHub Pages static app and current unit cards. |
| `docs/parser.js`, `docs/army-roster-page.js`, `docs/unit-selection-matcher.js` | Working importer, mobile roster and source-reference identification. |
| `docs/unit-data/` and `data/all-armies-units-json-v1.1` | Pinned source dataset, 581 units, 32 shards. The data branch has **no common ancestor** with `main` when compared; do not remove it as a presumed merged feature. |
| `docs/reference-records/`, `scripts/build-*-reference-index.mjs`, refresh workflows | Automated rules, magic, items and armies URL-index generation. These are useful as future source references even though they are not a complete implemented rules engine. |
| `docs/examples/`, `tests/` | Known importer fixtures and regression coverage. |
| `worker/`, `reports/unmatched/`, reporting workflows | Explicit opt-in unmatched reporting and historical diagnostics. Do not delete a user's submitted report without checking consent/retention policy. |
| `site.tar.gz.base64` and `.github/workflows/unpack-site.yml` | The workflow still explicitly unpacks that archive on changes to `main`. Consider later deprecation, but do not delete one side of a working publishing path. |
| `ANONYMOUS_REPORTING_SETUP.md` | Owner maintenance and recovery instructions for the reporting service. |

## Branch and PR housekeeping

**Do not run bulk branch deletion.** In representative comparisons with `main`, legacy branches such as `feat/army-roster-page-v050`, `feat/army-roster-view-v047`, `feat/game-manager-v0-4-unit-data` and `fix/new-recruit-dwarf-references-v046` were reported as **diverged**, not trivially identical. A branch may contain unique commits even if its feature was later rebuilt or integrated differently.

Before deleting each branch:

1. Identify its associated PR, purpose and unique commit history.
2. Confirm its changes are represented on `main` or intentionally abandoned.
3. Preserve the separately maintained source data branch and any active PR branch.
4. Obtain an explicit deletion decision for named branches; delete only after checking no data or ongoing work would be lost.

**PR #19** is active work, not stale clutter. The README update deliberately documents `v0.5.0` as current and marks `v0.5.1` as pending. Merge coordination is needed because #19 also edits `README.md`. Do not silently merge, close or rewrite PR #19 during repository housekeeping.

## Deferred cleanups (require separate review)

- **Release note consolidation:** Keep `PROJECT_HISTORY.md` as the historical snapshot; future release notes can move into an intentional changelog instead of regrowing the top-level README.
- **Automatic source refresh architecture:** Compare existing live browser cache TTLs with `docs/live-cache-design.md` (the design text references 6h/24h while current `docs/live-source.js` uses 15m/1h). Decide which behaviour is intended before changing either one.
- **Packaging:** Decide whether `site.tar.gz.base64` and its unpack workflow are still needed once the GitHub Pages deployment path has been verified without them.
- **Source duplication:** Inventory reference records, catalogue fallbacks and published unit shards before deleting or merging any data source. Source-linked imports and regression tests depend on them.
- **Unmerged feature branches:** Compare the remaining branches individually before pruning. Source-data branch must be handled as an independent data repository history, not as a merged code branch.
- **Future code modularisation:** Keep this separate from documentation cleanup and the approved product roadmap; no parser, rules, save or combat-engine code was changed as part of this documentation-only PR.

## Verification before merging this documentation change

- Review relative links in the root `README.md` and root `PROJECT_HISTORY.md`.
- Check that the new README does not claim roadmap work is already implemented.
- Verify no code, test, JSON data, workflow, branch or PR was deleted or merged.
- When integrating with #19, resolve any README conflict explicitly so the v0.5.1 release notes remain in the project history and the current version statement matches the deployed build.

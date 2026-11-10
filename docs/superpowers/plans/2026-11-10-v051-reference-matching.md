# v0.5.1 Source-scoped Reference Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recognise published Night Goblin wizard upgrades and full command selections without inventing references or mutating imported rosters.

**Architecture:** Extend the existing `findSourceScopedSelectionReference(unit, record, selection)` matching branches. A published wizard option and a complete source-backed command group yield a parent-scoped reference; all existing error and preservation paths continue to apply.

**Tech Stack:** Static browser JavaScript ES modules, Node.js built-in test runner, version-pinned source JSON, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-v051-reference-matching-design.md`

## Global Constraints
- Factual Warhammer source exclusively `https://tow.whfb.app`.
- Preserve original imported selection text, quantities, duplicate units, source lines, and reported/calculated roster points.
- Source match != legality or independent points verification.
- No global fuzzy matching and no fabricated source URLs.
- Do not merge to main without passing checks and review.

## Review Focus
- Duplicate command options: remain unmatched instead of arbitrarily choosing the first.
- Missing champion model profile: `Full Command` remains unmatched.
- Wrong parent URL or record: no accidental reference leakage.
- Source options absent or malformed: no false positive wizard or command match.
- Repeated resolver execution: no additional selection count or points mutation.

---

### Task 1: Regression tests (RED)
**Files:** Create `tests/orc-goblin-reference-matching.test.mjs`.
**Interfaces:** Call `findSourceScopedSelectionReference(unit,record,selection)` and `applySourceScopedSelectionReferences(army,records)`; load actual JSON using `shardForId()`.
- [ ] Add a synthetic five-entry fixture using the two published parent records, preserving occurrence source lines (5, 11–14).
- [ ] Assert 5/5 selection references are unmatched before resolution, and 0 after; unchanged selection count, raw text, lines, and points.
- [ ] Assert evidence types, stable source URLs, idempotency.
- [ ] Add negative tests for missing/ambiguous command component, missing champion profile, wrong parent URL and unsupported wizard level.
- [ ] Run `node --test tests/orc-goblin-reference-matching.test.mjs`; record expected failures caused by missing resolver behavior.

### Task 2: Parent-scoped resolver changes (GREEN)
**Files:** Modify `docs/unit-selection-matcher.js`.
**Interfaces:** Keep existing exports and reference shape. Add internal `publishedFullCommand(record,selection)` returning evidence only if uniquely sourced; extend existing `optionalWizardLevelOption`.
- [ ] Support precisely documented `Be a Level N Wizard` alongside `May be a Level N Wizard` on the current parent.
- [ ] Require explicit champion title and matching profile plus unique standard bearer and musician options for `Full Command`.
- [ ] Return parent URL, `type:'command'`, `source:'unit-scoped-data'`, `evidence:'published-full-command'` and component evidence without additional imported selection rows.
- [ ] Run new regression test; require green.

### Task 3: Full-suite verification and release notes
**Files:** Modify `README.md`; optionally bump UI version only as a separate release step.
- [ ] Run `node --check docs/unit-selection-matcher.js` and `node --test tests/*.test.mjs`.
- [ ] Verify `git diff` only changes the intended matching/reporting surface and source references.
- [ ] Check CI status and inspect failures if any; request code review.
- [ ] Open a pull request for review; do not merge or deploy automatically.
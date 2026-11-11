# Generic Wizard Reference Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Follow RED→GREEN test verification.

**Goal:** Apply a generic tow.whfb.app reference to imported `Wizard` and Level 1–4 labels while preserving character-specific eligibility checks.

**Architecture:** Post-parse, pre-network reference pass; existing source-scoped matcher may replace the generic link with stronger parent-unit evidence. No import parser rewrite.

**Tech Stack:** Static JS ES modules, Node.js tests, GitHub Actions, GitHub Pages.

**Spec:** [docs/superpowers/specs/2026-11-11-generic-wizard-references-design.md](../specs/2026-11-11-generic-wizard-references-design.md)

## Global Constraints

- Use only `tow.whfb.app` for Warhammer rules.
- Reference identification is not legality or wizard-level eligibility.
- Never change pasted text, chosen upgrades, points, unit counts, or other imported fields.
- Preserve previous verified and manually reviewed mappings.
- Use a release-safe cache bump and automated checks.

## Review Focus

- `Wizard [Level 3 Wizard]` nested OWB import: parent gains Wizards link without touching child reference or 2,599 points.
- One unit's `Level 4 Wizard` recognition does not mean it is a legal upgrade for that unit.
- Unrelated labels such as `Wizard's Staff` or `Level 5 Wizard` remain unmatched.
- Existing independently verified Mage/Archmage source evidence remains available when refreshed.
- Previously saved/offline imported lists use the same generic links, and the cache serves updated modules.

---

### Task 1: Generic rule matcher

**Files:** Create `tests/generic-wizard-references.test.mjs`, `docs/wizard-references.js`.

**Interface:** `matchWizardRuleReference(selection)` returns general reference/null. `applyGenericWizardReferences(army)` returns `{added}`, mutating only selection reference fields and recount statistics.

- [ ] Add tests for names 1–4, Unicode/whitespace, nested/model-group records, invalid levels and labels, precedence, idempotence and original roster preservation.
- [ ] Run tests (expected RED).
- [ ] Implement minimal standalone matcher and safe pass.
- [ ] Run tests and full importer suite (expected GREEN).
- [ ] Commit.

### Task 2: Integration with source-scoped evidence

**Files:** Modify `docs/unit-selection-matcher.js`, `docs/app.js`, tests.

- [ ] Test initial generic match for Storm Weaver, parent-specific source precedence for Mage/Archmage, retained generic when no verified eligibility and saved snapshots.
- [ ] Run focused tests (RED).
- [ ] Allow source-scoped evidence to override only general wizard references; call generic pass after import and restore; improve explanatory note and current debug version.
- [ ] Run focused and all tests (GREEN).
- [ ] Commit.

### Task 3: Cache, browser and deployment

**Files:** Modify `docs/sw.js`, `docs/index.html`, version-key expectations in tests; extend mobile browser test.

- [ ] Add browser smoke case for Storm Weaver's Wizards link, unchanged 2,599 points, and offline reopen. Verify earlier browser assets fail the new check.
- [ ] Precache `docs/wizard-references.js`, increment service-worker cache version and HTML asset query version; update version-dependent test assertions.
- [ ] Run Node test suite, mobile Chromium smoke and GitHub Actions; correct any regression.
- [ ] Merge tested PR to `main`, verify Pages deployment and report actual status.

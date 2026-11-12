# Tactical Command V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one coherent dark tactical mobile interface from importer to saved armies, roster, focused unit and magic without replacing the verified gameplay engine.

**Architecture:** Maintain stable IDs and event wiring, reorganize old page-level content into concise primary and secondary disclosures, change roster navigation to single clear open action, and introduce one distinct V2 design stylesheet scoped by `.tactical-ui`. Retain existing `styles.css` for legacy source panels until subsequent phase; the V2 file is the only new design authority, not an arbitrary patch collection.

**Tech Stack:** Existing static ES modules, HTML/CSS, Node test runner, Playwright mobile GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-12-tactical-command-v2-design.md`

## Global Constraints
- Source truth exclusively tow.whfb.app, no guessed game data, rules or calculations.
- Existing importer/exporters, all saved army and battle state, source links and offline shell must survive unchanged.
- iPhone portrait and landscape, no page-wide horizontal scroll, meaningful focus and >=44px controls.
- No breaking changes to existing DOM IDs required by app logic and regression tests.
- A new PR is not deployed by creating it; merge to main only on explicit user instruction.

## Review Focus
1. Users must reach saved armies after reload/offline on the importer screen without loss of their imports.
2. Character and repeated-regiment cards must have a single visible "open" affordance but fully accessible rename and detailed source profiles.
3. The Army information section must be accessible while not occupying the first battle viewport.
4. Compact roster and Magic tabs must remain usable without CSS hidden parents blocking event handling.
5. Browser accessibility and viewport behaviour must not regress at 320px, 390px, and 956px landscape.

---

### Task 1 — Acceptance test before redesign
**Files:** Create `tests/tactical-command-browser-smoke.mjs`, modify `.github/workflows/verify-v1-browser.yml`.
- [ ] Write a failing Playwright test: tactical shell on importer and battle, one primary open action per roster card, no visible Rename/Show details buttons in list, accessible focused unit rename and tabs, saved/import flow, no overflow and offline mode.
- [ ] Wire new test into CI, verify expected failure on current feature baseline.

### Task 2 — Create tactical shell and hierarchy
**Files:** Modify `docs/index.html`, `docs/app.js`, create `docs/tactical-command.js`.
- [ ] Add Home/Import and Saved Armies jump navigation, usable even when restoring from cached app.
- [ ] Replace large battle hero with concise army identity and a collapsed `Army information` section retaining live dynamic stats/source status.
- [ ] Move version / rule guidance into secondary disclosures without losing any content, preserve original game tabs and accessible semantics.
- [ ] Add live imported-point indicator using existing data, not an inferred cost.

### Task 3 — Redesign unit list and detail hierarchy
**Files:** Modify `docs/army-roster-page.js`, `docs/unit-focus-view.js`, `docs/roster-compact-navigation.js`.
- [ ] Keep all existing profiles/effects/assignment controls; make list row the primary focused-unit action and move personal rename to focused view.
- [ ] Keep original expanded source UI accessible under advanced details, not as a second primary action; section heading and search remain scoped.
- [ ] Preserve search, fold state, explicit custom/official names, duplicate instances and focused restore.

### Task 4 — Single tactical visual system
**Files:** Create `docs/tactical-command.css`, modify `docs/index.html`, `docs/sw.js`.
- [ ] Establish clear tokens, responsive panels, 44px touch controls, consistent action hierarchy, no excessive status chips and source disclosures.
- [ ] Restyle importer, saved list, game shell, folded roster, unit detail, active magic/overview, and source-details as one system.
- [ ] Update service worker shell with new CSS/module and bump cache for offline updates.

### Task 5 — Integration and review
**Files:** Test updates only where intentional UX changed, design/version notes.
- [ ] Run full Node and mobile Playwright suite; fix actual regressions, maintain test coverage rather than weaken assertions.
- [ ] Review diff and scope, document tradeoffs and known follow-ups.
- [ ] Open a ready-for-review PR with test results; do not merge automatically.

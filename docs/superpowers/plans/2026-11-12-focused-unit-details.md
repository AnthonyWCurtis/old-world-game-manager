# Focused Unit Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long-card default navigation with a focused, tabbed Normal Play unit screen, without changing rules or battle state.

**Architecture:** Enhance the existing view-only `roster-compact-navigation.js` to select a real card in its original DOM location, show only that card and route subpanels via the existing DOM. Preserve legacy inline expansion for compatibility and use source base profile cells to render additional read-only tiles in focused view.

**Tech Stack:** Static ES modules, CSS, Node tests, GitHub Actions Playwright mobile browser verification.

**Spec:** `docs/superpowers/specs/2026-11-12-focused-unit-details-design.md`

## Global Constraints
- `tow.whfb.app` is the exclusive factual rules source. Do not add any unverified gameplay or derived profiles.
- Preserve every imported unit instance, duplicate, nickname, spell record and battle-state control.
- Focus UI must not clone existing interactive subpanels or change their event handlers.
- Section preferences, focus/tab preferences and scroll/search behaviour are view-only and scoped to an exact import.
- 320px iPhone portrait / 956px landscape fit, 44px minimum touch controls, no global horizontal scrolling.

## Review Focus
1. A focused Sea Guard with a champion has separate base profile tiles, never one blended effective unit stat.
2. A renamed character keeps their focus, correct alias and functional assignment controls after rerender.
3. Searching duplicate regiments selects the correct imported instance without modifying other instances.
4. Going Back, switching workspace tabs and offline reload preserve appropriate view state without losing battle/session state.
5. Missing source profiles, unusual section names, and zero characters render an honest and usable focused view.

---

### Task 1: Add failing UI tests
**Files:** Create `tests/focused-unit-details-browser-smoke.mjs`; modify `.github/workflows/verify-v1-browser.yml`.
- [ ] Write browser test for selecting a specific unit, showing one focused card and four navigation choices, Profile tiles for both Sea Guard and Sea Master, isolated Attacks/Defence/Effects, returning to roster and preserving a filtered set of duplicate units, and reloading from service-worker offline.
- [ ] Add the new test to the existing full mobile browser CI workflow.
- [ ] Observe the focused browser test fail on the unimplemented feature.

### Task 2: Implement focused unit navigation
**Files:** Modify `docs/roster-compact-navigation.js`, `docs/styles.css`.
**Interfaces:** Existing `decorateCompactRoster(container,army)`, `armySessionKey(army)`; add pure helper functions in navigation module.
- [ ] Add Open unit to every existing card and title click to focus, persistent focus/tab preference and Back to army.
- [ ] Keep real interactive DOM panels in place; show only selected direct child for each view and restore default visibility on Back.
- [ ] Create read-only base characteristic tiles per source table model row with clear source disclaimer and folded full table; collapse verbose loadout only in focus mode.
- [ ] Style focused view and visual compact cards for iPhone portrait/landscape while preserving legacy inline disclosure.
- [ ] Run the new test and fix only defects identified.

### Task 3: Offline and regressions
**Files:** `docs/sw.js`, `tests/source-printed-armour.test.mjs`, `tests/unit-profile-version.test.mjs`, `tests/touch-game-layout-browser-smoke.mjs` if the new behaviour invalidates an old view expectation.
- [ ] Bump offline cache identifier, update exact-identifier regression tests, preserve the existing module pre-cache.
- [ ] Run all 347+ Node tests and every Playwright test in the existing CI workflows on the feature branch.
- [ ] Inspect PR diff, confirm no rules/battle logic changed, then open ready-for-review PR without merging it.

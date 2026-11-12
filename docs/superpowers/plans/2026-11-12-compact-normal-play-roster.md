# Compact Normal Play roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the normal-play army roster searchable, section-collapsible and the default view without touching rules or battle state.

**Architecture:** Keep `renderArmyRosterPage` and its existing cards; a small DOM decorator manages view-only section wrappers, per-army localStorage preferences and current search text. Change only the default tab for new armies, app shell caching and CSS.

**Tech Stack:** Static ES modules, browser DOM, CSS, Node test runner and Playwright browser tests.

**Spec:** `docs/superpowers/specs/2026-11-12-compact-normal-play-roster-design.md`

## Global Constraints
- Do not invent or compute Warhammer rules, points, options or outcomes.
- Preserve original imported army and saved battle/session state.
- Accessible controls and no page-level horizontal overflow from 320px upwards.
- Offline module pre-cache and version-bumped shell cache.

## Review Focus
- Two regiments with identical names must remain independent; search keeps both.
- Missing section/zero characters must leave roster usable, not empty.
- Filtered search must not persist an expanded fold over a prior collapsed group.
- Character alias changes during a battle should be searchable after rerender.
- Reload/offline opening must retain unit expansion, section expansion and saved tab correctly.

---

### Task 1: Prove intended UI behavior (RED)
**Files:** `tests/compact-roster-browser-smoke.mjs`, `tests/game-layout.test.mjs`, `.github/workflows/verify-v1-browser.yml`
- [ ] Write Playwright test for new-armor Units landing, Characters/Core initial visibility, folding, search within folded Special, no-results, reset, per-army preference, attached characters and offline reload.
- [ ] Change layout unit test expectation for new-army default from Overview to Units.
- [ ] Add new smoke test to browser CI.
- [ ] Run tests and observe missing-feature failure.

### Task 2: View-only section filtering and folding (GREEN)
**Files:** `docs/roster-compact-navigation.js`, `docs/army-roster-page.js`, `docs/styles.css`
**Interfaces:** `decorateCompactRoster(container,army,session)`, called after cards are built.
- [ ] Create labelled search, result count, accessible fold buttons and group panels preserving existing cards and DOM IDs.
- [ ] Scope preferences with `armySessionKey(army)` and restore on rerender/reload; do not persist search-induced visibility.
- [ ] Preserve duplicate entries/custom names and filtering when data refreshes.
- [ ] Style for portrait/landscape and touch controls.
- [ ] Run new smoke test and existing browser tests.

### Task 3: Default navigation, offline coverage and regression verification
**Files:** `docs/game-layout.js`, `docs/index.html`, `docs/sw.js`, `tests/touch-game-layout-browser-smoke.mjs`
- [ ] Make Units default for new sessions; preserve existing saved tab.
- [ ] Update initial tab markup, relevant browser assertions, cache manifest and cache name.
- [ ] Run `node --test tests/*.test.mjs` and the existing Playwright workflow across mobile/offline.
- [ ] Commit on feature branch and prepare review PR; do not merge without verification.

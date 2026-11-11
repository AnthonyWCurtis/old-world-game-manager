# Stage 3 Character Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement RED→GREEN tests per task.

**Goal:** Add two-way character-to-unit assignments and autosaved battle state to the v1 Game Screen without modifying imported data.

**Architecture:** Pure `battle-session.js` state functions, isolated `battle_sessions` IndexedDB store, callbacks into existing read-only card renderer, and versioned offline shell.

**Tech Stack:** Vanilla JavaScript ES modules, IndexedDB, Node test runner, Chromium 390px browser smoke, GitHub Pages.

**Spec:** [docs/superpowers/specs/2026-11-11-stage3-character-management-design.md](../specs/2026-11-11-stage3-character-management-design.md)

## Global Constraints
- Source of rules: tow.whfb.app only.
- Character assignments are player-recorded, not legality-verified, and change no imported selections, points or calculated buffs.
- No magic/statistics fabricated.
- Mobile first, offline storage, no page-level horizontal scrolling.

## Review Focus
- Duplicate same-name character/regiment instances retain distinct IDs.
- Several characters can join one regiment; one character cannot join several.
- Saved data containing stale IDs/unknown category cannot create a ghost assignment.
- Reopened old saved import retains imported text and displays saved memberships.
- A failed IndexedDB write must not falsely show "Saved".

---

### Task 1: Domain/session model
**Files:** Create `docs/battle-session.js`, `tests/battle-session.test.mjs`.
**Interface:** `armySessionKey(army)`, `restoreBattleSession(army,row)`, `assignCharacter(army,session,characterId,unitId)`, `charactersForUnit(session,unitId)`.
- [ ] Failing unit tests for distinct IDs, multiple characters, reassignment/removal, invalid targets, immutable roster, restored stale/legacy entries.
- [ ] Run tests RED.
- [ ] Implement pure functions and tests GREEN; commit.

### Task 2: Storage and current-army integration
**Files:** Modify `docs/app.js`; add `docs/battle-session-store.js`; extend persistence tests.
**Interface:** `readBattleSession(key)`, `writeBattleSession(row)` and current state loading, status on successful/failed write.
- [ ] Test independently stored state from legacy imports and reload.
- [ ] Run RED, implement versioned IDB migration to v2 preserving `snapshots` and add distinct `battle_sessions`.
- [ ] Await session restore on import/open; trigger save after assignment; update Game Screen; verify GREEN and old saves.

### Task 3: Mobile Game Screen UI
**Files:** Modify `docs/army-roster-page.js`, `docs/styles.css`, `docs/index.html`; browser test.
**Interface:** Extend `renderArmyRosterPage(container,army,records,fallbackProfiles,session,onAssignment)`.
- [ ] Add RED browser test for character-driven assignment, unit-driven assignment, reassignment, detach, nested profiles, no phantom duplicates.
- [ ] Implement a11y labelled selectors and attached `details`, clear verification disclaimer and source links.
- [ ] Rerender both ends on change and maintain nested-state as possible. Verify GREEN.

### Task 4: Offline/version deployment
**Files:** `docs/sw.js`, app versioned entrypoints, tests, README.
- [ ] RED browser offline saved-list test for persisted membership.
- [ ] Increment cache, pre-cache both new modules and adjust expected release keys.
- [ ] Run all Node tests and both mobile browser suites GREEN.
- [ ] Merge reviewed PR and verify GitHub Pages deployment and production test status.

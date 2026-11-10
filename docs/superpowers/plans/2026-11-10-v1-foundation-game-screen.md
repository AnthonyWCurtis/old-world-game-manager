# v1 Foundation and Game Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live Game Manager v0.5 interface with a reliable v1 foundation and mobile Game Screen for all imported units/characters while preserving source facts and offline list data.

**Architecture:** Reuse the existing 15-layout parser and source-verified unit-data shards. Introduce a tested read-only projection between imported roster and game UI, maintain separation between imported choices, published base reference records and future battle state, and make the game screen the primary post-import experience. Promote to the existing Pages site only after tests, using `archive/v0.5.0-pre-v1` as a recoverable v0.5 snapshot.

**Tech Stack:** Vanilla ES-module JavaScript, HTML, CSS, IndexedDB, static GitHub Pages, Node.js test runner; tow.whfb.app is the exclusive Warhammer reference.

**Spec:** [docs/superpowers/specs/2026-11-10-v1-game-manager-foundation-design.md](../specs/2026-11-10-v1-game-manager-foundation-design.md)

## Global Constraints

- Existing parser supports 15 named layouts across Old World Builder, Ingude, New Recruit, Old World Rankings / Battle Builder.
- Only `https://tow.whfb.app` is authoritative for rules/stats/items/spells.
- Original pasted content, original points, repeated instances and selections are never overwritten by reference updates.
- Missing data remains explicitly missing; a source match does not establish selection legality or rule activation.
- Browser/local cached data is best-effort; users must retain JSON backup/export.
- Protect existing saved-list compatibility and opt-in unmatched reporting.
- The user authorised v1 to replace the live Pages site after verification; do not keep two public applications.
- Do not ship character assignments, automatic buffs, combat results or legality checks as part of Stages 1–2.

## Review Focus

1. **Same-named duplicate units:** both remain independently identifiable, with identical source metadata but distinct model counts/selections.
2. **Character with no section metadata:** retain name/points/options and show uncategorised rather than assigning an invented unit type.
3. **Offline with empty unit-data cache:** parsed units and original selections remain visible and savable; profiles are marked unavailable.
4. **Old saved v0.5 snapshot:** opens without rewriting `original_text` or losing nested options.
5. **Large characteristic table on narrow Safari:** no page-wide horizontal scroll; local table scroll is accessible.

---

### Task 1: Preserve production and establish v1 regression baseline

**Files:**
- Preserve: `archive/v0.5.0-pre-v1` branch (already created from main)
- Verify: `tests/*.test.mjs`, `.github/workflows/verify-importer.yml`

**Interfaces:**
- Consumes: current parser, GitHub Actions.
- Produces: baseline test evidence and recoverable original release.

- [ ] **Step 1: Confirm the archive branch SHA matches the current v0.5.0 production commit.**
- [ ] **Step 2: Run the existing `Verify army importer` workflow.** Expected: `node --test tests/*.test.mjs` passes with no regression.
- [ ] **Step 3: Document any pre-existing failure separately; don't misattribute it to v1.**
- [ ] **Step 4: Commit the design, plan and branch metadata.**

### Task 2: Read-only Game Screen projection

**Files:**
- Create: `docs/game-screen-model.js`
- Test: `tests/game-screen-model.test.mjs`

**Interfaces:**
- Consumes: `parsedArmy` from `parseArmy(...)`, `unitDataRecords: {[unitId]: sourceRecord}`, `fallbackProfiles`.
- Produces: `createGameScreenModel(parsedArmy, unitDataRecords = {}, fallbackProfiles = {})` returning `{army, groups, characters, totals, status}`.
- A group contains `{id, name, section, count, points, selections, modelGroups, profiles, published, links, isCharacter, referenceState}`.

- [ ] **Step 1: Write failing tests** asserting duplicate unit ID preservation, model quantity and point fidelity, missing reference unknown markers, known character-section classification and fallback uncategorised output. Include tests where a source record provides a profile but NOT selection proof.
- [ ] **Step 2: Run `node --test tests/game-screen-model.test.mjs`.** Expected: missing module/test failure.
- [ ] **Step 3: Implement pure `createGameScreenModel` with nullish rather than guessed quantities, referenced source fields and explicitly separate imported selections vs published possible options.**
- [ ] **Step 4: Run tests and existing parser tests.** Expected: pass.
- [ ] **Step 5: Commit projection and tests.**

### Task 3: Accessible mobile-first Game Screen v1

**Files:**
- Modify: `docs/army-roster-page.js`, `docs/index.html`, `docs/styles.css`
- Modify: `docs/app.js` for binding/view refresh
- Test: `tests/army-roster-page.test.mjs`; create `tests/game-screen-render.test.mjs` as needed

**Interfaces:**
- Consumes: `createGameScreenModel`, existing `renderArmyRosterPage(container, army, records, fallback)` and hash route `#army-roster`.
- Produces: a friendly Game Screen with army overview, character and regiment sections, expandable source-backed profiles and link/status panels; retains existing test-visible names, stats and list order.

- [ ] **Step 1: Add failing tests** for zero/one/multiple unit/character display, provenance labels, duplicates, selection retention and missing source info; include the Review Focus narrow-table case in browser smoke.
- [ ] **Step 2: Run new focused tests.** Expected: fail before implementation.
- [ ] **Step 3: Implement clear Game Screen heading, mobile navigation/summary, separate Characters section for known character entries, unit cards showing model counts/points/command/equipment/mounts/rules as pasted, and accessible expandable verified-source data. Retain imported order within groups and original info when labels don't fit categories.**
- [ ] **Step 4: Verify HTML/CSS narrow widths, no global page scrolling and working Back to importer.**
- [ ] **Step 5: Commit Game Screen markup and tests.**

### Task 4: Saved army compatibility and offline-friendly launch

**Files:**
- Modify: `docs/app.js`
- Create: `docs/battle-session.js` only if a distinct, versioned state boundary is needed now; do NOT add future character/combat state logic.
- Modify: `docs/index.html`, `docs/styles.css` only as necessary for status UI.
- Test: `tests/game-screen-persistence.test.mjs`; extend `tests/army-roster-page.test.mjs`.

**Interfaces:**
- Consumes: old saved `{id, original_text, result}` snapshots.
- Produces: opening an existing saved army directly into the Game Screen while preserving existing save/export/backups; add a non-destructive restore path for legacy records, and a visible save/backup reminder.

- [ ] **Step 1: Write failing tests** with historical saved row shapes, repeated units and a source fetch failure; confirm imported choices are unchanged.
- [ ] **Step 2: Run focused persistence tests.** Expected: fail.
- [ ] **Step 3: Add backwards-compatible normalised read projection and Game Screen launch from saved list; avoid mutating persisted `result` or overwriting save until explicit user action.**
- [ ] **Step 4: Run persistence and import tests.** Expected: pass.
- [ ] **Step 5: Commit.**

### Task 5: Offline app shell and safe source-cache behaviour

**Files:**
- Create: `docs/sw.js` and `docs/offline.js` if no service worker exists; otherwise extend the existing app-shell cache
- Modify: `docs/index.html` and `docs/app.js` to register caching safely
- Test: `tests/game-screen-offline.test.mjs`; `tests/unit-data-integration.test.mjs`; mobile browser smoke

**Interfaces:**
- Consumes: static same-origin app assets and source shards cached by `docs/unit-data.js`.
- Produces: repeat offline launch after an online visit, with last-good app shell and already saved unit data; a fresh offline import still shows pasted details even when source details have never been downloaded.

- [ ] **Step 1: Add failing offline browser tests**: online install, reload offline, import new list, open saved list, source-data miss, recover online. Include the Review Focus empty-cache case.
- [ ] **Step 2: Run tests to show missing offline app-shell support.**
- [ ] **Step 3: Implement constrained, versioned same-origin static app-shell caching and update strategy, without caching arbitrary tow.whfb.app pages or overwriting IndexedDB.**
- [ ] **Step 4: Check iPhone Safari limitations explicitly and provide fallbacks/backup guidance.**
- [ ] **Step 5: Commit implementation plus tests.**

### Task 6: Regression, deployment and verified handoff

**Files:**
- Modify: `README.md` only with truthful v1 deployment status after verified release
- Modify: `docs/index.html` and version markers only after tests pass
- Verify: GitHub Actions and deployed GitHub Pages URL

**Interfaces:**
- Consumes: Stages 1–2 changes, current PRs #19/#20, archive branch.
- Produces: a tested live v1 build at `https://anthonywcurtis.github.io/old-world-game-manager/` and recovery directions.

- [ ] **Step 1: Run `node --test tests/*.test.mjs` and focused offline/mobile smoke; compare counts and options across 15 supported fixtures.** Expected: all green.
- [ ] **Step 2: Review PR #19/#20 overlap explicitly; preserve their changes or defer them rather than silently overwriting.**
- [ ] **Step 3: Update the live version and release documentation to reflect verified Stage 1–2 only.**
- [ ] **Step 4: Merge/release the tested branch to `main`, verify Pages resolves to v1 and check at least one imported example on the public URL.**
- [ ] **Step 5: Record the SHA of the live v1 release, CI evidence and how to restore from `archive/v0.5.0-pre-v1`.**

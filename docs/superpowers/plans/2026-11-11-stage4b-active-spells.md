# Stage 4B Active Spells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Use RED→GREEN test cycles per task.

**Goal:** Add player-controlled, source-verified Earthen Ramparts and Glittering Robe effects to the mobile Game Screen with separate scope, manual expiry and offline persistence.

**Architecture:** Small pure spell engine for caster/target eligibility and active-effect projection; independent battle session persistence, isolated DOM controls, and integration into the existing source-linked defence panel.

**Tech Stack:** Browser ES modules/IndexedDB, Node built-in test runner, Playwright Chromium, GitHub Pages.

**Spec:** [docs/superpowers/specs/2026-11-11-stage4b-active-spells.md](../specs/2026-11-11-stage4b-active-spells.md)

## Global Constraints
- tow.whfb.app is the exclusive rules source; no guessed spells/targets/legality.
- A selected spell lore never automatically proves a spell is known or cast.
- Original roster data, choices, model counts, points and reference data remain unchanged.
- Preserve previous session fields/format, including assignments and used Charmed Shields.
- Enchantments expire on caster's next own Start of Turn; never incorrectly label as Remains in Play.
- Never turn Glittering Robe -1 To Hit into an armour/Ward/Regeneration bonus.

## Review Focus
1. Multiple Illusion casters / same name remain distinct by IDs; no unit/spell duplicated improperly.
2. Casting Glittering Robe cancels a previously active Earthen Ramparts on caster's joined regiment, but not a remote unaffected regiment.
3. Reassigning caster mid-effect must not silently grant Glittering Robe to a new regiment; rule applicability becomes conditional.
4. Old saved sessions without `activeSpells` still restore assignments and Charmed Shield usage.
5. Offline reload preserves recorded spells and controls, with no stale shell/module mix or horizontal overflow.

---

### Task 1 — Pure source-backed spell engine
**Files:** Create `docs/spell-engine.js`, `tests/spell-engine.test.mjs`.
**Interfaces:** `SPELL_RULES`; `eligibleWizardSpells(army)`; `activateSpell(army,session,{spellId,casterId,targetId,confirmed})`; `endSpell`; `expireAtNextStartOfTurn`; `sanitizeActiveSpells`; `spellEffectsFor`.
- [ ] Add failing tests for data/rule constants, imported lore + Wizard evidence, confirmation/target validity, immutability, source effects, overlap expiry, cast-time joined-unit snapshot and nonstacking.
- [ ] Run `node --test tests/spell-engine.test.mjs` (RED, missing implementation).
- [ ] Implement pure functions; no network and no guessed eligibility.
- [ ] Run focused and complete Node suite (GREEN); commit.

### Task 2 — Session compatibility and persistence
**Files:** Modify `docs/battle-session.js`, `docs/battle-session-store.js`; create `tests/spell-persistence.test.mjs`.
**Interfaces:** optional version-1 `activeSpells` array; sanitise on read; write copy; retain existing fields.
- [ ] Add RED tests for old v1 saved state, malformed IDs, duplicated effects, Charmed Shield flag + assignment preservation.
- [ ] Implement backwards-compatible restore/store.
- [ ] Run focused and full tests GREEN; commit.

### Task 3 — Game Screen controls + effect panels
**Files:** Create `docs/spell-controls.js`; modify `docs/app.js`, `docs/index.html`, `docs/defence-engine.js`, `docs/army-roster-page.js`, `docs/styles.css`; create `tests/spell-ui.test.mjs`.
**Interfaces:** `renderSpellControls(doc,container,army,session,{onCast,onEnd,onExpire})`, `spellEffectsFor` integration into source-backed defence projections and renderer.
- [ ] Add RED tests for controls, confirmed casting, target selection, active status/expiry, separate spell Ward and -1 To Hit displays.
- [ ] Implement, including manual expiration and source links/labels, without treating lore as known.
- [ ] Run regression tests GREEN; commit.

### Task 4 — Offline browser/release
**Files:** Create `tests/stage4b-browser-smoke.mjs`; update `.github/workflows/verify-v1-browser.yml`, `docs/sw.js`, versioned `docs/index.html`/`docs/app.js` paths and existing version assertions, `README.md`.
- [ ] Add browser smoke and observe missing control RED.
- [ ] Precache new modules and bump to `v1.0.0-alpha.5`; version tests and document limitations.
- [ ] Run `node --test tests/*.test.mjs`, all mobile browser suites and Stage 4B offline checks GREEN.
- [ ] Merge reviewed PR and confirm Pages production deploy + importer checks; document release commit.

# Stage 3 — Character Assignments and Local Battle State

**Status:** Approved by the user on 11 November 2026. User wants both-direction assignment, nested expandable character profiles, persistence and gradual accuracy.

## Goal
After importing an army, a player can associate its individually imported character instances with its regiment/unit instances, from either end. The Game Screen always shows each character in the separate Characters section and, while assigned, as an expandable profile inside the destination unit. Reassigning or detaching is quick on a phone. Assignments survive reloading and reopening the saved import, without modifying the imported list.

## Chosen architecture
Use a small standalone pure battle-session domain module (`docs/battle-session.js`) plus a browser IndexedDB store (`battle_sessions`) distinct from existing saved-import `snapshots`. Key sessions to the exact imported text through a deterministic fingerprint; validate and sanitise all saved IDs on restore. Maintain an in-memory battle session in `app.js` separate from `current` roster and `unitDataRecords` source reference snapshots. Render accessible two-way assignment controls and nested expandable character panels in `docs/army-roster-page.js` by reusing the existing source-backed character body renderer.

**Alternative rejected:** store assignments on imported units or the `result` saved snapshots (would corrupt source provenance and damage migration); **alternative rejected:** perform all joining eligibility checks now (would require a full rule engine and create false assurances from incomplete source extraction).

## Rules and scope
Tow.whfb.app `https://tow.whfb.app/characters/characters-and-units` says most characters can join a friendly unit, multiple characters may join one unit, and restrictions/phase restrictions apply. `https://tow.whfb.app/special-rules/fly` and `https://tow.whfb.app/special-rules/ethereal` show exclusions that depend on currently selected rules/troop types. For Stage 3 all player-chosen assignments are **recorded, not legality-verified** and no game effects, stats, wounds, or points change. Label this visibly and provide rule links; don't automatically mark every regiment eligible or grant buffs.

## Behaviour
- Each character instance can belong to at most one non-character unit at a time; distinct copies of the same character/unit are independent. Several characters can share a unit.
- A character card shows current membership plus an explicit `Assign to Unit` selector (or `Change Unit`/ `Remove` after assignment).
- Each non-character unit shows `Add Character` selector with all imported characters; choosing an already assigned character reassigns it. Attached characters appear in expandable detail panels inside the unit, including their individual published profiles, imported equipment and special-rule references. They remain in Characters.
- Removing or moving instantly updates both views. Preserve expanded source panels where possible.
- No character-to-character assignment, missing IDs, or unclassified entries silently accepted as characters. A unit with no imported Characters section stays workable without assignment UI.
- On each assignment, automatically save a compact, versioned session to IndexedDB. Recover by reimporting the identical army text or opening an earlier saved roster; no save button required for assignments. Do not alter stored imported snapshots. Existing v0.5 lists still reopen.
- If browser storage is blocked, keep the current session in memory and show a visible warning; never pretend it's saved. JSON backup of session is a future improvement unless explicitly added.
- Saving a new/imported army remains a separate user action; session assignment state is not an imported selection.
- An old stored session with references to missing or reclassified units is sanitised; original roster remains unchanged.

## Verification
TDD unit tests cover multiple assignment, reassign, remove, invalid IDs, duplicate names, session fingerprint and stored-state sanitisation. Browser 390px smoke covers both assignment directions, nested profiles, local restoration on reload/reopening saved army, source refresh survival, and no horizontal overflow. Existing parser, unit-data and offline tests remain green. Deploy only after CI green; production v0.5 archive remains accessible.

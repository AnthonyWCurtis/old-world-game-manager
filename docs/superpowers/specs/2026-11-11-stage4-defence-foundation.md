# Stage 4A — Defence Summary and Conditional Protection

**Date:** 2026-11-11
**Status:** Approved Stage 4 scope; incremental first implementation of reliable armour, Ward and Regeneration views.

## Purpose
Add a source-auditable defence panel to every regiment and separate character, including attached characters. Show explicitly **equipment-only armour value**, **conditional Ward saves**, **Regeneration**, and **who actually benefits**. Never turn a selected item into an unqualified or regiment-wide benefit without verified scope. No attacks or saving-throw simulation yet.

## Sources (exclusive Warhammer references)
- Base armour: https://tow.whfb.app/weapons-of-war/armour-value
- Shield +1, cannot use when fighting with a two-hand weapon: https://tow.whfb.app/weapons-of-war/shield
- No armour base 7+ for modifiers: https://tow.whfb.app/weapons-of-war/no-armour
- Armour max 2+: https://tow.whfb.app/weapons-of-war/additional-equipment
- Ward: https://tow.whfb.app/the-shooting-phase/ward-saves
- Regeneration: https://tow.whfb.app/special-rules/regeneration
- General FAQ (Ward saves do not stack; best applicable value; saves must be attempted): https://tow.whfb.app/faq/general-principles
- The Loremaster's Cloak: https://tow.whfb.app/magic-item/the-loremasters-cloak — 4+ Ward **against wounds from Magic Missiles**, wearer and a unit they **joined**.
- Charmed Shield: https://tow.whfb.app/magic-item/charmed-shield — is a shield and **once per game** grants its **bearer** a 5+ Ward against one wound, then ordinary shield.
- Seed of Rebirth: https://tow.whfb.app/magic-item/seed-of-rebirth — grants its **bearer** Regeneration (5+).
- Mathlann's Ire: https://tow.whfb.app/magic-item/mathlanns-ire — defensive combat reroll of a single successful enemy To Hit against wielder; NOT a save.

## Defensive rule design
- **Do not assume the full unit shares characters' armour, wards, regeneration or special rules.**
- Evaluate the **top-level imported equipment** of the regiment/character individually. Known types: light (6+), heavy (5+), full plate (4+), with ordinary/Charmed Shield (-1 to threshold). No confirmation of armour means `not-established`, rather than inventing a save.
- Shield is conditional on the weapon used in combat when a model also has a two-hand weapon. Spell modifiers, enemy AP, mount modifiers, shooting vs melee and other unknown buffs **not** included in equipment-only target numbers.
- For conditional Ward sources show `4+ vs Magic Missiles` for cloak, `5+ once per game` for Charmed Shield. Do not combine wards into a universal Ward value.
- Regeneration from Seed of Rebirth is **bearer only**, 5+.
- The cloak in the supplied OWB fixture is nested under **Sea Master (champion)**, so it is not automatically shared with the Sea Guard regiment: the rule states wearer + a unit they *joined*, and the champion isn't a joining character. Display this champion-specific Ward distinctly with a source/condition note.
- If an **independently imported character**, wearing the cloak, is assigned to a regiment, show the conditional 4+ ward against Magic Missiles for character and joined regiment as a **joining-dependent conditional effect**; remind that Stage 3 does not verify join legality.
- No generic automatic conversion of source-extracted `startingEquipment` or `optionalRules` into an active item/armour benefit unless explicitly selected in import; unimplemented magic armour, mounts, spells, special rules and conditional saves remain unverified, not silently computed.
- Charmed Shield consumption: include a manual player toggle in character panels, saved separately in battle session. Remaining charges persist across reloads; the player's declaration is needed, no automatic wound tracking.
- Show source links and status `Verified formula / contingent input` rather than claiming a fully verified effective save.
- Spell effects, including Earthen Ramparts, require confirmation of the **actual spell known**, the target and duration; a selected magic lore alone does not activate a spell. No automatic spell toggles in 4A. This should be Stage 4B.

## Architecture
`docs/defence-engine.js` is pure and testable. Given roster, player session and an exact unit instance ID, return distinct projections for regiment base models, any champion-item selections and attached character instances. Each effect records `saveType`, target number, conditions, scope, source URL and whether it is conditional/consumed. The UI is a read-only panel except an explicit per-character Charmed Shield use toggle that updates session, not roster.

Add `usedCharmedShields` to `battle_sessions` schemaVersion 1 with backward-compatible default `{}`; the record is keyed to character instance ID, never to name. Do not change imported snapshots.

## Test and release gates
- Nested champion cloak is not regiment-wide; character cloak is conditional unit-wide on assignment; detach removes conditional unit-wide benefit.
- Character Charmed Shield 5+ one use and 4+/5+ armour as applicable, expend/restore persists but armour still gets shield bonus; character Seed of Rebirth 5+ regen bearer only.
- Base Sea Guard 5+ equipment armour before modifiers; no automatic Ward or Regeneration; Ship's Company light 6+.
- No armour/no shield does not manufacture a 7+ Armour Save as a usable save.
- All 15 importer formats unaffected, 2,599 points unchanged; offline save restores conditional statuses.
- Node regression and 390px mobile Chromium tests green. Existing v0.5 snapshot remains recoverable in archive branch. GitHub Pages promotion only on green checks.

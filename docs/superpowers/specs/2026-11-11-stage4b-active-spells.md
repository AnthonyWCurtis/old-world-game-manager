# Stage 4B — Active Enchantment Tracking (Earthen Ramparts & Glittering Robe)

**Date:** 2026-11-11  
**Status:** User explicitly approved Stage 4B implementation  
**Release target:** v1.0.0-alpha.5, existing public GitHub Pages URL

## Verified source rules

All Warhammer factual data exclusively from tow.whfb.app:

- [Earthen Ramparts](https://tow.whfb.app/spell/earthen-ramparts): Elementalism Enchantment, casting value **9+**, range **15"**, target friendly unit. Until **the casting player's next Start of Turn sub-phase** the target gains **5+ Ward against any wounds**, counts as behind a defended low linear obstacle if charged, and cannot **march or charge**. FAQ notes compelled charge *declarations* still occur but cannot move; Counter Charge is unavailable. https://tow.whfb.app/faq/lores-of-magic
- [Glittering Robe](https://tow.whfb.app/spell/glittering-robe): Illusion Signature Enchantment, casting value **8+**, range **Self**, until caster's next Start of Turn: enemies take **-1 To Hit** against caster and a unit they have joined. Casting immediately expires prior Enchantments affecting **any affected model**.
- [Spells affecting joined characters](https://tow.whfb.app/characters/spells-characters): a joined character gains existing whole-unit spell effects and a unit joined by a character under an applicable spell gains effects.
- [Range Self spells](https://tow.whfb.app/magic/range-self-spells): target the caster, no separate target.
- [Casting](https://tow.whfb.app/magic/casting-spells): Enchantments cast in the Conjuration sub-phase; the caster must actually know the spell, and spell eligibility, casting success/range and phase must not be inferred from an imported lore.
- [Enchantment](https://tow.whfb.app/magic/enchantment): same spell applied multiple times to a unit in a turn has no further effect.
- [Spell duration](https://tow.whfb.app/magic/spell-duration) and [FAQ](https://tow.whfb.app/faq/magic): duration and non-cumulative spells, joined wizard rank/eligibility restrictions.

## User experience

- Accessible **Magic & active effects** area on Game Screen. List candidate spell casters only when they are imported **Wizard** characters whose import explicitly specifies the relevant lore: Elementalism for Earthen Ramparts; Illusion for Glittering Robe. The import's lore does NOT prove the wizard knows the spell. Each activation requires deliberate confirmation by user that the wizard knows it, that casting was successful and that range/phase/target were valid.
- Earthen Ramparts: player chooses one friendly **regiment** from this import as target; activate to show **5+ conditional Ward (all wounds)** on that regiment and attached characters, plus warnings `cannot march/charge` and `defended obstacle when charged`; do not alter armour, base stats, points or stored roster.
- Glittering Robe: **Self**, no arbitrary target selector; activation uses caster and the regiment currently joined at the moment of casting, if any. Show **-1 enemy To Hit** in an **attack-modifier panel**, never as Armour/Ward/Regeneration. Explicitly explain other pre-existing Enchantments affecting those models expire. If caster moves regiments mid-effect, do **not** silently retarget: withhold joined-regiment benefit and show a re-evaluation warning. Joining legality itself remains unverified.
- Casting Glittering Robe on an active Earthen Ramparts affected joined regiment expires the Ramparts spell. Neither spell is labelled `Remains in Play`; the stored active status is a player assertion until manually expired.
- **End / Dispel** action per active instance; **Next Start of Turn** action (the player invokes it at the caster's applicable next Start of Turn) expires tracked effects of these spells. Avoid automatic turn advancement without a verified phase state.
- Save active spell state in existing IndexedDB `battle_sessions`, preserving older session rows, character assignments, used Charmed Shield flags and original roster. Validate on reload; remove or ignore corrupted IDs and unsupported spells.
- Preserve per-character instance IDs and distinct repeated units. No buffs from an unselected lore, no fabricated learned spells, no effects if no user activation.
- Show source links, source verification date (2026-11-11), casting/range/duration, and a player-declared status. Clear warnings when a character is attached illegally or target distance/fighting rank is unknown.
- Multiple active spells/casters allowed when source rules permit; same enchantment on same recipient never adds bonuses twice. Do not turn independently conditional Ward saves (Charmed Shield, cloak, etc.) into stackable additive modifiers. Ward entries remain sources with conditions and the standard best-applicable rule; no full attack-specific save engine yet.
- No automatic spell generation, dispel calculation, range measurement, dice, combat/attack calculations, advanced stacking or full spell registry in Stage 4B. Later stages can add more spells using this extensible interface.

## Data interfaces

- `docs/spell-engine.js` independent pure domain: `SPELL_RULES`, `eligibleWizardSpells(army)`, `activateSpell(army,session,{spellId,casterId,targetId,confirmed:true})`, `endSpell(army,session,spellId,casterId)`, `expireAtNextStartOfTurn(army,session)`, `sanitizeActiveSpells(army,records)`, `spellEffectsFor(army,session,unitId)`. No battle-session import (prevent circulars).
- In `docs/battle-session.js`, optional `activeSpells` array with strict sanitisation on restore. `docs/battle-session-store.js` snapshots spell records independently.
- `docs/defence-engine.js` incorporates source-backed spell Ward and attack-modifier/movement rules in **separate** lists and member projections; attached character effects marked `joining conditional`.
- `docs/spell-controls.js` builds DOM with `createElement`, never `innerHTML`, and callbacks `onCast/onEnd/onExpire`; Game Screen insertion point `#spellControlPanel`.
- Existing `docs/app.js` is orchestration only; do not duplicate spell mechanics in rendering code. Version app shell to alpha.5 and precache new static modules.

## Acceptance gates

- TDD tests for caster detection, unsupported lore, manual confirmation, range/self target, overlap cancellation, turn expiration, multiple caster and target IDs, invalid saved state, immutable points/choices, old session backward compatibility.
- Tests for Earthen Ward (5+, all wounds), no march/charge and defended obstacle; dynamic joined character conditional application; Glittering -1 To Hit only; rejoin changes cause warnings rather than guessed retargeting.
- Mobile 390px browser smoke imports 2,599-point sample, assigns Illusion Mage to Sea Guard, activates Ramparts from Storm Weaver then Glittering from Mage, observes Ramparts expiration, verifies -1 To Hit not Ward, manually expires effects, reactivates and verifies persistence through offline reload; no horizontal page overflow.
- All existing Node, data/browser and offline tests green before PR merge; inspect live Pages deployment after merge.

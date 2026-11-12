# Warhammer: The Old World — Game Manager

**An offline-first army-list manager, growing step by step into an interactive tabletop battle companion.**

[Open Game Manager](https://anthonywcurtis.github.io/old-world-game-manager/) · [Project history](PROJECT_HISTORY.md) · [Rules source: tow.whfb.app](https://tow.whfb.app)

**v1.0.0-alpha.5 preview:** Stages 1–3 provide imports, character assignments and offline saved battle state. Stage 4A covers limited equipment-only armour, conditional Ward/Regeneration and Charmed Shield use. **Stage 4B** adds manually confirmed **Earthen Ramparts** (5+ Ward and movement restrictions) and **Glittering Robe** (−1 enemy To Hit), their duration, overwriting of affected Enchantments, and persisted expiry/dispels. Automated casting, all other spells and combat remain future milestones. The previous v0.5.0 release is backed up at [`archive/v0.5.0-pre-v1`](https://github.com/AnthonyWCurtis/old-world-game-manager/tree/archive/v0.5.0-pre-v1).

> **Important:** At present this is a roster importer and viewer, **not** a combat calculator or army-legality checker. Source links and extracted profiles do not prove a selection is legal or correctly costed.

## Owner report dashboard (activation required)

An owner-only **Report Admin** dashboard has been implemented in the existing Cloudflare Worker, ready for GitHub OAuth activation. After the owner registers an OAuth app and sets the private Cloudflare secrets, the dashboard is accessed at:

**https://old-world-unmatched-reports.oldworldcompanion.workers.dev/admin**

It reads the real public submissions under [reports/unmatched](reports/unmatched), displays source links, source lines, faction, exporter and reported selections, and records review status and source/PR evidence separately in [reports/admin/reviews.json](reports/admin/reviews.json). It does **not** receive full army lists, and marking an issue reviewed does not alter the app's rules catalogue. The reports and review notes are public on GitHub.

**This is not live login functionality until the Cloudflare Worker is redeployed with a configured GitHub OAuth app.** See [Admin setup and deployment](ANONYMOUS_REPORTING_SETUP.md#owner-only-report-admin-new) for the exact callback URL and secret setup. The existing public reporting flow remains separate.

## The long-term goal

A player should be able to paste an army list and then use a clear, mobile-friendly **Game Screen** for the duration of a Warhammer: The Old World battle:

1. **Import the original list** without losing unit identities, duplicate regiments, model counts, point values, command, weapons, armour, mounts, magic items, magic and other selections.
2. **View every unit** on a dedicated game screen. Display its imported details and, where verified references are available, its model/character characteristics, equipment, special rules and source links.
3. **Assign characters to units** either from the character card (**Assign to Unit**) or from a regiment (**Add Character**). Show the characters inside the regiment as expandable profiles and keep them accessible in a separate character list. Allow assignments to be removed or changed, subject to applicable rules.
4. **Show effective unit characteristics and defensive saves** once the calculation engine is implemented: armour, Ward and Regeneration saves, with sources and conditions kept distinct.
5. **Calculate attacks** incrementally and accurately for ordinary models, champions, characters, mounts, weapons, shooting and melee.
6. **Apply verified effects** from joined characters, banners, special rules, magic items, spells and temporary buffs to the eligible recipients only, then recalculate when the game state changes.

The screen should work well on a phone at the table and preserve the player's battle state. This is a **development target**, not a description of functionality already shipped.

## What works in the v1 preview

| Capability | Status |
| --- | --- |
| Paste and parse exported army lists | **Implemented** — 15 named layouts across four exporters |
| Preserve original input, selections, duplicates, model groups and imported points | **Implemented** |
| Detect export format, flag ambiguities and provide manual format selection | **Implemented** |
| Dedicated **Enter Game Screen** after import | **Implemented in v1 preview** — character and regiment sections; read-only profiles |
| Display imported units, model quantities, imported points and selections | **Implemented**, when present in the export |
| Display published **base** model profiles (M / WS / BS / S / T / W / I / A / Ld) | **Implemented when source data is available**; selected modifiers are not applied |
| Show published equipment/rule references and link to source unit pages | **Implemented for available source records**, not a complete offline rules library |
| Generic Wizard and Level 1–4 Wizard source links | **Implemented** — recognised as general rules, independently of character legality; stronger verified unit evidence may refine the link |
| Save and reopen imported rosters; export/backup JSON | **Implemented** — saved rosters reopen in Game Screen; character assignments auto-save in separate local storage keyed to the imported army text |
| Cache the app shell and previously visited unit references | **Implemented as best-effort offline caching** after an online visit; browser storage and source coverage still limit availability |
| Identify unmatched references and optionally submit an anonymous report with consent | **Implemented** |
| Automatic complete army-specific offline reference packs | **Planned** |
| Fully automatic source-data refresh and seamless background download | **Planned**; existing limited live-cache checks and repository index refreshes are not this complete workflow |
| Character-to-unit assignments and expandable attached character profiles | **Implemented**, player-recorded only; eligibility not yet verified |
| Equipment-only armour, conditional Ward and Regeneration summaries | **Implemented for the explicitly supported selected equipment/items** — not a universal save engine; scopes and source URLs shown |
| Once-per-game Charmed Shield use tracking | **Implemented** — manual toggle persisted with character battle state |
| Earthen Ramparts and Glittering Robe (Stage 4B) | **Implemented as manual, player-confirmed enchantments** with source, scope, duration, interaction, individual ending and offline persistence |
| Other spells, automatic casting, attack-specific saves, shooting and combat calculations | **Planned — not implemented** |

### Importing an army

1. [Open the browser app](https://anthonywcurtis.github.io/old-world-game-manager/) and paste a list or select a bundled example.
2. Review the detected exporter and layout. Change the format manually if necessary.
3. Select **Analyse import**, then **Enter Game Screen** to open the full-page characters-and-regiments view and their defensive summaries.
4. Inspect imported options, published profiles and the **Defence summary**. Expand *Sources, scope and conditions* to see why each save applies. For a Charmed Shield, tick **already used** once its single-use Ward has been spent.
5. Select **Save on this device** from the Game Screen or importer, or **Backup all JSON** for a portable copy.

**Supported sources:** Old World Builder (six text/Discord layouts), Ingude (three), New Recruit (three) and Old World Rankings / Battle Builder (three). See the historical [export-format details](PROJECT_HISTORY.md#supported-army-list-exports).

## Proposed development order

We will implement small, separately tested improvements rather than add a large, unverified rules engine all at once.

| Stage | Deliverable | Acceptance principle |
| --- | --- | --- |
| **1. Reliable imports and data model** | One normalised representation for all supported exporters, retaining original text, provenance, quantities, selections and unresolved information | No guessed attributes, silently lost selections or changed points |
| **2. Complete game-screen roster** | Clear unit and character cards with model profiles, command, weapons, mounts, rules, counts and equipment where sourced | Every displayed fact comes from the pasted list or identified source; unknowns are marked |
| **3. Character assignments and offline persistence** | Assign/remove characters from either direction, view nested character profiles, save/restore unit membership and battle state | Reassignment keeps both views consistent and never duplicates a character |
| **4. Derived profiles, saves and buffs** | Separate base attributes, equipment changes, character-only abilities, unit-granted rules and temporary effects | Every calculation has explicit scope, conditions, source and regression tests |
| **5. Attack and combat calculations** | Verified model/champion/character/mount/weapon attacks, shooting and melee workflows | Test each rule and interaction against tow.whfb.app before enabling it |

We will review design and UI together before each stage. **No combat result should be presented as verified until the underlying rules and tests support it.**

## Data and offline strategy

The pasted **army list**, the **reference data**, and the **live battle state** are separate:

- **Imported army:** what the exporter actually supplied, including the original text, selected upgrades and its reported prices. It must not be rewritten by rule updates.
- **Reference layer:** published unit profiles, characteristics, rules links and eventually structured effects, with original source URL, retrieval/version metadata and verification state.
- **Battle state:** character assignments, casualties, selected spells, active effects, turn/phase and other player actions, stored separately from the imported list and source definitions.

We are **keeping** the existing source-linked unit data and indexes for now: later calculations need reliable structured reference information. Deleting them in favour of links alone would lose the offline foundation. We can simplify or replace the storage implementation **after** the replacement passes data-preservation and offline tests.

**Agreed target:** import any list offline, immediately retain its pasted contents, then fetch and cache **only the references relevant to that army** when connected. Reuse previously downloaded data, include applicable spell lores for its wizards, and automatically refresh valid source changes. If offline data is missing, show that honestly and complete it later without damaging the roster. Failed or unverified source updates must preserve the last usable data. The site source's access and content-reuse permissions must be respected.

**Current reality:** the site already has a small unit index plus 32 version-pinned JSON shards containing 581 extracted unit records from 19 army indexes. Only shards needed for recognised roster units are requested and cached where browser storage permits. The source snapshot contains **269 unit records flagged for extraction review**; source-extracted is not equivalent to a verified gameplay effect. Other repository reference indexes mostly contain **titles and URLs**, not complete rules effects. See [reference collection notes](docs/reference-records/README.md), [source cache design](docs/live-cache-design.md), and [archived technical background](PROJECT_HISTORY.md#v04--versioned-source-backed-unit-details).

**Assignment recovery:** Character memberships are stored automatically in IndexedDB under a key derived from the exact pasted army text. Reimporting the **identical export** or opening a saved copy restores them on that device. Editing the export text creates a new session. Clearing browser storage loses the memberships; the current JSON army export/backup does **not** include battle-session assignments. Browser private mode may discard the store. Check the Game Screen saving-status message before closing.

**Source of truth for Warhammer rules:** [tow.whfb.app](https://tow.whfb.app). Do not invent missing characteristics, point costs, restrictions, item effects, spell eligibility or rule interpretations. Source-content caching and reuse must be compatible with its access permissions.

## Stage 4A protection scope

The Game Screen calculates **selected-equipment armour values** for explicitly recognised light/heavy/full plate armour and shields, **before** enemy Armour Piercing, weapon-use restrictions, magic and other modifiers. An unknown armour selection remains *not established*; unarmoured 7+ is not presented as an available saving throw.

Ward and Regeneration have **separate, conditional records**, not a single combined save. A Charmed Shield is a bearer-only, single-use 5+ Ward against one wound; it remains a shield for armour when the once-per-game Ward is spent. Seed of Rebirth is bearer-only Regeneration (5+). The Loremaster's Cloak gives a 4+ Ward **only against Magic Missiles** to its bearer and, when the bearer is an independently joined character, conditionally to the unit they have joined. The Cloak selected for the Sea Master champion in the Old World Builder sample is shown as **champion-only**, not a free regiment-wide Ward. See [defence scope design](docs/superpowers/specs/2026-11-11-stage4-defence-foundation.md).

**Still unresolved:** combat-specific effective armour vs AP/weapon choice, unrecognised magic armour and abilities, mounted model combinations, spell activation/expiry (including Earthen Ramparts), combat save resolution and joining eligibility. All protection data remains separate from the imported unit characteristics and points. Usage and assignments are saved on this device, not in the roster JSON backup.

## Stage 4B — Manually tracked enchantments

The **Magic & active effects** section identifies imported Wizard characters with the appropriate lore. Selecting **Elementalism** or **Illusion** does **not** establish which spells the Wizard actually knows. Before recording a cast, the player must confirm that the Wizard knows the spell, successfully cast it, and valid phase, range and target restrictions were met. The app does not roll casting dice, measure table distance, check front-rank eligibility or determine dispels.

- **[Earthen Ramparts](https://tow.whfb.app/spell/earthen-ramparts):** 9+ Enchantment, range 15", target friendly unit. Displays a **5+ Ward against all wounds**, a defended obstacle when charged, and **cannot march or charge**. The FAQ clarifies compelled charge declarations and Counter Charge; this interface does not enforce those movement decisions.
- **[Glittering Robe](https://tow.whfb.app/spell/glittering-robe):** 8+ Enchantment, range Self. Displays **−1 enemy To Hit** against the caster and a joined unit, **not** an armour or Ward bonus. Recording its casting ends older active Enchantments affecting any affected model, including an earlier Earthen Ramparts on the joined regiment. If the caster moves units, the app does not silently grant protection to the new regiment; it warns that applicability needs checking.
- Both effects ordinarily last until your **next Start of Turn sub-phase**, and are **not** Remains in Play spells. Choose **End / dispelled** to end an individual spell, or **Expire at my next Start of Turn** when the correct player phase arrives. No silent time-based expiry occurs.
- [Spells affecting joined characters](https://tow.whfb.app/characters/spells-characters) can also extend a whole-unit effect to attached models, but **joining legality remains player-controlled and unverified**. These conditional effects are never added to an unrelated character.
- Active spell records are saved in the existing **battle_sessions** IndexedDB store alongside character assignments and spent Charmed Shields, keyed to the exact army import. The exported roster JSON does **not** yet include battle session state.

**Not yet supported:** other enchantments, automatic spell knowledge/generation, dice, dispel mechanics, automatically validating rank/phase/range, combat-effective save resolution, full magic effect interaction and turn automation. The rules register is intentionally small and auditable.

## Accuracy principles

- **Recognised ≠ legal:** a matched reference identifies an option; it does not certify list legality, army composition or points.
- **Wizard rule link ≠ eligible Wizard level:** `Wizard` links to [Wizards](https://tow.whfb.app/magic/wizards) and `Level 1 Wizard`–`Level 4 Wizard` to [Levels of Wizardry](https://tow.whfb.app/magic/levels-of-wizardry); only individually verified character pages establish available levels and upgrades.
- **Base ≠ effective:** published base profiles must not be silently replaced with equipped, buffed or mounted values.
- **Scopes matter:** a character's personal save or special rule cannot automatically become a unit-wide effect. Only verified rules establish the recipient and duration.
- **Unknown ≠ invalid:** preserve unmatched or incomplete selections and show their uncertainty.
- **Provenance matters:** track exact tow.whfb.app links and verification/version state. Preserve the original imported text and distinguish player choices from published options.
- **Offline first:** parsing must never fail just because live references are unavailable; cached data is a convenience, not a prerequisite for retaining the pasted list.

## Repository and developer guide

| Location | Responsibility |
| --- | --- |
| [`docs/`](docs/) | Static mobile website; the GitHub Pages publication directory |
| [`docs/parser.js`](docs/parser.js) | Multi-exporter parsing and data normalisation |
| [`docs/army-roster-page.js`](docs/army-roster-page.js) | Mobile Game Screen with two-way character assignments and nested published profiles |
| [`docs/unit-data.js`](docs/unit-data.js) and [`docs/unit-data/`](docs/unit-data/) | Version-pinned source-backed unit index, shards and browser caching |
| [`docs/unit-selection-matcher.js`](docs/unit-selection-matcher.js) | Conservative, source-scoped upgrade reference matching |
| [`docs/reference-records/`](docs/reference-records/) | Source-indexed reference collections, primarily names and links |
| [`docs/game-screen-model.js`](docs/game-screen-model.js) and [`docs/army-state.js`](docs/army-state.js) | Read-only source/roster projection and legacy saved-army restoration |
| [`docs/defence-engine.js`](docs/defence-engine.js) | Source-verified limited equipment-only and conditional armour/Ward/Regeneration calculations |
| [`docs/spell-engine.js`](docs/spell-engine.js) and [`docs/spell-controls.js`](docs/spell-controls.js) | Player-confirmed enchantment lifecycle, scope, UI, rule links and manual expiration |
| [`docs/sw.js`](docs/sw.js) and [`docs/offline.js`](docs/offline.js) | Versioned offline app-shell cache and best-effort registration |
| [`docs/battle-session.js`](docs/battle-session.js) and [`docs/battle-session-store.js`](docs/battle-session-store.js) | Assignment rules and separate automatically saved IndexedDB battle-session store |
| [`tests/`](tests/) | Parser, matching, offline, integration and mobile browser regression tests |
| [`.github/workflows/`](.github/workflows/) | CI, source indexing and deployment-related automation |
| [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md) | Earlier version notes, source-collection decisions and debugging history |
| [`docs/REPOSITORY_CLEANUP.md`](docs/REPOSITORY_CLEANUP.md) | Non-destructive GitHub cleanup audit and follow-up actions |

The app is built with **static HTML, CSS and JavaScript**. Node.js supports tests and repository tooling; normal imports do not require an app server. Optional anonymous unmatched reporting uses a separate Cloudflare Worker and requires explicit user consent.

Run from the repository root:

```bash
node --check docs/app.js
node --check docs/live-source.js
node --test tests/*.test.mjs
```

For the latest test status, use [GitHub Actions](https://github.com/AnthonyWCurtis/old-world-game-manager/actions). Do not merge code or publish a new build based only on a previous successful test run.

## v1 preview release limits

The v1 Stage 3 milestone records character memberships without pretending to check legality or apply special rules. The Character section and each regiment show synchronised assignment controls. Multiple characters may be recorded in one unit, and each character is assigned to at most one unit. Each attached character expands to show their separate imported selections and available published **base** characteristics. Character joins, moves and removals do **not** affect imported points, equipment or stats. Review [Characters & Units](https://tow.whfb.app/characters/characters-and-units), [Fly](https://tow.whfb.app/special-rules/fly) and [Ethereal](https://tow.whfb.app/special-rules/ethereal) when checking legality.

The Service Worker caches the static app shell for offline relaunch after the initial online visit; source unit shards must already be cached to show their statistics offline. Browser storage may be evicted, so keep a JSON backup. This cache does not mirror full tow.whfb.app rules pages or make unverified source-extracted facts authoritative.

## Privacy, backups and limitations

Imported army lists are parsed in the browser and are not automatically uploaded. Saved lists are local to the browser/device, may disappear when browser storage is cleared and are **not** yet synchronised across devices. Use JSON backup/export when the roster matters. Opt-in unmatched reports contain limited reference context, not an automatic upload of the full list.

**Not yet available:** automatic join-legality verification, full spell lore coverage, automatic casting/buff validation, full offline rules text, combat-effective saves, attacks, combat resolution, independent points validation or army legality validation. These remain future stages rather than claims about the current site.

This is a fan-made project, not an official Games Workshop product.

## Stage 1 rules coverage baseline

See [coverage report](docs/rules-coverage/report.md), [methodology](docs/rules-coverage/methodology.md), [audit](docs/rules-coverage/audit.md) and [dependency-ordered backlog](docs/rules-coverage/backlog.md). Rebuild with `node scripts/build-rules-coverage.mjs`; verify with `node scripts/build-rules-coverage.mjs --check`. Source indexing, manual reminders and partial calculations are separate from complete implementation; a whole-game denominator is not yet established.

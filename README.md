# Warhammer: The Old World — Game Manager

**An offline-first army-list manager, growing step by step into an interactive tabletop battle companion.**

[Open Game Manager](https://anthonywcurtis.github.io/old-world-game-manager/) · [Project history](PROJECT_HISTORY.md) · [Rules source: tow.whfb.app](https://tow.whfb.app)

**v1.0.0-alpha.2 preview:** Stages 1–2 introduce a mobile Game Screen, separate character/regiment sections, legacy saved-roster opening and best-effort offline app-shell caching. Character joins, calculated effects and combat are still future stages. The previous v0.5.0 release is backed up at [`archive/v0.5.0-pre-v1`](https://github.com/AnthonyWCurtis/old-world-game-manager/tree/archive/v0.5.0-pre-v1).

> **Important:** At present this is a roster importer and viewer, **not** a combat calculator or army-legality checker. Source links and extracted profiles do not prove a selection is legal or correctly costed.

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
| Save and reopen imported rosters; export/backup JSON | **Implemented** — save from Game Screen or importer, open a saved roster into Game Screen; battle state is not auto-saved yet |
| Cache the app shell and previously visited unit references | **Implemented as best-effort offline caching** after an online visit; browser storage and source coverage still limit availability |
| Identify unmatched references and optionally submit an anonymous report with consent | **Implemented** |
| Automatic complete army-specific offline reference packs | **Planned** |
| Fully automatic source-data refresh and seamless background download | **Planned**; existing limited live-cache checks and repository index refreshes are not this complete workflow |
| Character-to-unit assignments, effective buffs, derived saves and attack calculations | **Planned — not implemented** |

### Importing an army

1. [Open the browser app](https://anthonywcurtis.github.io/old-world-game-manager/) and paste a list or select a bundled example.
2. Review the detected exporter and layout. Change the format manually if necessary.
3. Select **Analyse import**, then **Enter Game Screen** to open the full-page characters-and-regiments view.
4. Inspect imported options and any available published unit profiles. Expand the source references or follow the links when needed.
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

**Source of truth for Warhammer rules:** [tow.whfb.app](https://tow.whfb.app). Do not invent missing characteristics, point costs, restrictions, item effects, spell eligibility or rule interpretations. Source-content caching and reuse must be compatible with its access permissions.

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
| [`docs/army-roster-page.js`](docs/army-roster-page.js) | Read-only mobile Game Screen with separate character/regiment sections |
| [`docs/unit-data.js`](docs/unit-data.js) and [`docs/unit-data/`](docs/unit-data/) | Version-pinned source-backed unit index, shards and browser caching |
| [`docs/unit-selection-matcher.js`](docs/unit-selection-matcher.js) | Conservative, source-scoped upgrade reference matching |
| [`docs/reference-records/`](docs/reference-records/) | Source-indexed reference collections, primarily names and links |
| [`docs/game-screen-model.js`](docs/game-screen-model.js) and [`docs/army-state.js`](docs/army-state.js) | Read-only source/roster projection and legacy saved-army restoration |
| [`docs/sw.js`](docs/sw.js) and [`docs/offline.js`](docs/offline.js) | Versioned offline app-shell cache and best-effort registration |
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

The first v1 milestone is **a Game Screen and reliable import/persistence foundation**, not a complete battle-management or rules engine. Its Character section lists imported characters separately: there is **no join/remove control yet**, and the app never infers character assignments or grants buffs. Profiles are published **base** values, and the reported army points come from the export.

The Service Worker caches the static app shell for offline relaunch after the initial online visit; source unit shards must already be cached to show their statistics offline. Browser storage may be evicted, so keep a JSON backup. This cache does not mirror full tow.whfb.app rules pages or make unverified source-extracted facts authoritative.

## Privacy, backups and limitations

Imported army lists are parsed in the browser and are not automatically uploaded. Saved lists are local to the browser/device, may disappear when browser storage is cleared and are **not** yet synchronised across devices. Use JSON backup/export when the roster matters. Opt-in unmatched reports contain limited reference context, not an automatic upload of the full list.

**Not yet available:** character assignment, automatic unit buffs, full offline rules text, full spell effect interpretation, derived saves, attacks, combat resolution, independent points validation or army legality validation. These remain future stages rather than claims about the current site.

This is a fan-made project, not an official Games Workshop product.

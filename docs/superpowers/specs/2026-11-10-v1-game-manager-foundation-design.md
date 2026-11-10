# Game Manager v1 — Fresh Foundation & Game Screen (Design)

**Date:** 10 November 2026  
**Status:** Approved direction — user selected Option A and authorised v1 to replace the live site after verification  
**Repository:** `AnthonyWCurtis/old-world-game-manager`  
**Chosen approach:** Option A — fresh v1 development on a new branch inside the existing repository, retaining verified components and making a recoverable v0.5 snapshot before publishing tested v1 milestones to the existing live site.

## 1. Intent

Build **Warhammer: The Old World — Game Manager** progressively into a reliable, mobile-first tabletop battle companion.

A player pastes an army export; Game Manager preserves that list and opens a **Game Screen** displaying every separate unit and character, its original selected model count, command and equipment, source-backed characteristics, and available rules. Later, the user will be able to assign characters to units, track battle state, see derived saves and buffs, and calculate shooting and melee attacks for models, champions, mounts, characters and weapons.

**Accuracy and clarity take precedence over feature count or speed of delivery.** No missing Warhammer statistic, source text, permission, rule condition or game effect is invented.

This document describes the full direction, but **only Stages 1 and 2 are the first implementation slice**. Stages 3–5 require subsequent scoped plans and verification.

## 2. Decisions already agreed

- Develop **inside the current GitHub repository**, on an isolated v1 branch. The existing live GitHub Pages URL may be updated with tested v1 milestones; the v0.5 state has been preserved in branch `archive/v0.5.0-pre-v1`.
- Reuse tested parser/exporter support and reliable existing source data instead of rewriting everything.
- Continue supporting **15 named layouts across four exporters**: Old World Builder, Ingude, New Recruit, Old World Rankings / Battle Builder.
- Import immediately and preserve pasted army content even when offline or reference data is unavailable.
- On the Game Screen, show one unit card per imported unit instance (including repeated entries), with quantities, points and all recorded selections.
- Display unit profiles (M, WS, BS, S, T, W, I, A, Ld), command, weapons, armour, mounts, relevant special rules, magic items and spells **where supplied by the export or supported by verified reference data**. Clearly identify missing data; don't claim the original exporter included information it didn't.
- Eventually allow assignment **either from a character** (`Assign to Unit`) **or from a regiment** (`Add Character`), with characters expanded **inside the regiment** and still accessible from the Characters section.
- Eventually apply character-to-unit benefits only when verified rules say the ability affects eligible recipients; separate personal rules from unit-wide buffs and track conditions.
- Show armour, Ward and Regeneration saves with their sources; derive actual effects and attacks in later stages, not by unverified heuristics.
- Use **https://tow.whfb.app** exclusively for Warhammer rules, stats, equipment, items, spells, and interpretations; track source URLs and verification status.
- The **target** is an army-specific cached reference pack, applicable spell-lore coverage, reuse of previously cached records and safe automatic refresh, rather than downloading every faction. Missing offline data may be added later online.
- Do **not** delete currently useful reference databases or rely only on website links until a verified replacement exists.

## 3. Scope and success criteria

### Initial delivery: Stage 1 — Import and structured data foundation

1. Keep the **original pasted text** unchanged and distinguish imported facts from source-enriched facts.
2. Ensure a stable, explicit data shape for the army, sections, distinct unit instances, character instances, model groups and their counts, nested selections, reported points, command choices, equipped items/mounts, source locations and warnings. Unknown fields remain unknown.
3. Treat repeated units and same-named characters as distinct instances; never merge or duplicate them.
4. Keep existing source matching conservative: exact, source-scoped and provenance-tracked. A match means identified, **not** legal or effect-verified.
5. Preserve compatibility with already saved v0.5 imported lists through a versioned read/migration path; preserve old stored data and provide a recoverable import/backup path instead of destructive schema replacement.
6. Make **offline paste-and-parse** work after the app shell has been loaded/cached. Any additional service-worker or static-asset caching work must be explicitly tested on supported mobile browsers; browser storage eviction remains a known limitation, so JSON backup remains available.
7. Regression test all existing supported formats, old saved snapshots, duplicates, nested options, inconsistent/missing quantities and source failures. Maintain the old site untouched until the replacement is accepted.

**Stage 1 passes when** the same source army is parsed without loss or invented values, the normalised record remains usable offline, source enrichment cannot overwrite the imported roster, and existing fixtures/tests pass.

### Initial delivery: Stage 2 — Game Screen v1

1. After successful import, show a prominent **Enter Game Screen** action that opens a real mobile-friendly view (not an importer diagnostics screen).
2. Display army name, faction/variant where known, listed points, unit entry count and known model count; explicitly label unknown metadata.
3. Render grouped regiment and character cards in source-list order (including repeated entries). Provide a dedicated **Characters** area; do not assume characters are already attached to regiments.
4. Every card displays the imported name, model count, reported points and relevant selections. Expandable panels reveal available model/character stat profiles, command, weapons/armour, mounts, items, spells, published rules references and original **tow.whfb.app** links.
5. Visually distinguish **imported selections**, **published base profiles**, **available-but-not-selected options**, **missing/unverified reference data**, and **future calculated effects**. Never show optional rules as active without a supported selection and verified rules.
6. Work on an iPhone-sized portrait screen with comfortable touch targets, legible characteristics and no **page-level** horizontal overflow. A locally scrollable statistics table is acceptable when labelled; landscape remains usable.
7. Keep navigation back to the importer, preserve the current army while moving between screens, and reopen saved armies without re-pasting.
8. Provide a graceful loading/error/offline state for enrichment. An imported list is viewable even without its published profiles; reference fetch errors must not hide the roster.

**Stage 2 passes when** every imported instance and selection is visibly accounted for, profiles are correctly sourced or clearly missing, the Game Screen is usable on mobile, and v0.5 imports/backups still work.

### Later stages (separate design/implementation milestones)

- **Stage 3 — Character management & battle-state persistence:** assign from either end, multiple eligible characters per regiment, one assignment per character, removal/reassignment, separate character listing, locally persisted state and recovery after reload; verify joining restrictions before enforcing them.
- **Stage 4 — Derived effects & saves:** controlled rule-effect model with scope, recipients, condition, phase, duration, source and expiry. Armour/Ward/Regeneration displayed independently; verify each applicable modifier against source and tests.
- **Stage 5 — Calculations:** versioned shooting/melee resolution, attacks per eligible model/champion/character/mount, weapon choices, initiative, hit/wound/save pipelines and controlled manual overrides. Tests for each supported interaction; unsupported ones remain explicitly unresolved.

**Not part of initial Stages 1–2:** legality checking, recalculating costs, automatically selecting spells, combat resolution, automatic buff propagation, formation editor or multiplayer/cloud sync.

## 4. Architecture

### 4.1 Three deliberately separate layers

**A. Imported roster (immutable source of the player's choices)**  
Stores original text, exporter/layout detection and confidence, sections, unique unit/character instance IDs, models and selections, reported points, line provenance and parse diagnostics. Import data is not silently mutated when source information changes.

**B. Reference catalogue (external, versioned and incomplete by design)**  
Stores identity and verified source URL plus structured unit/model characteristics; source-extracted equipment, command options, links, special rules, magic items and spell references where available. Every fact carries its source and evidence/verification status. Distinguish `source-indexed` (title + URL), `source-extracted` (parsed data with possible review flags), `verified` (explicitly reviewed for the intended purpose), and `unresolved`. Existing catalogues are kept pending a validated migration.

**C. Game session (player actions and later calculations)**  
Contains which army is being used and, in later stages, character-to-unit assignments, casualties, phases, spell/buff toggles, game notes and derived views. Data in this layer must never rewrite original roster data or overwrite reference facts. Derived outputs are computed from roster + verified references + current session context and labelled with dependencies.

### 4.2 Platform and reuse

The deployed app is currently static HTML/CSS/JavaScript ES modules under `docs/`, with IndexedDB-based browser saving and static JSON reference shards. **Keep this runtime for the initial slice** to avoid simultaneously rewriting framework/toolchain and domain logic. Modularise the existing code into testable parsing, normalisation, reference, persistence and presentation responsibilities as needed. No server/database service is required for gameplay.

Re-use `docs/parser.js` and its tests, `docs/unit-data.js`, the reference datasets, and the existing `docs/army-roster-page.js` as a **starting point**, not a constraint on the new interface. Keep the source-data branch (`data/all-armies-units-json-v1.1`) intact.

Prefer a v1 branch built from `main`. Integrate outstanding documentation PR #20 and matching PR #19 deliberately rather than assuming they are already merged. Maintain v1 work on a development branch until the milestone passes tests. The user has authorised promotion to the existing public GitHub Pages URL; no parallel old site is required. Do not bump visible production version based solely on a design document.

### 4.3 Data mapping and enrichment

On import:

`pasted text → exporter-specific parser → normalised roster → saved roster (when chosen / session use) → Game Screen immediately → cached reference lookup → optional online reference enrichment → rerender only source-backed panels`.

- Use the importer's own selected data for army/list identity and choices; no default equipment becomes selected without explicit source/selection rules.
- Keep unit instances separate by stable internal ID even if their source reference URL is shared.
- Prefer previously reviewed exact parent-unit references. Reject ambiguous/fuzzy references and invalid or invented source URLs.
- Resolve source data without network dependence where cached. An unavailable reference is shown as pending, not invented. Normalisation must not wait for reference downloads.
- Source data cannot silently change imported names, points, choices or quantities.
- Source index data is not automatically spell/effect implementation. Complete applicable spell lore download is a future **offline reference-pack target**, and lore eligibility must be verified before claiming a particular set is selectable.
- Store source provenance and explicit verification status; complex extracted units with warnings remain flagged.

### 4.4 Offline and updates

**Initial design:** static app assets must be cached to support repeat launches without network after first successful visit; imported lists use device storage; source data uses separate IndexedDB cache. Validate service-worker update/rollbacks, quota/eviction, stale source versions and JSON backup recovery in mobile Safari before calling the app fully offline-ready.

**Future design:** publish small, versioned, sanity-checked reference manifests; download only references needed by saved/imported armies, applicable spell lores, and their dependencies; re-use shared records. Update the catalogue atomically only after validation and retain the last usable version on partial failure. Work only with permitted public sources, subject to access/copyright/reuse restrictions, and never require an upstream request during battle. Do not assume a fully automated publisher exists today.

### 4.5 UI structure

`Import → Army Game Screen → individual regiment/character detail`.

A game screen shows an army overview and cards. Each card keeps **selected** equipment separate from published **possible** upgrades, characteristics separate from future effective values, and character stats separate from regiment stats. Source status and failure feedback should be readable, not a wall of debug information. Defer the character-assignment controls themselves until Stage 3; design the data model and card placement so the later interaction doesn't require another rewrite.

Source labels and badges should describe evidence and uncertainty accurately, not imply unit legality. Links must go only to verified `tow.whfb.app` URLs. Debugging and reporting remain available without dominating the Game Screen.

## 5. Alternatives considered

**Option A — new v1 foundation in existing repository, selective reuse (chosen):** preserves tests, import fixtures, source provenance and the live site; adds modest integration/migration work but avoids rebuilding proven components.

**Option B — new repository from zero:** offers a blank slate but duplicates 15-layout parser work, risks losing edge cases and reference evidence, and complicates migration. Rejected in favour of Option A.

**Option C — only cache pasted lists and use external links for everything else:** minimises stored reference data, but cannot support offline profile presentation or safe future derived attacks, saves and buffs. Keep external source links **as a supplement**, not a replacement for structured data.

## 6. Risks and protections

- **Source accuracy:** many records are only source-extracted; surface warnings, provenance and conditional statuses, and never activate unverified effects.
- **Exporter omissions:** not every export contains stats, model counts, selected spells or all equipment. Show `Not stated` and offer source-backed completion only when justified.
- **Rules reuse/access:** maintain public source links, avoid blocked paths, and review permissions before caching or republishing substantial rules text.
- **Mobile reliability:** save/restore, network interruption, offline app shell, IndexedDB eviction and iOS Safari behaviour need real-device verification; provide JSON backup path.
- **Production safety:** v1 branch is not the production site; no destructive database/branch deletion or unrelated PR merges.
- **Unresolved joins/buffs:** later character membership must respect eligibility and effect scope; an illustrative buff does not justify implementing a rule without its source.

## 7. Acceptance tests and release gates

- **Parsing:** run and extend `node --test tests/*.test.mjs` across all 15 layouts and representative test armies; audit unknowns and source lines rather than forcing successful matches.
- **Data integrity:** test repeated units, nested selections, model groups, historical IndexedDB saved snapshots/JSON restore, points preservation and failed reference requests.
- **Rendering:** verify every unit/character appears once with all imported selection rows; published base characteristics never masquerade as selected upgrades or calculated values.
- **Mobile:** browser smoke tests at narrow widths, portrait/landscape; focus/accessibility and no page-level horizontal scrolling; test iOS Safari for critical offline/persistence paths where available.
- **Offline:** test cached app loading and saved-army opening without network, empty-source-cache behaviour and failed updates without data loss.
- **Regression:** the v0.5 release remains recoverable from `archive/v0.5.0-pre-v1`. Promote verified Stage 1–2 changes to the existing GitHub Pages URL; the user has already authorised replacement rather than maintaining the old public site.

## 8. Decisions left to implementation planning

- Exact module boundaries, filenames, IndexedDB versioning/migration mechanics and caching library (if any).
- Precise layout/styling of cards and mobile navigation, to be reviewed through a visual mockup.
- Unit/character categorisation fallback when an export omits sections; keep ambiguity visible and never create an invented class.
- Scheduling and scope of the *future* source refresher; Stage 1–2 should not accidentally convert incomplete data into rules authority.
- Whether character cards appear in both the overview and the Characters section through one shared view model (recommended), without duplicating underlying instances.

## 9. Approval gate and first build

**User direction:** begin Option A and allow tested v1 to replace the old live site. The following implementation process remains required:

1. Invoke the Superpowers **writing-plans** skill to produce an actionable, tested implementation plan.
2. Begin the **Stage 1 importer/data foundation** changes on `feat/v1-game-manager-foundation`.
3. Build and verify **Stage 2 Game Screen** only once Stage 1 data integrity is proven.
4. Return for separately scoped Stage 3–5 design/review rather than implementing combat calculations prematurely.

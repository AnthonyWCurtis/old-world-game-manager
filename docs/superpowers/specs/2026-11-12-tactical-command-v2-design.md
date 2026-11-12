# Old World Companion — Tactical Command V2 redesign
Date: 2026-11-12
Status: Implementation candidate, user selected visual direction 3 (tactical command).

## Intent
Replace the cluttered Game Manager presentation **across the importer, saved-army access, Normal Play roster, unit detail and magic**, not merely recolour card lists. Target an iPhone-sized portrait/landscape tabletop app with dark-navy military command styling, restrained brass accents, accessible text, high contrast and single-action navigation.

## Verified current architecture
This is a static ES-module app under `docs/`, with persistent local IndexedDB imports, local battle sessions, source-backed public profiles and a service worker. The existing normal-play DOM has a three-tab bottom nav, a full three-metric hero and diagnostics, a version disclosure, rules disclosure, section jump buttons, a search input, folding sections and two independent open/expand controls per card. Profile tabs were added in a separate view layer to existing large cards. This redesign preserves IDs/event handlers and **never changes rules computation, importer parsing, stored army shapes or source provenance**.

## Approaches considered
1. Continue extending the old light theme: fastest and lowest short-term risk, but preserves layered clutter and old structure. Rejected.
2. Replace every page and entire battle-view renderer: maximum freedom, but high risk to spells, items, assignments, offline state and parser; unsuitable for one release.
3. **Chosen: Replace the public-facing shell, screen hierarchy and visual primitives around the existing working data/controls**, with a single named Tactical Command design system. Keep advanced source details in explicit disclosures; progressively migrate battle internals later.

## Information architecture
- **Home/Import:** full-width introductory panel, clear supported-list drop zone, primary "Analyse import" action and prominent "Continue game" where available; My Armies navigation takes users directly to saved imports (no reimport); details/diagnostics remain accessible behind a secondary disclosure.
- **Saved armies:** same persisted records, visibly distinct archive section and navigation from the home screen; no changes to storage.
- **Normal Play:** concise title, faction and imported points; top-level actions save/back; three consistent bottom tabs (Overview, My Army, Magic), 44px+ touch targets. Statistics, incomplete-profile notices and verification caveats accessible via "Army information" disclosure instead of permanently occupying the first screen.
- **Roster:** one clean search field, section headings, single-tap compact unit rows preserving source order, official/custom names, model count, imported points, joined-character/active-spell information. No visible Rename + Show details + Open unit trio on each row; use a single chevron action. Renames/editing happen in focused unit view.
- **Focused unit:** heading, one back action, four tabs Profile / Attacks / Defence / Effects. Primary tabs show existing live source-backed data. Detailed equipment, source links and explanatory warnings are preserved but folded when nonessential. All manual spell/assignment controls remain working and accurate.
- **Magic:** existing casting/target/spellbook controls restyled with same design system, not reimplemented.
- **Legacy technical importer diagnostics:** available but visually secondary; no deleted source links, saved data, export/backup tools or warnings.

## Design tokens
Background midnight `#091321`, primary surfaces `#101f30` / `#17283c`, borders `#32455a`, text `#eef3f7`, muted text `#a7b5c5`, brass `#d9b77a`, positive teal `#79cab8`, warning amber `#f1c77d`, critical rose `#f29b9d`. Use system fonts; avoid downloaded fonts/assets. Restrained shadows, 10–16px corners, no decorative military imagery overpowering readability. Respect reduced motion, focus outlines and safe-area insets.

## State and rules invariants
Data and battle state must remain exactly as before; custom name separate from source name; multiple identical source units remain independent; saved/imported data never overwritten; source URL and conditional-verification disclosures retained. No new gameplay, legality, combat or magic assumptions. Offline first after caching. Degrade gracefully if localStorage is blocked.

## Acceptance
One coherent tactical theme across home, importer, archive, Normal Play and detail without hidden mobile horizontal overflow. In first game screen viewport, user sees army title and compact roster rather than multiple tech sections. No visible three-action cluster per unit. Core interactions remain testable using previous IDs. Saved-army restore, offline access, duplicate units, spell/assignment edits, focus and renaming work. Add tactical smoke and run existing importer suite and all Playwright game smoke tests. Keep new work on feature PR, not live until reviewed and merged.

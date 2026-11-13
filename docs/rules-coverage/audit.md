# Stage 1 repository and rules coverage audit

Audited 2026-11-12 against `main` at `fbff8957e25de1bac222a5ca5f63211d2f16b909`. Exclusive rules authority: https://tow.whfb.app. This document records implementation evidence and limitations; it does not freshly verify every source page or implement missing gameplay mechanics.

## Stage 2 scoped implementation update — 2026-11-13

Stage 1 PR #64 was merged into `main` before this work began. The Stage 2 resolver in `docs/selection-resolver.js` now supplies selection identity, original provenance, owner model/component scope, duplicates, verified published defaults and explicit unresolved/conflicting evidence to both `docs/defence-engine.js` and `docs/effects-engine.js`. `docs/battle-session.js` uses the same evidence for Charmed Shield one-use state. It preserves version 1 of the saved battle-state format. `docs/modifier-contract.js` adds a separate, opt-in and evidence-gated numerical modifier contract; it does not automatically evaluate combat or saves.

The specific obligations improved are: consistent item identity for selected Charmed Shield and Seed of Rebirth; correct owner for nested selections and champion items; source-checked shield and armour equipment-only evidence; rejection of missing/mismatched references and unidentified bearer scope; retention of one-use Charmed Shield state; and explicit condition/phase/model/natural-dice handling for a narrow modifier example. Regression and negative tests are in `tests/selection-consistency.test.mjs`, `tests/defence-engine.test.mjs` and `tests/modifier-contract.test.mjs`. Source inspection details and remaining limitations are in [Stage 2 verification](stage-2-verification.md).

The **canonical coverage classification remains unchanged**: a verified resolver establishes evidence ownership and exclusions, not complete interpretation of any rule page. Individual group/item save mechanics, legal joins, model identity within ordinary units, split profiles, conditional interactions, timing and combat outcome remain partial or unresolved. The modifier contract remains opt-in and is not a new completed rule.

## What the baseline establishes

The generated [register](register.json), [metrics](metrics.json), [report](report.md) and [imported selection report](imported-selections.json) separate source discovery, interpreted descriptions, implemented behavior and tests. [Methodology](methodology.md) defines the deterministic status rules and update procedure.

At this audited snapshot, four source indexes contain 3,442 page occurrences and 3,340 distinct URLs. Together with source-record and runtime references, the register contains 3,349 source pages: 2,641 provisional rule-page candidates and 708 context pages. Four explicit catalogue-gap records track missing closure work. These are page candidates, not an established denominator of atomic Old World mechanics.

| Candidate classification | Count | Interpretation |
| --- | ---: | --- |
| Missing | 0 | No individually identified candidate currently lacks all provenance; this does not mean no rules are missing. |
| Source Indexed | 1,834 | Source discovery only. |
| Source Verified | 0 | No additional candidates meet this distinct interpretation-only classification. |
| Reference Only | 774 | Linked/displayed data without established mechanical implementation. |
| Manual Support | 6 | Six reviewed special-rule reminders; no automatic resolution. |
| Partial Implementation | 22 | Thirteen item descriptors, five spell descriptors and four missile-weapon profile descriptors. |
| Conditional Implementation | 2 | Precision Strikes and contagious Stupidity projected from source records and recorded assignments. |
| Fully Implemented | 0 | Exhaustive canonical mechanics have not been demonstrated. |
| Fully Implemented and Tested | 0 | Passing limited-scope tests do not establish canonical completion. |
| Unresolved | 3 | Explicit identity/evidence conflicts remain visible. |

The 2,617 candidates without established automated mechanics include six manual entries and three unresolved candidates. All 2,641 candidates lack established full implementation. These are backlog populations, not verified counts of absent atomic rules. Thirty candidates have scoped reviewed descriptors (25 dated, five spell descriptors undated); their complete mechanical interpretation and exceptional interactions remain unverified.

The prior projector figures were independently recalculated from the current files rather than copied into the generator:

| Snapshot/projector measurement | Count |
| --- | ---: |
| Indexed/source-extracted unit records | 581 / 581 |
| Unit records carrying extraction warnings | 269 |
| All starting references | 3,783 |
| All optional references | 499 |
| Starting special-rule occurrences | 3,536 |
| Reviewed manual-only starting occurrences | 699 |
| Reviewed character/inherited starting occurrences | 2 |
| Reference-only starting occurrences in those projectors | 2,835 |
| Optional special-rule occurrences | 322 |
| Other starting references excluded by the older special-rule URL filter | 247 |
| Distinct starting/optional special-rule URLs in the older audit | 475 |

These occurrence counts cannot be added to canonical rule counts. Optional source links do not establish player selections. The imported-selection report uses the actual parser and committed examples, retaining unmatched and unverified entries; repeated exports are fixtures rather than distinct real armies. No production army corpus or live battle selections were available.

## Complete project structure and relevant boundaries

| Area | Responsibilities and audit relevance |
| --- | --- |
| `docs/index.html`, `app.js`, CSS and navigation modules | Static browser app, roster import, unit detail views, touch/mobile layout and navigation. |
| `docs/parser.js`, `catalog.js`, `live-source.js`, `unit-selection-matcher.js`, `import-guard.js` | Text parsing, source reference matching, live reference/cache integration and import guards. Matching a reference does not validate equipment legality or a rule's mechanics. |
| `docs/reference-records/` | Four source catalogues, collection metadata and summaries: rules, armies, magic and magic items/abilities. Titles and URLs are discovery evidence. |
| `docs/unit-data/`, `unit-data.js`, `source-profiles.json` | Pinned unit index, armies and 32 shards; browser cache/loading; separately extracted wizard and printed-armour facts. The source-data commit is retained independently of the application commit. |
| `docs/game-screen-model.js`, `army-roster-page.js`, `imported-unit-display.js`, loadout/selection modules | Per-instance presentation, published base profiles, selected options, command roles and reference scopes. |
| `docs/effects-engine.js`, `spell-engine.js`, `defence-engine.js` | Limited item effects/use-state, player-declared spell tracking and equipment-only defensive values. These are not a complete dice/legality engine. |
| `docs/source-core-rule-effects.js`, `source-special-rule-effects.js`, `source-missile-profiles.js` | Six manual reminders, two narrow conditional character projections and four displayed missile profiles. |
| `docs/source-defensive-rules.js`, `source-printed-armour.js`, mount/armour modules | Source-only defensive and split-profile references; unresolved assembled-model association is deliberately disclosed. |
| `docs/battle-session*.js`, `army-state.js`, customization/spell controls | Stored imported-army and per-battle state, recorded character assignments, spell and item use, user naming. Recorded state is not rules legality. |
| `docs/offline.js`, `sw.js` | Service-worker shell and offline behavior. Stage 1 register/report tooling is not imported into this shell. |
| `docs/report-*.js`, `worker/`, `reports/` | Anonymous unmatched-import reporting, administration and historical report data. No production reports are presumed a rules-coverage denominator. |
| `docs/examples/`, `tests/` | Imported army fixtures; Node regression tests and separate browser/mobile/offline smoke tests. Fixtures represent available examples, not representative faction or interaction coverage. |
| `scripts/` | Source index builders, bounded refresh/extraction scripts, unit-data packaging, old audits and new offline coverage generation/check tooling. |
| `.github/workflows/` | Importer, browser/mobile, source-access/index refresh, sitemap audit, reporting and publishing workflows. Each workflow's paths and run conditions matter to CI claims. |
| `README.md`, `PROJECT_HISTORY.md`, `docs/superpowers/`, other Markdown | Project instructions/history and prior designs. Historical completion language is not independent verification of current mechanics. |
| `site.tar.gz.base64` | Existing site packaging artifact; not used as current implementation or source evidence. |

## Latest merged rules work reviewed

| PR | Merged evidence inspected | Result of independent review |
| --- | --- | --- |
| [#60](https://github.com/AnthonyWCurtis/old-world-game-manager/pull/60) | Merge `f6a7549`; source-rule projector, UI, tests and source-record owner/target gates | Precision Strikes is correctly restricted to its descriptor's source character and target regiment, follows recorded assignments and is displayed separately from Armour Bane. It does not calculate final AP, legal joins, attack eligibility or stacking. Classify conditional, not complete. |
| [#62](https://github.com/AnthonyWCurtis/old-world-game-manager/pull/62) | Merge `fc66100`; occurrence audit, Stupidity descriptor and negative tests | Audit explicitly describes the limited projector denominator. Stupidity inheritance is a reminder from a source-extracted character; Leadership rolls, restrictions and legal joins are not enforced. Synthetic tests do not assert that real Ishaya Vess has Stupidity. |
| [#63](https://github.com/AnthonyWCurtis/old-world-game-manager/pull/63) | Merge `fbff895`; six core reminders, distinct manual counts, UI/offline tests | Close Order, Swiftstride, Regeneration, Impact Hits, Stomp Attacks and Armour Bane are labelled manual. Exact starting-rule name/URL gates and optional-rule exclusions are useful tested behavior; no movement, hit, save or combat-result calculation is established. |

## Findings and reproducible evidence

Line references below describe the audited baseline, before future runtime work. Stage 1 records these findings; it does not fix gameplay behavior.

1. **Defence and Effects disagree on conflicting source evidence.** `docs/defence-engine.js:22-26` matches selected items by name; `:63-81` then creates Ward/Regeneration entries. `docs/effects-engine.js:110-116` rejects an explicit conflicting magic-item URL. Reproduce with `docs/examples/owb-regular.txt`: find a commander with Charmed Shield, change that selection's `reference.url` to the existing Seed of Rebirth URL, then call `ownedItemEffects(army, null)` and `evaluateDefences(army, null, commander.id)`. Effects excludes Charmed Shield while Defence still returns its 5+ Ward. This directly supports partial classification and a shared evidence resolver priority.

2. **Nested/model-group selection support differs across engines.** `effects-engine.js:79-107` recursively traverses children and model groups; `defence-engine.js:22-26` uses top-level selections. Move the same selected Charmed Shield into a generic `{name:'Equipment', children:[shield]}` selection: Effects retains it and Defence returns no Charmed Shield Ward. `tests/defence-engine.test.mjs` covers useful OWB fixture behavior but lacks this parity/conflicting-reference matrix.

3. **Faction-specific champion vocabulary remains inside generic logic.** `/champion|sea master/i` occurs at `effects-engine.js:152` and `defence-engine.js:88`. Verified source-data command roles should supply bearer/champion scope; new factions must not require additional engine name branches. Precision Strikes owner/target restrictions already illustrate the preferable declarative rule-data pattern.

4. **Useful mount helpers do not establish live assembled-model support.** `docs/resolve-selected-mount-profiles.js:35` supplies `modelScopeVerified:false`, so `mount-armour-choice.js:17-19` deliberately returns unresolved. `published-mount-benefits.js:63` states reference-only status. Tests of comparison helper branches are not proof that the current imported-model/UI path establishes those inputs. Rider/mount association, transfer exceptions and eligibility remain unresolved.

5. **Attack panels display profiles rather than resolving attacks.** `docs/unit-attack-panel.js:238-239` explicitly excludes selected-weapon eligibility, line of sight, eligible shooters, fighting ranks, contact, rolls and damage. Four mundane missile profiles in `source-missile-profiles.js:14-18` and magic-weapon profiles are partial/reference behavior. Displayed Strength/AP strings, including `S+1`, are not a modifier pipeline or final result.

6. **Item and spell lifecycle support is narrower than canonical mechanics.** `effects-engine.js:64-69,117-128,176-187` provides descriptions and manually tracked one-use/timed states; it does not resolve Elixir characteristic changes, expiry wound loss or Scroll casting. `spell-engine.js:196-242,249-254` relies on player declarations and manual expiry. `:260-315` projects limited reminders/values: Plague of Rust is recorded against an enemy name, Drain Magic has no measured proximity/casting resolution, and movement restrictions are not a complete legal movement engine. Descriptors remain partial even where those limited behaviors have tests.

7. **The old audit's first variant name can mislabel a canonical aggregate.** `scripts/audit-rule-effect-coverage.mjs:48-54` groups by source URL and preserves the first encountered label. For example, the old output calls 78 Hatred occurrences “Hatred (Orcs & Goblins)” and 73 Fly occurrences “Fly (9)”. The new register retains canonical page identity and observed numerical/conditional labels separately; semantic equivalence across different pages still requires source review.

8. **Source extraction is not mechanical or legality verification.** `scripts/build-browser-unit-data.mjs:9,46,60,68` explicitly distinguishes extracted data, unverified options and `legalityVerified:false`. There are 269 warning-bearing unit records. `sourceUpdatedAt` and index capture dates cannot become rule-interpretation verification dates. The new register retains original provenance and inherited descriptor review dates without claiming a fresh review of every page.

9. **Pinned data guards need deliberate maintenance on refresh.** `docs/unit-data.js:29-31` and `scripts/build-browser-unit-data.mjs:18-19` pin 581 units/19 armies. These are current snapshot guards, not evidence that future source completeness remains unchanged. Updating the source catalogue must update/check the manifest and denominators deliberately.

10. **Existing tests verify declared behavior, not independent source truth.** Examples include description/URL assertions in `tests/effects-engine.test.mjs`, metadata checks in `tests/spell-engine.test.mjs`, and source-code regex assertions in `tests/source-core-rule-effects.test.mjs:122-129`. Real shipped-record and negative tests are valuable, but passing tests do not prove the underlying rule interpretation or exhaustive interactions. The Stage 1 integrity tests exercise classification, provenance and reproducibility independently of these runtime claims.

## Source access, uncertainty and verification boundary

The bounded public robots/top-level sitemap check on 2026-11-12 identified the four existing sitemap sections. Robots disallows `/api/*`, `/apps/*`, `/public/apps/*` and `/regenerate`; restricted paths and bulk crawling were not used. This policy check is not fresh verification of every catalogued rule. Future verification must recheck restrictions, stop on denial/failure, and retain unresolved evidence rather than guessing.

No whole-game coverage percentage is justified. Outstanding work includes complete FAQ/errata discovery and version-to-rule mapping, universal versus army/unit-specific scope review, atomic decomposition and cross-URL semantic aliases, and exceptional interaction enumeration. Those four gaps remain first-class records. The two currently identified interaction records are a starting list, not a denominator of all combinations.

Automated test and CI results must be read from the final Stage 1 verification evidence and PR checks. This audit does not claim that tests passed merely because files exist, nor that an unrun browser check succeeded. No runtime rules, importer, mobile layout or offline-shell changes are part of this Stage 1 audit.

## Recommended next stage

Stage 2 should implement a shared evidence-aware selection and model-scope resolver, plus a source-verified modifier contract for future calculations. Resolve the demonstrated Defence/Effects disagreements and champion-role hardcoding first, with real imported fixtures and cross-engine negative cases. Do not expand this into simultaneous implementation of movement, magic, psychology and combat resolution; see the dependency-ordered [backlog](backlog.md).

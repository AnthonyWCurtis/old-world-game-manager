# Project history — archived README (v0.5.0)

This document preserves the detailed README as it appeared on `main` on **10 November 2026**, before the product-vision and repository-documentation refresh. It records past importer fixes, reference data collection, deployment and reporting details. Some version references and implementation statements describe that historical build rather than the current roadmap. For current project direction and implementation status, see [README.md](README.md).

---

# Warhammer: The Old World — Game Manager

A mobile-friendly, browser-based army-list importer for **Warhammer: The Old World**. Paste an army list, identify its export format, inspect the roster, and investigate references that have not yet been linked to the rules source.

**Browser edition: v0.5.0** · **[Open Game Manager](https://anthonywcurtis.github.io/old-world-game-manager/)**

> **Current scope:** Army-list parsing, local saves, reference discovery, and unmatched-reference diagnostics. This is **not** an army-legality checker or combat simulator. A matched source link is not proof that the selected configuration is legal, and an unmatched item is not necessarily invalid.

## Quick start

1. Open the [Game Manager website](https://anthonywcurtis.github.io/old-world-game-manager/).
2. Paste an exported army list into **Paste exported list**, or load one of the 24 supplied test examples.
3. Check the detected builder and layout shown in green. An unrecognised format is shown in red; **Format not right? Choose manually** provides a manual override. A layout can be recognised without the builder's identity being confirmed.
4. Select **Analyse import**. The roster appears immediately; versioned source-backed unit profiles are loaded only for recognized units. Live-source checks do not replace imported selections or points.
5. Expand **View unit source data** beneath a roster entry to inspect its characteristics, equipment, standard and optional rules, and available upgrades. **Reference matching and import details** shows unmatched selections.
6. Use **Save on this device**, **Export JSON**, or **Backup all JSON** if you want to keep the results.

When an entire previously rendered Game Manager page is accidentally pasted instead of a source list, the app warns against importing the duplicate content and can offer to recover one identifiable, clean export.

## Supported army-list exports

| Builder | Layouts |
| --- | --- |
| **Old World Builder (OWB)** | Regular text, compact text, minimalist text; regular, compact, and minimalist Discord/Markdown |
| **Ingude** | Simple text, compact, Markdown |
| **New Recruit** | TOW, NR, Simple |
| **Old World Rankings / Battle Builder** | Compact, detailed, tournament |

**15 named layouts** are supported. The TOW parser handles points-first lines, upgrades split across lines, repeated unit instances, and nested model groups such as `• 11x Gor, Additional Hand Weapon`. Old World Builder minimalist exports may prefix unit lines with custom quoted nicknames: for example, `'ORMO' 22 Hobgoblin Cutthroats` is stored as unit **Hobgoblin Cutthroats** (22 models) with the separate display-only nickname **ORMO**. Source matching ignores the nickname, while original text, duplicates, and option names containing apostrophes remain intact. If a list has no export footer, its format may be inferred from structure rather than positively attributed to a specific builder. Footerless regular text with a sectioned, hyphen-bullet structure uses the compatible parser without claiming a confirmed builder.

The importer preserves original pasted text, source line information, reported points, equipment/options and model groups wherever present. Version 0.3.3 recognises footerless sectioned bullet-list rosters (with medium confidence and no claimed exporter attribution), including the Northside Warriors test fixture. Version 0.3.2 added verified, parent-scoped Chaos Dwarf references for Wizard, Level 3 Wizard, Bale Taurus, Ranged weapon (an exporter category), standard bearer, full command and musicians on the specific reported units. All 10 unit instances in the anonymised 1,999-point example now resolve to reviewed unit-page references as well. It does **not** invent missing army sections, player names, faction, composition, points limits or rules. The calculated total sums displayed unit points; it is not an independent rules-based costing check.

## v0.5.0 — Dedicated Army Roster screen

After importing a list, the results now prominently offer **View Army Roster**. Selecting it navigates to a separate mobile-friendly, full-page roster screen (`#army-roster`) instead of burying unit data below source diagnostics.

The new screen displays:

- Army name, faction, listed total points, number of unit entries and **known** model count.
- Each unit in the original roster order, grouped by the import's actual sections; repeated units are shown separately.
- Imported unit/model quantity and points, plus full published model-characteristic profiles **M / WS / BS / S / T / W / I / A / Ld** when available.
- Separate records for champions and other model profiles, imported selections (including nested choices), New Recruit model groups and their counts.
- Optional expanded equipment and special-rule references, and links to the original unit pages.
- A clear **Back to importer** action at both the top and bottom. Browser back/forward supports the page route, and imported state stays in memory throughout navigation.

**Accuracy and offline behavior:** Nothing is recalculated, and chosen upgrades never overwrite published base stats. Missing models or data are explicitly labelled, not guessed. The roster uses the Game Manager's version-pinned, cached source JSON and gracefully shows unavailable profiles when not cached offline. The screen does not automatically save the list across a page reload; use **Save on this device** to keep a snapshot. Any roster navigation inside the same page preserves the current import without resubmission.

The separate roster screen is read-only and uses no new backend. The existing diagnostic, importer, JSON export and source-verification screens remain intact. Coverage includes automated parser/unit tests plus a 390px mobile Chromium smoke test for statistics, points, model groups, source links, page navigation and global overflow.

## v0.4.6 — New Recruit Dwarf source references

A v0.4.5 New Recruit TOW debug reported 13 units, 2,500 imported points and two unmatched selections. Both now resolve using **only the individual parent unit's existing published JSON**:

- **Rangers → Ol Deadeye** matches the [Ol' Deadeye champion](https://tow.whfb.app/unit/rangers) by normalising the omitted apostrophe **for champion titles only**. The Rangers profile and exact `Upgrade one model to an Ol' Deadeye (champion) (+6 points per unit)` option must both exist.
- **Irondrakes → Standard Runes** matches the parent's published `Purchase Standard runes up to a total of 50 points` option and links to the actual [Standard Runes category](https://tow.whfb.app/magic-items/standard-runes). The JSON also preserves the `0-1 unit per 1,000 points may:` restriction in the reference note. Parent source link, unique category link, matching cap and exact option description are mandatory.

This is **reference identification only**. Identifying the Standard Runes category does **not** mean a particular rune is selected, a standard bearer is confirmed, an allowance is legal in a given army, or any points have been recalculated. The imported 2,500-point value remains untouched.

A synthetic 13-unit, 2,500-point New Recruit fixture recreates the two reported selections at source lines 7 and 14 for regression and mobile browser testing. It is not a reconstruction of the user's complete unshared original roster.

## v0.4.5 — Shadow Warriors champion reference

The High Elf Realms `The Warriors Of Ulthuan` 586-point Old World Builder debug report had one unmatched selection: `Shadow Walker` under `Shadow Warriors`.

The [published Shadow Warriors unit page](https://tow.whfb.app/unit/shadow-warriors) lists the **Shadow-walker** champion profile and the explicit `Any unit may upgrade one model to a Shadow-walker (champion) (+6 points per unit)` option. The exporter drops the hyphen, so matching now normalizes hyphenated champion names and accepts this exact published `Any unit may` introduction **only within the corresponding parent unit's model profiles and options**.

The source link goes to the original Shadow Warriors unit page, not to an invented champion page. The imported roster's unit points, selections and reported 586-point total remain untouched; reference matching is not a rules-legality or pricing check.

Regression tests cover the positive alias, mismatched parent units, missing model profiles/upgrades, spoofed source URLs and the previously verified Glade Guard champion alias. Mobile browser testing confirms the original single unmatched reference now disappears after the source data loads.

## v0.4.4 — Winter Muster Mage wizard references

The High Elf Realms `Winter Muster` 750-point Old World Builder debug report contained two source-free selections under the Mage:

- `Wizard` — the [Mage source page](https://tow.whfb.app/unit/mage) explicitly identifies the Mage as a **Level 1 Wizard** by default.
- `Level 2 Wizard` — the same Mage page expressly lists `Be a Level 2 Wizard +30 points` as an optional upgrade.

v0.4.4 maps both to the Mage's unit source URL, keeping their distinct roles and the original nested selection structure. The upgraded level only matches if that exact level is also listed in the **parent Mage's published options**. Unsupported levels or unrelated character profiles stay unmatched; the previously verified Archmage and Shadowdancer behaviour is retained.

**No points or army legality are recalculated.** The original report's 750-point total stays unchanged. A source match confirms identification, not whether the upgrade is legal or correctly costed in a specific roster.

## v0.4.3 — Wood Elf source-scoped selection references

The Wood Elf Realms 748-point unmatched-reference report highlighted five options. Three now receive source-backed references **only when the imported parent unit matches the actual source page**:

- `Shadowdancer → Level 1 Wizard`: exact parent option `May be a Level 1 Wizard (+35 points)`; not an automatically active wizard level.
- `Glade Guard → Lord's Bowmen`: source-checked plural alias for the singular `Lord's Bowman` model profile **and** an explicit champion upgrade on the same unit page.
- `Wardancers → 9x Additional hand weapon`: strips a positive model-count prefix *only for matching*, and links to the exact weapon referenced in the parent unit's per-model equipment options. The original `9x` text and roster points remain unchanged; quantity legality is not evaluated.

**The Briar-bow** (Waystalker) and **The Kinbands of Modryn** (Glade Guard) remain unmatched because neither selection has an identified reference in the current [tow.whfb.app](https://tow.whfb.app) unit pages and indexed Magic Items source. The browser does not guess an item URL, an army-composition restriction or purchase eligibility.

All changes are reference matching only; no points, list legality or rule effects are recalculated. Full import and mobile browser regression tests cover the three supported matches and two intentionally unresolved selections.

## v0.4.2 — Informational mount-state placeholders

**On foot** is a descriptive field from an imported army list, **not** a purchasable rule, item or upgrade. It now appears in the roster with a neutral **Information** badge, retains its exact source text and line, and has **no invented source URL**. The app excludes these entries from matched and unmatched reference counts and debug reports, showing their number separately as **Informational entries**. Other unfamiliar selections still require a source match.

The same treatment works across all supported exporters, not only for Noble, and old saved imports are normalised when opened without changing their models, selections or points. An "On foot" entry does **not** verify that the model may or may not purchase a mount; legality remains outside the importer. The v0.4.1 rule-like default-on-foot heuristic has been removed.

## v0.4.1 — Parent-scoped selection reference matching

Source-extracted unit details now resolve an imported selection **only when the matched parent unit's source data supplies the evidence**, without editing the source list or assuming legality.

- **Starting equipment**: unique exact-name links from that unit's published starting equipment (for example Swordmasters' Swords of Hoeth and Sisters' Bows of Avelorn).
- **Command upgrades**: standard bearer and musician references only when the parent unit's source page explicitly offers that upgrade.
- **Archmage wizard entries**: Wizard and the baseline Level 3 Wizard are supported by the reviewed [Archmage unit page](https://tow.whfb.app/unit/archmage); Level 4 Wizard additionally requires its specifically listed +30-point upgrade in the source-backed unit data.
- **On foot**: recognised as a source-backed *default unmounted character state* only when the parent profile is a regular-infantry character with explicitly optional mounts and no contradictory mount selection. This is not a purchasable item or legality validation.

The original High Elf debug example contains 13 genuine source-reference matches plus three source-free On foot descriptors, all covered by regression tests. Ambiguous or unavailable options stay unmatched, while previously reviewed/manual references retain precedence. The app's matched tick indicates a **reference identification**, never that army construction or point values have been confirmed.

A copied debug report marked `Game Manager: v0.3.2` is from an older browser build: refresh the deployed site to v0.4.1 and run the import again to produce a current report.

## v0.4 — Versioned source-backed unit details

**Connected data:** [581 unit definitions](docs/unit-data/index.json), **960** model-characteristic rows and **2,435** source-extracted upgrade choices, assembled from all 19 army pages on [tow.whfb.app](https://tow.whfb.app/sitemap/armies).

The data itself remains independent on [the data-only GitHub branch](https://github.com/AnthonyWCurtis/old-world-game-manager/tree/data/all-armies-units-json-v1.1). The Game Manager embeds a **version-pinned**, build-validated reference snapshot of commit `c9f888b0e4d0cca941c117829644ae9a33966942`, split into **32 small JSON shards** in [docs/unit-data/shards](docs/unit-data/shards/). It downloads the small [unit index](docs/unit-data/index.json) when an army is imported, and requests only shards needed for the roster's units. Shards already visited are cached in IndexedDB for subsequent loads and offline reuse where browser storage persists. **Unvisited units are not guaranteed to work offline until their shards have been downloaded.**

Unit identification uses an existing exact `https://tow.whfb.app/unit/…` reference first. When no source link exists, the importer matches only one **unique exact normalized unit name**; no fuzzy names, invented URLs or inferred faction eligibility. Manually reviewed references always remain authoritative. Unknown and ambiguous units stay unmatched.

Each roster entry can expand **View unit source data** to show model profiles, base source cost wording, classification, unit size, starting equipment, standard/optional rules, published upgrade groups and the original page link. The original pasted list, selected upgrades, points and model groups are **never changed by this reference layer**. Duplicate unit instances remain independent.

**Data-quality limits:** these are source-extracted reference facts rather than independently verified unit legality or effect implementations. The original snapshot contains **269 units with extraction review flags**, including complex composites. Published options are not assumed to be selected; optional rules are not automatically enabled; source page membership does not prove legality. The v0.4 browser does **not** automatically recost an army or verify equipment, spells, magic-item budgets or upgrades. See [source data coverage](https://github.com/AnthonyWCurtis/old-world-game-manager/blob/data/all-armies-units-json-v1.1/coverage-report.json).

To rebuild the site's static unit data when the independent source snapshot is updated, update the pinned source commit in `scripts/build-browser-unit-data.mjs` and `.github/workflows/build-browser-unit-data.yml`, run its GitHub Action on a feature branch, and verify the full test suite before publishing.

## Rules sitemap reference collection (v0.4 groundwork)

The public [rules sitemap](https://tow.whfb.app/sitemap/rules) is now indexed in the static [rules-reference dataset](docs/reference-records/rules-index.json), with [summary and category counts](docs/reference-records/rules-summary.json). The first retrieval on 9 November 2026 contained **1,833 unique URLs**, including **652 special-rules pages**, across 31 path categories and 32 section links. The [collection registry](docs/reference-records/collections.json) registers Rules alongside Magic and global Armies references.

This is a URL-and-title index only: `source-indexed` means the sitemap contained the link, **not** that its rules text was parsed, validated, or implemented. Some entries are magic, weapons, war machines and army references rather than universal special rules. Ambiguous titles are flagged instead of guessed. A bounded GitHub Action can refresh the list weekly. The live browser matcher does not yet consume these newly generated records.

## Magic lore and spell reference collection (v0.4 groundwork)

The public [Magic sitemap](https://tow.whfb.app/sitemap/magic) is now stored in [magic-index.json](docs/reference-records/magic-index.json) with a [compact summary](docs/reference-records/magic-summary.json). The 9 November 2026 snapshot contains **170 unique source links**: **29 magic lores, 139 spells and 2 guidance pages**. The [collection registry](docs/reference-records/collections.json) makes the Magic, Rules and global Armies collections separately discoverable.

This is a **title-and-link index**, not a rules-text or spell-effects extractor. Spell costs, casting values, lore eligibility and active spell effects must be sourced and verified separately before gameplay calculations. The bounded weekly/manual source refresh retains the previous snapshot on incomplete results. The v0.4 browser still does not use the static magic index to validate spell selection or spell effects.

## Global Armies sitemap references (v0.4 groundwork)

The public [Armies sitemap](https://tow.whfb.app/sitemap/armies) is now indexed in [armies-index.json](docs/reference-records/armies-index.json), with a [source summary](docs/reference-records/armies-summary.json) and an [entry in the collection registry](docs/reference-records/collections.json). The initial 9 November 2026 extract contains **600 unique pages**: **19 armies** and **581 units**.

This global index captures **names, page types and actual source URLs only**. It does **not** assert that an indexed unit belongs to a certain army, can be purchased in a particular composition, or has legal points/options. All 45 High Elf unit URLs are included in this global index. The separate High Elf unit manifest, 45 detailed JSON records and their dedicated refresh workflow have been deleted. The global index retains names and URLs only, **not** their detailed statistics or upgrades. The snapshot refreshes through a weekly/manual GitHub Action.

The v0.4 browser uses the independently extracted unit snapshot described below. The global sitemap index remains a separate URL-and-title collection; its links do not prove an upgrade or army composition is legal.

## Magic Items & Abilities sitemap collection (v0.4 groundwork)

The public [Magic Items (and Abilities) sitemap](https://tow.whfb.app/sitemap/magic-items) is indexed separately in [magic-items-index.json](docs/reference-records/magic-items-index.json), with [counts and sample references](docs/reference-records/magic-items-summary.json). Its first source extraction on 9 November 2026 found **839 unique pages**: **71 type/guidance links** and **768 item/ability links**. The [collection registry](docs/reference-records/collections.json) now lists four collections: Rules, Magic, Armies and Magic Items & Abilities.

This is an index of **published names, source URLs and sections**, including faction item categories, runes, gifts, honours and abilities. It does not verify item point costs, item rules, upgrade permissions, army eligibility or legal configurations. Item names carrying a source asterisk are preserved and can be matched without that trailing marker. A limited GitHub Actions workflow refreshes the index weekly or on demand, checking for partial or unsafe source data.

The v0.4 importer uses the versioned unit snapshot for unit references and display; it does not yet use the Magic Items sitemap index to verify a character's equipment or selections.

## Source references and caching

The sole intended rules/reference source is **[tow.whfb.app](https://tow.whfb.app)**. The app uses a small local starter catalogue plus source-discovered references; **it does not yet maintain a complete, verified rules database**.

The public reference indexes used are:

- [Armies](https://tow.whfb.app/sitemap/armies)
- [Rules](https://tow.whfb.app/sitemap/rules)
- [Magic](https://tow.whfb.app/sitemap/magic)
- [Magic items](https://tow.whfb.app/sitemap/magic-items)

Reference links cached in the browser can display immediately. The app attempts to recheck stale public indexes after **15 minutes** and relevant source pages after **one hour**, in limited batches. **Check for updates now** requests a manual refresh. Some pages may be unreachable because of browser cross-origin restrictions or network errors; cached data is retained when checks fail. The repository also includes [source-extracted unit-profile metadata](docs/source-profiles.json) as a fallback for certain model names and champion upgrades.

Published unit characteristics are **base profiles**, not automatically recalculated for mounts, equipment, spells or upgrades. Source-page changes may be flagged for review, but imported point values and options are never silently overwritten.

### Reference status colours

- **Green — Matched:** The unit or selection has an identified source reference. For a unit to appear fully matched, its nested selections must also be matched.
- **Amber — Partially matched / Unmatched:** A unit may be identified while one or more of its upgrades remain unlinked. Individual unmatched options are also highlighted.
- An unmatched reference means **not yet linked**, not **invalid**. Source matching does not perform legality checks.

## Debugging missing references

After importing, the **Copy unmatched debug** button gathers only currently unmatched units/selections and their diagnostic context (parent unit, source lines, reference links and nested model groups). Its report can be pasted into ChatGPT for investigation. The report is also displayed on the page, with **Select report text** as a fallback when browser clipboard access is blocked.

Example of a reported missing source reference:

```text
SELECTION: High Helm
Parent unit: Silver Helms
Source line: 3
Parent unit reference: https://tow.whfb.app/unit/silver-helms
```

The debug report does not include the complete original list or player identity. Repeated unmatched selections may appear separately so each source occurrence can be diagnosed.

## Anonymous unmatched reporting to GitHub — live

The **Report unmatched** workflow is live and was verified with a real submission on 9 November 2026. **Players do not need GitHub accounts.** The process is:

1. A player imports a roster and selects **Report unmatched**.
2. They review the fields to be published, explicitly agree, complete anti-spam verification and submit.
3. A private Cloudflare Worker validates the request and writes a short text report into [`reports/unmatched/`](reports/unmatched/).
4. A GitHub Action rebuilds [`ALL_UNMATCHED.txt`](reports/unmatched/ALL_UNMATCHED.txt), grouping repeated missing names so the project owner can copy them for review.

**Live status:** [reporting is enabled](docs/report-config.json) through a Cloudflare Worker with private repository credentials and Turnstile verification. The [first saved report](reports/unmatched/report-20261109T185859798Z-3f621230-14c2-4b20-982f-49d3373e7841.txt) and [successful aggregation](reports/unmatched/ALL_UNMATCHED.txt) confirm delivery. Archived reports remain public as history; the consolidated file now excludes entries linked by reviewed catalogue references while counting historical resolutions.

See **[ANONYMOUS_REPORTING_SETUP.md](ANONYMOUS_REPORTING_SETUP.md)** for owner-only maintenance and recovery instructions. **Never** put GitHub tokens or Turnstile secret keys in files under `docs/` or in client-side JavaScript.

## Privacy and local storage

- **Pasted army lists** are parsed in the browser and are not automatically uploaded.
- **Saved imports** use IndexedDB on the current browser/device only; they are not synchronized with GitHub or other devices. Private Browsing, storage cleanup or clearing website data can erase them.
- **Export JSON** and **Backup all JSON** produce local downloads for portability and safekeeping.
- **Reference checks** request public source pages from `tow.whfb.app`.
- **Optional anonymous reports**, if enabled and explicitly submitted, publish only unmatched reference context, not the original roster or player name. Because the repository is public, users must approve this before submitting.

Test/example rosters stored in the repository use anonymised or placeholder player details. Do not commit real players' personal army lists without their permission.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`docs/`](docs/) | Static HTML, CSS, JavaScript and public website assets |
| [`docs/parser.js`](docs/parser.js) | Army-list detection, parsing and normalization |
| [`docs/catalog.js`](docs/catalog.js) | Limited curated reference catalogue |
| [`docs/live-source.js`](docs/live-source.js) | Public sitemap discovery, source profiles, local reference cache and refresh checks |
| [`docs/unmatched-debug.js`](docs/unmatched-debug.js) | Unmatched-only debug report generation |
| [`docs/report-ui.js`](docs/report-ui.js) and [`docs/report-submission.js`](docs/report-submission.js) | Optional public reporting UI and submission client |
| [`worker/`](worker/) | Optional server-side anonymous report receiver; private secrets belong in its deployment environment |
| [`reports/unmatched/`](reports/unmatched/) | Public submitted reports retained as history, plus the consolidated current unresolved-review list |
| [`scripts/`](scripts/) | Source metadata generation and report aggregation |
| [`tests/`](tests/) | Automated parser, matching, status, reporting and regression tests |
| [`docs/examples/`](docs/examples/) | Test army-list fixtures across exporters and layouts |
| [`.github/workflows/`](.github/workflows/) | Automated checks, reference refresh and GitHub Pages/report aggregation workflows |

## Development and testing

The core website is **static HTML, CSS and JavaScript**; no application backend or database server is needed to run an import. Node.js is used for repository tests and support scripts. The optional anonymous reporting service is a separate Cloudflare Worker.

From the repository root:

```bash
node --check docs/app.js
node --check docs/live-source.js
node --test tests/*.test.mjs
```

GitHub Actions runs automated checks on relevant changes. **A passing run is required before treating changes as verified**; check the [latest workflow results](https://github.com/AnthonyWCurtis/old-world-game-manager/actions/workflows/verify-importer.yml), as not every in-progress change may have passed.

### GitHub Pages

The live site is [anthonywcurtis.github.io/old-world-game-manager](https://anthonywcurtis.github.io/old-world-game-manager/).

In [Settings → Pages](https://github.com/AnthonyWCurtis/old-world-game-manager/settings/pages), the site can be published from the `main` branch's `/docs` folder (or an existing configured Pages deployment workflow). No Node.js or server process is required to serve those files.

## Out of scope

Army-list legality validation, independent rules-based point verification, melee/shooting simulation, and full automatic rules interpretation are **not implemented** here. This importer is separate from the Unit vs Unit Calculator and the Sea Guard Garrison Battle Companion projects.

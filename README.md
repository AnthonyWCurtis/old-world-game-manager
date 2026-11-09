# Warhammer: The Old World — Game Manager

A mobile-friendly, browser-based army-list importer for **Warhammer: The Old World**. Paste an army list, identify its export format, inspect the roster, and investigate references that have not yet been linked to the rules source.

**Browser edition: v0.3.3** · **[Open Game Manager](https://anthonywcurtis.github.io/old-world-game-manager/)**

> **Current scope:** Army-list parsing, local saves, reference discovery, and unmatched-reference diagnostics. This is **not** an army-legality checker or combat simulator. A matched source link is not proof that the selected configuration is legal, and an unmatched item is not necessarily invalid.

## Quick start

1. Open the [Game Manager website](https://anthonywcurtis.github.io/old-world-game-manager/).
2. Paste an exported army list into **Paste exported list**, or load one of the 24 supplied test examples.
3. Check the detected builder and layout shown in green. An unrecognised format is shown in red; **Format not right? Choose manually** provides a manual override. A layout can be recognised without the builder's identity being confirmed.
4. Select **Analyse import**. The roster and original order appear immediately. Live-source reference checks then run without replacing the imported selections or points.
5. Expand **Reference matching and import details** to investigate individual unmatched references. Use **Unmatched only** to filter the details.
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

## Rules sitemap reference collection (v0.4 groundwork)

The public [rules sitemap](https://tow.whfb.app/sitemap/rules) is now indexed in the static [rules-reference dataset](docs/reference-records/rules-index.json), with [summary and category counts](docs/reference-records/rules-summary.json). The first retrieval on 9 November 2026 contained **1,833 unique URLs**, including **652 special-rules pages**, across 31 path categories and 32 section links. The [collection registry](docs/reference-records/collections.json) registers Rules alongside Magic and global Armies references.

This is a URL-and-title index only: `source-indexed` means the sitemap contained the link, **not** that its rules text was parsed, validated, or implemented. Some entries are magic, weapons, war machines and army references rather than universal special rules. Ambiguous titles are flagged instead of guessed. A bounded GitHub Action can refresh the list weekly. The live browser matcher does not yet consume these newly generated records.

## Magic lore and spell reference collection (v0.4 groundwork)

The public [Magic sitemap](https://tow.whfb.app/sitemap/magic) is now stored in [magic-index.json](docs/reference-records/magic-index.json) with a [compact summary](docs/reference-records/magic-summary.json). The 9 November 2026 snapshot contains **170 unique source links**: **29 magic lores, 139 spells and 2 guidance pages**. The [collection registry](docs/reference-records/collections.json) makes the Magic, Rules and global Armies collections separately discoverable.

This is a **title-and-link index**, not a rules-text or spell-effects extractor. Spell costs, casting values, lore eligibility and active spell effects must be sourced and verified separately before gameplay calculations. The bounded weekly/manual source refresh retains the previous snapshot on incomplete results. The current v0.3.3 browser importer does not yet consume the new static magic index.

## Global Armies sitemap references (v0.4 groundwork)

The public [Armies sitemap](https://tow.whfb.app/sitemap/armies) is now indexed in [armies-index.json](docs/reference-records/armies-index.json), with a [source summary](docs/reference-records/armies-summary.json) and an [entry in the collection registry](docs/reference-records/collections.json). The initial 9 November 2026 extract contains **600 unique pages**: **19 armies** and **581 units**.

This global index captures **names, page types and actual source URLs only**. It does **not** assert that an indexed unit belongs to a certain army, can be purchased in a particular composition, or has legal points/options. All 45 High Elf unit URLs are included in this global index. The separate High Elf unit manifest, 45 detailed JSON records and their dedicated refresh workflow have been deleted. The global index retains names and URLs only, **not** their detailed statistics or upgrades. The snapshot refreshes through a weekly/manual GitHub Action.

The browser importer remains v0.3.3 and is not yet connected to the new static reference collections. Subsequent matching work must use source evidence for parent-specific upgrades and preserve unmatched status when the global index lacks a unique match.

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

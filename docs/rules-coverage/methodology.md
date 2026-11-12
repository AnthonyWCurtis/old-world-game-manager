# Coverage methodology

Stage 1 is an implementation audit against committed source evidence, not a new transcription of the whole game. Exclusive rules authority: https://tow.whfb.app. Audit date: 2026-11-12; retained source capture/review dates may be older.

## Identity and provenance

`register.json` is generated from all entries in the four source indexes, all recursively nested sourceUrl references in the unit shards, the runtime catalogue, source literals in runtime JavaScript and six reviewed descriptor registries. An ID is `tow:` plus the canonical path; trailing slashes are normalised. Cross-URL semantic equivalence is never guessed. An entry represents a **provisional rule page candidate**, or a context page (unit, army, lore or item grouping). Neither is necessarily one atomic mechanic. No candidates are discarded merely because they appear unimportant.

Each source-backed entry retains source URL, source indexing/capture date, source commit where available, local file, SHA-256 and JSON pointer or code locator. Unit occurrences preserve exact labels, field and owner. `variants` are observed labels, including numerical and conditional qualifiers; they are not independently completed rules. `scope.unitRecordIds` records associations, not rules legality, selected options or army membership eligibility. Special rules remain unsplit universal/faction/unit until source text establishes scope.

`sourceVerificationDate` is null unless an existing reviewed descriptor supplies a dated interpretation. Index `checkedAt` is an indexing date; unit `sourceUpdatedAt` is an upstream publication date. Neither becomes a mechanical verification date. Five spell descriptors have no recorded verification date and retain null; they are excluded from dated interpretation counts. Reviewed descriptor dates are inherited claims from prior work, not a claim this audit freshly fetched every rule. Interpretation scope and unresolved questions remain explicit.

## Deterministic classification

Classification is derived, never manually counted. In precedence order:

1. Explicit unresolved identity/evidence conflict → **Unresolved**.
2. No URL or traceable provenance → **Missing** (catalogue gaps are typed separately).
3. `complete` mode requires a dated interpretation/evidence, code, nonempty enumerated atomic obligations all implemented, and no missing functionality or unresolved questions → **Fully Implemented**. All obligations must additionally map to named automated test files → **Fully Implemented and Tested**. Invalid completion claims fail generation. A reviewer must establish exhaustive obligations before permitting this mode; tooling cannot prove semantic truth.
4. `manual`, `partial`, `conditional` modes → **Manual Support**, **Partial Implementation**, **Conditional Implementation** respectively. These never count as complete even when their limited behavior is tested. Conditional denotes a narrowly projected, player-declared state, not a fully automated rule merely having conditions.
5. Display/reference-only support → **Reference Only**.
6. Dated verified interpretation without implementation → **Source Verified**.
7. Remaining indexed entries → **Source Indexed**.

Review policy is in `reviews.json`; descriptors are consumed from the real runtime registries so additions cannot silently disappear. Unknown registries/modes, broken provenance, stale hashes and unsupported completion claims fail closed. Registered test files prove declared behavior only, not source correctness. Missing functionality and unresolved questions must be cleared by substantive source review and interaction tests, not deleted to improve metrics.

## Six independent measurements

- **Source catalogue:** four-index entry count and URL union; source extraction completeness is separately measured against the pinned unit index. Whole-source closure is unknown.
- **Mechanical interpretation:** candidates with a scoped reviewed descriptor. Full atomic interpretation coverage remains unknown because text/FAQs and atomic obligations are not exhaustively reviewed.
- **Full implementation:** only complete evidence-gated candidates. Manual, conditional and partial entries are excluded.
- **Tested implementation:** only full candidates whose every obligation has tests; tests on partial behavior do not qualify.
- **Interactions:** explicitly reviewed combinations with constituent sources, code, tests and missing functionality. No cartesian-product denominator is invented.
- **Imported selections:** committed example text imported through the actual parser and source matching. Report fixture identity and file/unit/selection evidence, unmatched/unverified data and per-status occurrences separately. Repeated exports are repeated fixtures, not unique armies; no production roster corpus or live saved spell/battle choices is available.

`metrics.json` includes explicitly labelled ratios within the known provisional candidate population. They are not percentages of all Old World rules. Unknown denominators and percentages are JSON null, never zero. Missing catalogue gap records are excluded from rule denominators. Unit associations and optional links do not count as actual player selections.

## Updating and checking

Run `node scripts/build-rules-coverage.mjs`, review generated diffs and `node scripts/build-rules-coverage.mjs --check`. Tests and CI verify byte-identical regeneration without network or wall-clock input. Inputs are hashed, including runtime files, source snapshots, cited test/evidence files, generation scripts and imported fixture files. Register entries are generated one per line to keep diffs reviewable. New snapshots preserve original source dates; reviewers update evidence, scopes, obligations and backlog deliberately. Do not manually edit generated artifacts. No generated files are added to the offline app shell or runtime imports.

The bounded public robots and top-level sitemap checks on 2026-11-12 allowed public paths and identified the existing four sitemap sections. Robots disallows `/api/*`, `/apps/*`, `/public/apps/*` and `/regenerate`. No restricted paths or bulk crawl were used. New public source verification must respect current restrictions, stop on access failures and leave unresolved evidence visible.

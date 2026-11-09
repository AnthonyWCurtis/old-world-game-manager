# Live source cache and revalidation (v0.2.1)

The browser edition uses public HTML from **https://tow.whfb.app** and never requests its robots-excluded `/api/*`, `/apps/*`, `/public/apps/*` or `/regenerate` paths.

## Cache-first lifecycle

1. Import or open any army (including saved snapshots) using the existing 15-layout parser. Army selections and imported costs remain unchanged.
2. Read any previously saved source records in a separate browser IndexedDB database (`old-world-manager-source-cache`). This cache is private to the browser/device and is not synchronised with GitHub.
3. Display cached link matches immediately. Perform a background freshness check of the permitted public sitemap pages `/sitemap/armies`, `/sitemap/magic-items`, and `/sitemap/rules`. Each index is refreshed when older than **six hours** or when the user explicitly presses **Check for updates now**.
4. Match names conservatively against unique exact sitemap labels (with a final-plural-`s` fallback or a copied `3×` quantity prefix). Never infer an unlisted rule, select one of multiple ambiguous matches, or declare a unit legal.
5. Check up to **12** distinct referenced HTML source pages per import when their fingerprint is older than **24 hours**. Cache a SHA-256 digest of visible content, source URL, check timestamp and, for unit pages, explicitly structured base profiles (M, WS, BS, S, T, W, I, A, Ld, base cost, troop type and category when present).
6. If a page changes, show a change notification. Do not silently overwrite the pasted army's costs or equipment. If upstream or browser storage is unavailable, preserve existing imported data and cached records; a source failure is not an import failure.

The manual **Check for updates now** button bypasses the freshness intervals but still caps page requests at 12; additional due pages are checked on subsequent imports. Requests are serial and limited to pages linked to the user's imported roster. A browser without IndexedDB uses an ephemeral in-memory fallback.

## Verified reachability

On 9 November 2026, a GitHub Actions probe confirmed:
- `https://tow.whfb.app/robots.txt` permits ordinary public page paths while excluding API and app paths.
- The site's `/sitemap/armies`, `/sitemap/rules` and `/sitemap/magic-items` return HTML with `Access-Control-Allow-Origin: *`.
- The `/unit/night-goblin-oddnob` page returns browser-readable HTML and a structured characteristics table. Python's default automated user agent initially received HTTP 403; a browser-style request succeeded. Client access therefore must be treated as fallible and never assumed in all environments.

## Known limitations

- This **is not a full structured import of special-rule or magic-item effects**. For now these are source-index references plus page-change fingerprints. No combat calculations or validation are derived from them.
- `docs/catalog.js` is retained as a starter offline fallback; the live indexes are faction-independent, not a growing hardcoded list of individual user rosters.
- A source match means that a unique name was found at the public rules index, **not** that the selection or cost is legal for its parent model.
- Source profile base costs differ from equipped army-list totals by design; neither is recomputed from the other.
- The original exported text is preserved for audit. No user army roster is uploaded to `tow.whfb.app`; only generic source index pages and referenced unit/rules pages are requested.

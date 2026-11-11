# Admin Report Review Dashboard

**Date:** 2026-11-11  
**Status:** User requested an authenticated admin page for submitted report inspection and issue review.

## Existing state
- Public Game Manager is static GitHub Pages.
- Public submissions reach deployed Cloudflare Worker `old-world-unmatched-reports.oldworldcompanion.workers.dev` (`POST /report`), guarded by Turnstile and mandatory per-IP rate limit.
- The Worker holds a private fine-grained GitHub contents-write token, and commits public, anonymised records at `reports/unmatched/report-*.txt`.
- Existing `reports/unmatched/ALL_UNMATCHED.txt` groups recurring references by verified catalogue lookup, **not an editable issue tracker**.
- There are currently three submitted reports; they contain unmatched reference names, parent unit, line, export format, optional faction, *not the complete army or player's identity*.

## Requested experience
Open `https://old-world-unmatched-reports.oldworldcompanion.workers.dev/admin`, sign in with the repository-owner **GitHub** account, and see:
- All individual submitted reports with date, faction, exporter, item count.
- Every reported unmatched unit/selection, occurrence context, line, source link and related report filename.
- Search/filter by label, faction, status; counts for new, investigating and reviewed issues.
- A per-item review action: Open / Investigating / Fixed (requires evidence link) / Not an issue / Needs more information, with short public note and supporting source or project PR/commit link.
- Preserved audit trail and visible distinction between **review status** and **actually fixed source catalogue/parser**. Marking reviewed does **not** change the importer, verified rules index or `ALL_UNMATCHED.txt`.
- Mobile-friendly view including iPhone Safari.

## Security architecture
- Admin HTML/CSS/JS is served from the **Cloudflare Worker origin** (first-party HTTPS cookies on iPhone). The static public game need not include any login code or secret.
- GitHub OAuth **web authorization code + PKCE + random state** handled entirely by Worker; no requested private-repo access scope. GitHub identity verified server-side via `GET /user`; only `ADMIN_GITHUB_LOGIN` allowed, currently intended as `AnthonyWCurtis`. Use numeric user ID from GitHub in signed session, plus short expiry.
- OAuth client ID public Worker variable; **OAuth client secret** and `ADMIN_SESSION_SECRET` Worker secrets. Reuse existing `GITHUB_TOKEN` secret only server-side for contents API access.
- HttpOnly, Secure, SameSite=Lax, host-only admin session cookie, HMAC authenticated, max 8h; cookie is inaccessible to JS. Logout clears cookie; expiry/rotation ends server trust.
- Admin mutation POST requires same-origin `Origin` header and valid session; strict JSON/body sizes, filename/entry/status/link validation and no cross-site CORS. Restrict API paths to report filenames. Content-Security-Policy and textContent-only rendering; user-supplied report text and notes are untrusted.
- Preserve the existing `POST /report` and its origin checks, Turnstile, rate limiting and payload shape; do not alter public submission consent.
- Admin configuration missing → show setup-required message; **never** bypass authentication.
- GitHub API write conflicts handled by re-reading and retrying SHA-based file updates. Review data committed to `reports/admin/reviews.json`, which, like the existing reports, is **public**. UI explicitly warns not to put secrets or private details in notes.
- No full-army viewing: current reports do not include rosters. Uploading optional full-army reports would be a separate player-consented workflow and retention/privacy design.

## Delivery
- `worker/admin-auth.mjs`: OAuth, PKCE, session signing/verification.
- `worker/admin-reports.mjs`: strict report parsing, validation, source URL safe-links and review state API.
- `worker/admin-page.mjs`: secure HTML/CSS/browser JS served only after authentication.
- `worker/unmatched-report-worker.mjs`: additional admin routes in front of unchanged public report handler.
- `worker/wrangler.toml`: public config for GitHub OAuth client ID and username allowlist; secrets never committed.
- `reports/admin/reviews.json`: initial empty public triage store, safely editable via Worker.
- Tests for OAuth gates, public report compatibility, untrusted content, persistence failures and mobile UI.
- Deployment requires the user to create a GitHub OAuth app and set the new Cloudflare Worker secrets via Wrangler. Source code merging does **not** automatically deploy the existing Worker; do not claim it is live without testing its actual /admin endpoint.

## Source documentation
GitHub: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
GitHub Contents API: https://docs.github.com/en/rest/repos/contents

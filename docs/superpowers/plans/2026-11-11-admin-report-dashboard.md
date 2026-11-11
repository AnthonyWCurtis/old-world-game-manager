# Admin Report Review Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Write failing tests before each code task.

**Goal:** Securely review reported unmatched references from a mobile-friendly, GitHub-authenticated admin dashboard without exposing write credentials or changing the public reporting flow.

**Architecture:** Existing Cloudflare Worker serves same-origin admin HTML, handles GitHub OAuth and signed first-party sessions, reads anonymised GitHub reports and writes a separate public review-status file. Existing GitHub Pages game stays static.

**Tech Stack:** Cloudflare Workers, WebCrypto, GitHub OAuth + contents API, vanilla HTML/CSS/JS, Node built-in tests.

**Spec:** [docs/superpowers/specs/2026-11-11-admin-report-dashboard.md](../specs/2026-11-11-admin-report-dashboard.md)

## Global Constraints
- Existing public /report stays authenticated by Turnstile, with rate limit unchanged.
- No Worker secret or GitHub write token in browser code, report files or repository.
- No full army lists are currently submitted; only anonymised unmatched references.
- No client-side fake login; server verifies GitHub identity and all review mutations.
- Notes are public in repo; don't imply private internal issue comments.
- Preserve reviewed source truth and `ALL_UNMATCHED.txt` semantics. Review state is triage, not a code fix.

## Review Focus
- Unauthorized GET /admin and APIs cannot leak admin-only editing capability (reports remain publicly visible in GitHub); mutation must return 401/403.
- Spoofed OAuth state, unauthorized GitHub user, expired/forged session and cross-origin POST are rejected.
- Malicious report text/notes/filenames cannot produce script execution or path traversal.
- GitHub concurrent edits return 409/422; retry reloads SHA before safely updating.
- Existing public report POST works exactly as before, including Turnstile, origin check and rate limit.

---

### Task 1: Report parser and triage data validation
**Files:** Create `worker/admin-reports.mjs`, `tests/admin-reports.test.mjs`, `reports/admin/reviews.json`.
**Interfaces:** `parseReportFile(fileName,text)`, `validateReview(input)`, `summarizeReports(reportRecords,reviews)`.
- [ ] Write failing tests using existing report files and malformed entries/links.
- [ ] Run Node tests RED.
- [ ] Implement pure parsers and validation; return only safe report fields, text not HTML.
- [ ] Run GREEN; commit.

### Task 2: OAuth and session security
**Files:** Create `worker/admin-auth.mjs`, `tests/admin-auth.test.mjs`.
**Interfaces:** `startGithubLogin(request,env)`, `finishGithubLogin(request,env)`, `readAdminSession(request,env)`, `logoutAdmin(request)`.
- [ ] Write RED tests for missing config, OAuth PKCE/state, login allowlist, signed session, forgery/expiry, logout.
- [ ] Implement with WebCrypto, no OAuth scope requests.
- [ ] Run GREEN; commit.

### Task 3: Worker routes, GitHub reads and reviews
**Files:** Modify `worker/unmatched-report-worker.mjs`; create `worker/admin-api.mjs` and `tests/admin-worker.test.mjs`.
**Interfaces:** `handleAdminRequest(request,env)` for `/admin`, `/auth/github`, `/auth/callback`, `/admin/api/reports`, `/admin/api/review`, `/admin/logout`.
- [ ] Write RED tests: unauthenticated blocked, authenticated records loaded, unknown files rejected, valid triage mutation persisted, Origin checked, public POST /report untouched.
- [ ] Implement GitHub Contents read and versioned write with 3 retry attempts on SHA conflicts.
- [ ] Run GREEN; commit.

### Task 4: Dashboard UI and deployment handoff
**Files:** Create `worker/admin-page.mjs`, `tests/admin-page.test.mjs`; update `worker/wrangler.toml` and `ANONYMOUS_REPORTING_SETUP.md`.
**Interfaces:** HTML page with accessible report list/filter and DOM-based review controls, served under authenticated Worker origin; JS fetches same-origin API.
- [ ] Write RED UI tests (login, status, untrusted text, source links, save errors, mobile).
- [ ] Implement mobile-first UI and CSP.
- [ ] Run Node suite and Worker route tests GREEN; release PR to main.
- [ ] Document GitHub OAuth App callback and Cloudflare secrets to activate live service; don't claim deployed without OAuth setup, Worker deploy and real endpoint check.

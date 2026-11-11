# Anonymous unmatched-reference reports — deployed and owner setup

The Game Manager website is hosted on GitHub Pages. GitHub Pages is **read-only** and cannot safely save GitHub files directly from a visitor's browser. This integration uses a small Cloudflare Worker to accept public submissions and privately write text files to this repository. Players **never need a GitHub account**.

**Current status (9 November 2026):** Deployed and verified end-to-end. The live Worker is `https://old-world-unmatched-reports.oldworldcompanion.workers.dev`; the [public reporting configuration](docs/report-config.json) is enabled. One real submission was accepted and aggregated. **Do not repeat setup unless recovering, changing providers or rotating credentials.**

These steps are retained for future recovery or a fresh deployment.

## One-time setup for a new Worker

1. Create or sign into a **Cloudflare** account. Set up a **Turnstile** widget for the hostname `anthonywcurtis.github.io`. Copy the public **site key** and the private **secret key**. The widget's action is `unmatched_report`.
2. In GitHub, create a **fine-grained personal access token** restricted to the repository `AnthonyWCurtis/old-world-game-manager` with **Contents: Read and write**. Never put this token into public files, GitHub Pages, or client JavaScript.
3. In your terminal, using `wrangler` (Cloudflare Workers CLI), deploy the prepared service:

   ```bash
   cd worker
   npx wrangler@latest login
   npx wrangler@latest deploy
   npx wrangler@latest secret put GITHUB_TOKEN
   npx wrangler@latest secret put TURNSTILE_SECRET
   ```

   Paste each **secret value** only when prompted in your terminal. The Worker uses `worker/wrangler.toml` and has a mandatory per-client rate limit. Never commit a `.dev.vars` file or any secret.
4. Copy the real HTTPS `workers.dev` endpoint from the successful deployment, append `/report`, and change `docs/report-config.json`:

   ```json
   {
     "enabled": true,
     "endpoint": "https://YOUR-REAL-WORKER.workers.dev/report",
     "turnstileSiteKey": "YOUR-PUBLIC-SITE-KEY"
   }
   ```

   These **two** values are public and safe to publish. Keep `enabled: false` until the service is fully configured. Do not change `worker/unmatched-report-worker.mjs` to contain any tokens.
5. Commit `docs/report-config.json` and confirm GitHub Pages has deployed. Open the Game Manager, paste a list with an unmatched selection, and tap **Report unmatched**. The player reviews exactly what will be published, agrees to share, completes human verification, and taps **Submit report**.

## Where the files appear

- **Individual reports:** `reports/unmatched/report-*.txt`. Only unmatched names, parent unit names, source line, optional faction, and source URLs; *not* full lists, player names, or tokens.
- **Combined report to copy into ChatGPT:** [reports/unmatched/ALL_UNMATCHED.txt](reports/unmatched/ALL_UNMATCHED.txt). The [aggregation workflow](.github/workflows/aggregate-unmatched.yml) rebuilds it after reports or reviewed-catalogue changes. It groups repeated unresolved names by parent unit, excludes entries since linked by verified source references, and counts resolved historical occurrences; original report files remain unchanged. It can also be run manually under GitHub Actions.
- **Status:** The app confirms success only after GitHub accepts the file. If submission fails, players can still use the existing **Copy unmatched debug** feature.

**Ongoing requirements:** Maintain the Cloudflare Worker, Turnstile keys and server-side GitHub write token (which may expire). If the token expires or Worker is disabled, submissions will fail until restored. Turnstile and rate limiting reduce spam but cannot eliminate it. Reports remain publicly visible. Never publish private credentials.

---

## Owner-only Report Admin (new)

**Current state:** The code now contains an authenticated admin console, but **GitHub OAuth must be configured and the Worker redeployed before login works**. Simply merging a GitHub PR does not deploy the separately hosted Cloudflare Worker.

**Admin URL after activation:** https://old-world-unmatched-reports.oldworldcompanion.workers.dev/admin

### 1. Register the GitHub OAuth App

Sign into the GitHub account allowed to administer the repository (default allowlist: `AnthonyWCurtis`). Visit [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.

- **Application name:** `Old World Companion Admin`
- **Homepage URL:** `https://old-world-unmatched-reports.oldworldcompanion.workers.dev/admin`
- **Authorization callback URL:** `https://old-world-unmatched-reports.oldworldcompanion.workers.dev/auth/callback`

Copy the **Client ID** (public) and generate a **Client secret** (private). The OAuth flow requests no private repository scopes; the Worker independently checks the signed-in GitHub account identity using `GET /user`. The existing Worker GitHub contents token handles permitted repository writes only on the server.

### 2. Set the public Worker configuration

In `worker/wrangler.toml`, replace the empty `ADMIN_GITHUB_CLIENT_ID = ""` with your actual client ID. Keep:

- `ADMIN_PUBLIC_ORIGIN = "https://old-world-unmatched-reports.oldworldcompanion.workers.dev"`
- `ADMIN_GITHUB_LOGIN = "AnthonyWCurtis"` (change only if the authorized GitHub account differs).

The repository version does **not** contain the private OAuth client secret.

### 3. Add private Cloudflare secrets

Using your own trusted terminal (do **not** send the secrets in ChatGPT or commit them):

```powershell
cd worker
npx wrangler@latest login
npx wrangler@latest secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler@latest secret put ADMIN_SESSION_SECRET
npx wrangler@latest deploy
```

Enter the GitHub OAuth **Client secret** when prompted for `GITHUB_OAUTH_CLIENT_SECRET`. For `ADMIN_SESSION_SECRET`, generate a unique random 32-byte (or longer) key and paste only into Wrangler. One way to generate it locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The existing `GITHUB_TOKEN`, `TURNSTILE_SECRET`, and `REPORT_RATE_LIMITER` must remain configured for public reports. Do not replace or reveal the existing GitHub write token.

### 4. Confirm end-to-end operation

1. Open the admin URL above in a private browser window. It must offer **Sign in with GitHub**, and `/admin/api/reports` must reject unauthorized requests with **401**.
2. Sign into the configured GitHub account, approve the OAuth app and confirm you see the submitted report queue.
3. Open a report, inspect a missing source reference and save an **Investigating** status with a short note.
4. Confirm the status is saved to `reports/admin/reviews.json` in GitHub. The UI and notes are **public**; do not enter secrets, player details or confidential material.
5. Test **Sign out** and confirm protected API requests fail.
6. Submit a public unmatched report from the normal Game Manager to confirm the existing Turnstile/rate-limited `POST /report` flow still works.

**Security:** Admin cookies are first-party on the Worker domain and signed, `HttpOnly`, `Secure`, `SameSite=Lax` and valid for at most 8 hours. OAuth uses random state and PKCE. All POST mutations require an authenticated session plus same-origin `Origin`; the Worker never sends write credentials to browser JavaScript. The dashboard uses a strict Content-Security-Policy, no `innerHTML`, and rejects arbitrary report paths.

**Report scope:** The current public submissions include **only missing reference names, parent units, source lines and URLs**. The admin page can review the problems; it cannot reconstruct complete pasted army lists or identify the player. The archive and review file are public GitHub content. Changing an entry's review status is **triage only**: it does not fix source matching or remove the entry from `ALL_UNMATCHED.txt` until the verified catalogue/parser is updated and the aggregation runs. A `Fixed` review status requires a project PR or commit evidence URL.

**Troubleshooting:** If the admin page says `not yet configured`, verify the public client ID and both new secrets, then redeploy. A 403 after GitHub login means that account is not on the configured allowlist. A 502 when saving reviews means Worker `GITHUB_TOKEN` access or GitHub's Contents API must be checked; repository file updates use SHA-retry to handle concurrent changes. If the domain changes, update both the Worker origin and GitHub OAuth callback URL.

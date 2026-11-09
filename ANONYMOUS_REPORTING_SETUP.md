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

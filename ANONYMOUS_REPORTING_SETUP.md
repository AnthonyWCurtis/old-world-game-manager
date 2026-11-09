# Enable anonymous unmatched-reference reports

The Game Manager website is hosted on GitHub Pages. GitHub Pages is **read-only** and cannot safely save GitHub files directly from a visitor's browser. This integration uses a small Cloudflare Worker to accept public submissions and privately write text files to this repository. Players **never need a GitHub account**.

## One-time setup for the repository owner

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
- **Combined report to copy into ChatGPT:** [reports/unmatched/ALL_UNMATCHED.txt](../reports/unmatched/ALL_UNMATCHED.txt). The [aggregation workflow](../.github/workflows/aggregate-unmatched.yml) regenerates it following a report commit and groups repeated names by parent unit with occurrence counts. It can also be run manually under GitHub Actions.
- **Status:** The app confirms success only after GitHub accepts the file. If submission fails, players can still use the existing **Copy unmatched debug** feature.

**Limitations:** The Worker requires an owner-controlled Cloudflare deployment and GitHub token; I have not configured or deployed those services on your behalf. Until configured, the public website's reporting button remains disabled and shows that setup is required. Turnstile and rate limiting reduce spam but do not eliminate it. Report files are public on GitHub.

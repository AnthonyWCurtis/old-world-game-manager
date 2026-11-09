# Warhammer: The Old World — Game Manager (v0.1)

A mobile-friendly **army-list importer**, built to run entirely in the browser on GitHub Pages.

**Status:** Browser edition files are under `/docs` on the `main` branch. GitHub Pages must be enabled in repository settings using **Deploy from a branch → main → /docs → Save**.

Once published: https://anthonywcurtis.github.io/old-world-game-manager/

## Supported pasted-list formats

- **Old World Builder:** regular, compact, minimalist, and their Discord/Markdown variants (6)
- **Ingude:** simple text, compact, Markdown (3)
- **New Recruit:** TOW, NR, simple (3)
- **Old World Rankings / Battle Builder:** compact, detailed, tournament (3)

The importer auto-detects the source where possible, preserves the exact original paste, keeps separate unit instances and model groups, and shows ambiguous or unmatched entries. A starter reference catalogue provides links to tow.whfb.app where available.

## Privacy and storage

Pasted lists are processed locally in the browser, not uploaded to GitHub. Saved imports use **IndexedDB** on the same browser/device and are not synced. Use **Export JSON** or **Backup all JSON** regularly. Clearing browser data may remove saved armies.

Publicly committed sample rosters have identifying player names replaced by placeholders. Do not commit personal roster data to the public repository.

## Scope

Version 0.1 focuses on parsing, storage and reference matching. **No legality checks or combat calculations.** An unmatched reference does not mean a selection is illegal.

## GitHub Pages setup

Open [Settings → Pages](https://github.com/AnthonyWCurtis/old-world-game-manager/settings/pages), select **Deploy from a branch**, then **main**, then **/docs**, and save. The website may take a few minutes to appear.

The site is static HTML, CSS and JavaScript; it requires no server, SQLite, Node.js, or build step to run.

# Unit Profiles — version history

This version is **for the Unit Profiles display inside the Game Manager's Units tab**.
It is deliberately independent of the army-list importer, game rules engine,
source-data snapshot version and offline-cache identifier.

## v0.2 — 12 November 2026

- Replaced the two duplicate `Imported selections` and `Published equipment & rules`
  disclosures with one visible **Equipment & special rules** panel.
- Grouped imported equipment, standard starting equipment, selected items,
  command upgrades, inherited special rules and selected optional rules.
- Display exact imported entries first; add only source-backed missing defaults.
- Avoid duplicate equipment/rule names; source-backed replacement upgrades hide
  superseded default entries when the selected replacement is established.
- Keep all unmatched or uncertain imported entries visible without guessing effects.
- Rules/points calculations, imported data and saved battle state are unchanged.

## v0.1 — 12 November 2026

First tracked Unit Profiles release:

- Display source-backed characteristics for imported models and selected mount profiles.
- Keep unselected champion profiles and unselected optional rules out of the everyday unit view.
- Retain applicable starting rules and standard equipment even if the exporter omits them.
- Group imported selections, published equipment/rules and source metadata into expandable sections.
- Preserve source links, review statuses, roster values and separate rider/mount data.
- Show a visible Unit Profiles version and an in-app "What's new?" summary.

### Versioning convention

Change `UNIT_PROFILES_VERSION` in `docs/army-roster-page.js` when the
profile display meaningfully changes. Update the fallback label and "What's new?"
text in `docs/index.html`, this history, tests, and the offline shell cache
revision together.

- v0.3: next profile feature update.
- v0.4: subsequent profile feature update.
- A separate importer or source refresh does **not** bump this number unless
  it changes how the Unit Profiles screen behaves.

Do not use the display version as the game-data, battle-state or import schema version.

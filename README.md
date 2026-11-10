# Independent Warhammer: The Old World source data (v1.1)

**Dataset:** 581 unit pages, 19 army pages, 960 model profiles.
**Source:** https://tow.whfb.app/sitemap/armies, plus the public linked unit/army pages.
**Snapshot:** 10 November 2026. This is not a live rules database.

This is a **dedicated data-only branch** of the GitHub repository, separated
from the Game Manager app. It has no application files and should not be merged
into the game's deployed branch unless deliberately chosen.

## Contents

- \`old-world-all-armies-units.json\`: the complete combined dataset.
- \`old-world-units-by-id.json\`: units indexed by stable IDs, e.g. \`unit:lothern-sea-guard\`.
- \`old-world-armies-by-id.json\`: 19 armies indexed by ID.
- \`units/\`: 581 individual unit JSON files.
- \`armies/\`: 19 individual army source JSON files.
- \`manifest.json\`: IDs and source URL references.
- \`coverage-report.json\`: counts, validation status, and warning summaries.

## Example lookup

\`\`\`python
import json
with open("old-world-units-by-id.json", encoding="utf-8") as fp:
    units = json.load(fp)
sea_guard = units["unit:lothern-sea-guard"]
print(sea_guard["modelProfiles"])
print(sea_guard["upgradeGroups"])
\`\`\`

## Data integrity

The unit pages supply model characteristics, cost descriptions, equipment and
special-rule links, upgrade clauses and source revision information. Their
individual option descriptions are source-derived and are **not** executable
rules. The Wood Elf Beast Pack composite model is explicitly flagged as a
special extraction case. 269 records contain warnings; all 581 require human
rules/legality verification before use as gameplay authority.

A unit's presence in the global sitemap **does not** prove that it is legal in
a particular faction or composition. This dataset does not mirror the complete
text of equipment/special rules and does not provide an independent rules engine.

Warhammer: The Old World and associated IP belong to their respective rights
holders. This fan-created data snapshot is not an official publication.

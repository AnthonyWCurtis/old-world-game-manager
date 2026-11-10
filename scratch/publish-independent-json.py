#!/usr/bin/env python3
"""Repackage the complete previously-extracted public source dataset without re-scraping.

Input 1: GitHub Actions artifact from completed 2026-11-10 full run
Input 2: source-derived Wood Elf Beast Pack composite fallback (gzip+base64)

Output: an independent, data-only snapshot, not an application.
"""
from collections import Counter
from pathlib import Path
import base64
import gzip
import hashlib
import json
import os
import re

ROOT=Path(__file__).resolve().parents[1]
RAW=Path(os.environ.get("SOURCE_RAW",str(ROOT/"scratch-output"/"old-world-all-armies-units.json")))
EXCEPTION=ROOT/"scratch"/"wood-elf-beast-pack.source-composite.json.gz.b64"
OUT=Path(os.environ.get("DATA_OUTPUT","/tmp/old-world-data-export"))
SITEMAP="https://tow.whfb.app/sitemap/armies"
def write_json(path, obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def checks(objects,kind):
    ids=[x["id"] for x in objects]
    urls=[x["source"]["sourceUrl"] for x in objects]
    assert len(ids)==len(set(ids)),kind+" has duplicate ids"
    assert len(urls)==len(set(urls)),kind+" has duplicate URLs"
    for x in objects:
        assert re.fullmatch(rf"https://tow\.whfb\.app/{kind}/[a-z0-9-]+",x["source"]["sourceUrl"]),x["id"]
        assert x["source"].get("verificationStatus")=="source-extracted",x["id"]
        assert x["name"],x["id"]
def main():
    assert RAW.is_file(),"Full source export artifact missing"
    full=json.loads(RAW.read_text(encoding="utf-8"))
    assert full["coverage"]["sourceUnitCount"]==581
    assert full["coverage"]["sourceArmyCount"]==19
    assert len(full["units"])==580
    assert len(full["armies"])==19
    assert {x["sourceUrl"] for x in full["failures"]}=={
       "https://tow.whfb.app/unit/wood-elf-beast-pack"
    },"Unexpected failed source pages"
    special=json.loads(gzip.decompress(base64.b64decode(EXCEPTION.read_text().strip())).decode("utf-8"))
    assert special["id"]=="unit:wood-elf-beast-pack"
    assert len(special["modelProfiles"])==5
    assert special["source"]["sourceUrl"]=="https://tow.whfb.app/unit/wood-elf-beast-pack"
    assert special["source"].get("verificationStatus")=="source-extracted"
    units=sorted(full["units"]+[special],key=lambda x:x["id"])
    armies=sorted(full["armies"],key=lambda x:x["id"])
    checks(units,"unit");checks(armies,"army")
    assert len(units)==581 and len(armies)==19
    assert all(len(u["modelProfiles"])>=1 for u in units)
    lsg=next(x for x in units if x["id"]=="unit:lothern-sea-guard")
    assert lsg["basePoints"]["amount"]==10
    assert len(lsg["modelProfiles"])==2
    assert len(lsg["startingEquipment"])==4
    assert len(lsg["startingRules"])==5
    assert len(lsg["upgradeGroups"])==3
    assert sum(len(g["options"]) for g in lsg["upgradeGroups"])==7
    assert lsg["upgradeGroups"][2]["eligibilityClause"]=="0-1 unit per 1,000 points may:"
    full["units"]=units
    full["armies"]=armies
    full["failures"]=[]
    full["coverage"].update({
      "unitPagesFetched":581,"armyPagesFetched":19,"failedPages":0,
      "compositePagesFromLiveSource":1,"remoteEmbeddedPagesExtracted":580
    })
    for u in units:write_json(OUT/"units"/(u["id"].split(":",1)[1]+".json"),u)
    for a in armies:write_json(OUT/"armies"/(a["id"].split(":",1)[1]+".json"),a)
    by_unit={x["id"]:x for x in units}
    by_army={x["id"]:x for x in armies}
    write_json(OUT/"old-world-all-armies-units.json",full)
    write_json(OUT/"old-world-units-by-id.json",by_unit)
    write_json(OUT/"old-world-armies-by-id.json",by_army)
    manifest={
      "schemaVersion":"1.1.0",
      "kind":"independent-old-world-source-reference-index",
      "sourceUrl":SITEMAP,"checkedAt":full["source"]["checkedAt"],
      "unitCount":len(units),"armyCount":len(armies),
      "unitIndex":[{"id":u["id"],"name":u["name"],"sourceUrl":u["source"]["sourceUrl"],
                    "path":"units/"+u["id"].split(":",1)[1]+".json"} for u in units],
      "armyIndex":[{"id":a["id"],"name":a["name"],"sourceUrl":a["source"]["sourceUrl"],
                    "path":"armies/"+a["id"].split(":",1)[1]+".json"} for a in armies],
      "specialCase":{"id":"unit:wood-elf-beast-pack",
                     "extractionMethod":"live-source-page-manual-fallback"}
    }
    write_json(OUT/"manifest.json",manifest)
    warnings=Counter(w for x in units for w in x.get("extractionWarnings",[]))
    report={
      "dataset":"old-world-all-armies-units.json",
      "schemaVersion":"1.1.0",
      "unitPages":len(units),"armyPages":len(armies),
      "modelProfiles":sum(len(x["modelProfiles"]) for x in units),
      "startingEquipmentReferences":sum(len(x.get("startingEquipment",[])) for x in units),
      "startingRuleReferences":sum(len(x.get("startingRules",[])) for x in units),
      "optionalRuleReferences":sum(len(x.get("optionalRules",[])) for x in units),
      "upgradeGroups":sum(len(x.get("upgradeGroups",[])) for x in units),
      "upgradeChoices":sum(sum(len(g["options"]) for g in x.get("upgradeGroups",[])) for x in units),
      "unitArmyMembershipLinks":sum(len(x.get("listedInArmies",[])) for x in units),
      "recordsRequiringReview":len(units),
      "unitsWithWarnings":sum(bool(x.get("extractionWarnings")) for x in units),
      "warningsByDescription":dict(warnings.most_common()),
      "failures":[],
      "lothernSeaGuard":{"present":True,"optionsExtracted":7},
      "validationPassed":True,"validationErrors":[],
      "sourceExplanation":"All listed army and unit pages represented. Source-extracted data is not independent rules or legality verification.",
      "compositeFallback":"Wood Elf Beast Pack: model components transcribed from linked public pages because the standard embedded unitProfile was absent."
    }
    assert report["modelProfiles"]==960
    assert report["upgradeChoices"]==2435
    assert report["upgradeGroups"]==1205
    assert report["unitsWithWarnings"]==269
    write_json(OUT/"coverage-report.json",report)
    readme="""# Independent Warhammer: The Old World source data (v1.1)

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
"""
    (OUT/"README.md").write_text(readme,encoding="utf-8")
    assert sum(1 for _ in (OUT/"units").glob("*.json"))==581
    assert sum(1 for _ in (OUT/"armies").glob("*.json"))==19
    print("EXPORTED",json.dumps({
      "units":len(units),"armies":len(armies),"models":report["modelProfiles"],
      "options":report["upgradeChoices"],"warnings":report["unitsWithWarnings"],
      "files":sum(1 for _ in OUT.rglob("*") if _.is_file()),
      "sizeBytes":sum(_.stat().st_size for _ in OUT.rglob("*") if _.is_file())
    }),flush=True)
if __name__=="__main__":main()

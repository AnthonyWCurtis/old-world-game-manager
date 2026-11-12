# Source-backed effect coverage: reproducible audit

Reviewed 12 November 2026. Exclusive rules source: https://tow.whfb.app.

## Why

A source link is **not** proof that the Game Manager implements a rule.
The shipped unit snapshot covers 581 indexed published units, but the
item/effect projection intentionally interprets only a reviewed subset.

## Repeatable audit

Run from the repository root:

    node scripts/audit-rule-effect-coverage.mjs
    node scripts/audit-rule-effect-coverage.mjs --json

The script reads the checked-in unit index and 32 unit-data shards, plus the
indexed magic-items catalogue and the reviewed effect descriptors. It does
not crawl the website, modify army data, alter points or contact a backend.

It reports:
- Verified/missing/unverified source records and extraction warnings
- Starting special-rule occurrences on source-verified units
- Starting rule occurrences with **reviewed character/inherited projection**
  versus occurrences **reference-only in that projector**
- Optional special-rule references, explicitly **not presumed equipped**
- Source-indexed magic item/ability pages versus reviewed magic-item effect
  descriptors; these are not comparable as a universal implementation ratio
- The most common source-only starting rules, ranked by occurrences, with
  source links and sample units

**Interpretation:** "Reference-only" here means not implemented by this
specific character/inherited-effect projector. Some such rules may already
be handled by other subsystems, and others are informational or depend on
dice, position, formation and timing. The magic catalogue includes abilities,
honours and other links; it is not a list of implemented combat item effects.

## Newly reviewed: Stupidity (character-to-regiment contagion)

- Source: https://tow.whfb.app/special-rules/stupidity
- FAQ: https://tow.whfb.app/faq/universal-special-rules
  (Official FAQ and Errata v1.5.3 as displayed, checked 12 November 2026)
- Application: a matching, source-extracted character with Stupidity makes a
  regiment it is **recorded as joining** subject to Stupidity. That inherited
  rule disappears when the character is recorded leaving the regiment.
- The screen states when the Leadership test is needed and consequences of a
  failed test, but does not assume a result, validate a join, alter base
  characteristics, or change combat outcomes.
- **The real Ishaya Vess source record does not have Stupidity.** Tests use
  an explicitly synthetic verified-format record to exercise generic logic.
  No High Elf or other faction receives an invented rule.
- Incorrect character URLs, unverified records, mismatched rule names and
  rule URLs all fail closed.

The existing reviewed Precision Strikes rule remains scoped to Ishaya Vess
and Lothern Sea Guard, per
https://tow.whfb.app/special-rules/precision-strikes.

## Tests and next steps

The source snapshot and synthetic negative cases are checked in
tests/rule-effect-coverage-audit.test.mjs. Character joining, detachment,
scope, source proof and immutable army data are checked in
tests/source-special-rule-effects.test.mjs. Both run under
node --test tests/*.test.mjs and the Verify army importer workflow.

Next, triage common reference-only rules against actual imported rosters.
Record the source, target, owner, trigger and FAQ exceptions per rule. Keep
manual, conditional and fully calculated effects separate. Only include
numeric calculations in the combat engine when every prerequisite has a
verified interpretation and a test. No faction-specific engine branches.


## Reviewed manual-reference rules — 12 November 2026

The next reviewed source-rule layer gives player-facing **manual-only**
interpretations to common starting rules. It is a reusable rules registry,
not faction-specific implementation. These are *not* automatic calculations:

| Source rule | How the reminder is scoped | Canonical rule URL |
| --- | --- | --- |
| Close Order | Formation permission; actual formation and all models still require checking | https://tow.whfb.app/special-rules/close-order |
| Swiftstride | Charge/Flee/Pursuit choice; **entire** unit requirement, including joined characters | https://tow.whfb.app/special-rules/swiftstride |
| Regeneration (X+) | Individual model recovery after losing a Wound; still counts in combat resolution | https://tow.whfb.app/special-rules/regeneration |
| Impact Hits (X) | Charging model, moved at least 3", in base contact; early automatic hits | https://tow.whfb.app/special-rules/impact-hits |
| Stomp Attacks (X) | Individual model in base contact; automatic hits after all Initiative steps | https://tow.whfb.app/special-rules/stomp-attacks |
| Armour Bane (X) | Natural 6 To Wound on eligible model's weapon; not a flat AP modifier | https://tow.whfb.app/special-rules/armour-bane |

The matched rule must be in a source-extracted unit record's
**startingRules** with exact tow.whfb.app link, and the record's source URL
must match the imported unit's official URL. A rule present only in
**optionalRules** never appears as selected or active. No inherited special
rule is assumed from the regiment to a joined character or vice versa.

A compact unit card continues to show actual reviewed item effects and
recorded character effects only, not these general manual reminders.
They are in the **Effects** tab, clearly labelled **Reviewed · manual**
with a phase and source. Existing save/attack subsystems are not overwritten.
Users must still establish eligible models, dice, formations and timing.

The audit now keeps three disjoint counts:
1. Reviewed character-granted/inherited effect occurrences
2. Reviewed manual-only starting-rule occurrences
3. Starting-rule occurrences remaining reference-only

None of these is a percentage of automatically implemented combat mechanics,
because other subsystems implement independent mechanics and a single source
reference may cover more than one combat step.

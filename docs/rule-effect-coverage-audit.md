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

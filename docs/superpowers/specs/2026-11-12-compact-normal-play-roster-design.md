# Compact Normal Play roster — design (2026-11-12)

## Intent
Make the imported army the Normal Play landing view on phones, with expandable character and army-section groups and instant unit-name search. All display is read-only except existing explicit player operations. Guided Play is deferred until rule logic is verified and tested.

## Constraints
- Preserve all 15 export layouts, original unit order, duplicate entries, imported names, personal aliases, points, source provenance, character assignments, known spells and active effects. Never infer a rule, legality, modifier, attack or battle outcome.
- Use the existing static browser JavaScript modules, CSS and offline service-worker cache. Work on narrow iPhone portrait and landscape with >=44px touch targets and no page-level horizontal overflow.
- Open the Units workspace for new army sessions (existing saved tab preference wins); Overview and Magic remain available.
- Show Characters and core (or the first available non-character army section) expanded initially, while later sections start folded. Preserve fold preferences per exact imported army; search must not overwrite those preferences. Missing/unknown sections remain visible and correctly labeled.
- Search matches displayed custom names, official/imported labels and entry numbers; it must filter all sections, reveal matches even inside folded sections and restore prior folds when cleared. Provide count/no-results feedback; search text remains during a same-army rerender, not across army changes.
- Keep attached characters visible within their assigned regiment when its unit detail is opened, without duplicating underlying records.

## Approach
Enhance the existing roster renderer with a small separate view-only navigation module that wraps the current character and section nodes. Leave parser and battle state unmodified; implement accessible button-based section folding and a labelled search field. Prefer this to rebuilding card state or adding a second renderer.

## Non-goals
No guided mode, automatic rules engine, new combat calculations, revised item effects, changed army legality, import modification or deployment directly to main.

## Acceptance
New imports open Units. Sections fold/reopen and remain stable across same-army rerenders, reload/offline return and different imports. Search finds units by their name or custom alias within folded sections; duplicates remain distinct. All pre-existing unit panels and assignment controls still work. Existing and new browser tests pass, and cache includes new module.
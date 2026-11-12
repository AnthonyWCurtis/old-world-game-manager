# Hold-and-drag roster implementation plan

> Follow test-driven development: write an isolated failing browser test before implementing behaviour.

- [ ] Add Playwright mobile test for long-press reorder, persistent preferences, reset, touch/click interaction, duplicate instance safety and keyboard action.
- [ ] Implement view-only `roster-drag-reorder.js` providing `attachRosterReorder(container, army, groups, search, refresh)`. Use real DOM card moves and reorder `group.cards` in-place.
- [ ] Integrate decorator prior to focused unit handlers and apply saved order before search refresh. Focus and historical fold states must be preserved.
- [ ] Add concise CSS for grip affordance, active dragging and search-disabled state; provide keyboard fallback.
- [ ] Update offline service worker and cache-version checks. Add new test to GitHub Action.
- [ ] Run all importer and mobile/units browser tests, review the diff; open unmerged PR.

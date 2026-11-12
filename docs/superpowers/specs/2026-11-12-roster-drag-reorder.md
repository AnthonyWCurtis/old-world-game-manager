# Normal Play: personal roster display order by hold-and-drag

**Date:** 2026-11-12 · **Target:** iPhone Safari and keyboard/mouse desktop
**Goal:** Reorder unit cards visually during tabletop play, without modifying the original exported list or game calculations.

## Behaviour and alternatives
1. HTML5 draggable attribute: simple for desktop, unreliable on iPhone Safari with page scrolling. Rejected.
2. Permanent editing mode with up/down controls: accessible, but too many extra buttons on the compact roster. Retain keyboard equivalents, no primary editing mode.
3. **Chosen:** long-press the unit card header for 400ms to engage movement; drag vertically between cards in the same imported section. The page scrolls normally if moving without first holding. A short tap still opens the unit; cancel and mouse move do not open it. Provide Reset order beside search, accessible keyboard Alt+ArrowUp/Down and lightweight visual guidance.

**Section boundaries**: Characters, Core and Special retain their imported membership; moving a Character into Core could misrepresent army classification. Order can change within a section only. All card instances remain separate (especially duplicate units and custom nicknames).

## Data integrity
- Store only a per-army view preference keyed by `armySessionKey(army)` and each unit **instance ID**.
- Source-order index badges, imported points, source references, assignment/spell state, selected items and army legality are not modified.
- On rerender/reimport of the same original text, restore the order; ignore malformed/unknown/stale IDs and append new IDs in original relative order.
- When browser storage is unavailable, keep preference in memory and continue to work.
- Search temporarily disables dragging; clear the filter first. Fold state and focused unit navigation remain independent.
- Reset reverts to original imported order for the active army.
- Pointer/mouse and touch gestures must not trigger the standard tap-to-open click when a drag was performed.

## Validation
- A Playwright test long-presses and drags an existing card on 390px mobile, verifies DOM order changes but source indices and points stay identical, validates filtering and focus navigation, resets, reorders again, reloads offline and recovers the preference.
- Keyboard Alt+ArrowDown moves a card, and an ordinary tap continues to open it.
- All pre-existing mobile/importer/source tests pass. No horizontal overflow or unnecessary floating overlays.

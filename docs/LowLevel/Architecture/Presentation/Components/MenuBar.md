# MenuBar

Source: [`src/components/MenuBar.vue`](../../../../../src/components/MenuBar.vue)

## Purpose
Render the game page's navigation actions inside `NavigationFrame` and own quick game and close game.

## Interface
- Props: `gameId: string`, the target workspace.
- Emits: `homeRequested()`, `customNewGameRequested()`, `loadGameRequested()`, `saveGameRequested()`, `settingsRequested()`.
- Slots: none; it fills `NavigationFrame`'s `brand`, default and `footer` slots.

## Dependencies
- Stores: `GamesStore.getGame` to decide whether the target game exists.
- Composables: `useQuickGame`, `useGameTabActions`.
- Children: `NavigationFrame`, `AppIcon`.
- Styles: `navigation.css` (`.app-brand`, `.navigation-group`, `.menu-button`).

## Notes
- The brand button emits `homeRequested`. Game actions are *Quick game*, *Custom*, *Load*, *Save* (disabled when the target game does not exist) and *Close game* (shown only when it exists); *Settings* sits in a secondary group.
- *Quick game* runs `useQuickGame().start` locally, shared with Home. It uses accepted defaults, prevents duplicate submission and cancels UI follow-up on route or lifecycle replacement. It adds no Menu pause.
- *Close game* calls `useGameTabActions.close(gameId)`, shared with `GameTabs`, including target-only premove clearing.
- Quick-game and close failures appear in the frame footer; a quick-game error offers *Edit game defaults* (`/settings/gameplay`).
- The five emitted events enter `GameView`'s Menu-interruption workflow, which cancels playback, applies the configured Menu pause and owns its completion. Custom creation also captures the interrupted game in its exactly-once close callback. A local `router.push` would skip that pause and cancellation boundary ([component simplification plan, retained events](../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-events-concrete-justifications)).
- The old invariant capability flags and the unused Delete action were removed.
- `NavigationFrame` owns the desktop expansion and the mobile drawer; its slots render the same action closures in both surfaces.

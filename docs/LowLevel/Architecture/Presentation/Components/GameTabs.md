# GameTabs

Source: [`src/components/GameTabs.vue`](../../../../../src/components/GameTabs.vue)

## Purpose
Render the open-game tab strip and own tab selection and closing.

## Interface
- Props: none. Emits: none. Slots: none.

## Dependencies
- Stores: `GamesStore.listGames` for names and order, `UiStateStore.gameSession.openGameIds` for membership.
- Route: the committed `route.params.id` marks the active tab.
- Composables: `useGameTabActions`.
- Children: `AppIcon`.
- Styles: `shared.css` (`.tab-strip`, `.tab-button`).

## Notes
- Tabs list workspace games filtered by open-tab membership, in `GamesStore` order. The strip hides when at most one game is open.
- Selecting a tab calls `useGameTabActions.select(id)`, which requests `/game/:id` without publishing a selection first. The App route checkpoint updates the session after the navigation succeeds; a rejected navigation leaves the selection unchanged.
- Each tab's close control (pointer or Enter) calls `useGameTabActions.close(id)`, shared with `MenuBar` and `GameResultModal`. It clears only the target game's premoves, closes that tab and navigates to the session's active game or Home. Active, background and paused tabs use the same order. Temporary switching keeps every queue. Closing a tab does not delete a saved game, remove the workspace game or dispose its actual turn.
- Action errors appear inline below the strip and are not published after disposal.
- Selection and close moved from `GameView` into this component in the [component simplification](../../../../ArchivedPlans/ComponentSimplificationPlan.md#3-let-tabs-and-the-game-menu-own-independent-actions); the earlier `TabbedView` and `TabButton` primitives were never implemented.

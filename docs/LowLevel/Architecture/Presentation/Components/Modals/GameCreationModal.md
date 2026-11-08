# GameCreationModal

Source: [`src/components/modals/GameCreationModal.vue`](../../../../../../src/components/modals/GameCreationModal.vue)

## Purpose
Own the custom game and start-from-setup form, its validation and its submission in one mounted component.

## Interface
- Props: `gameId?: string`; `signal: AbortSignal`. Omitting `gameId` creates a new workspace; supplying it starts the prepared game.
- Emits: `dismissed()`, bound by the provider to this opening. Slots: none.

## Dependencies
- Stores: `SettingsStore` (accepted `gameDefaults`), `EnginesStore.listConfiguredEngines` (accepted profiles), `GamesStore` (`getGame`, `createGame`, `startGameFromSetup`), `UiStateStore.openTab`.
- Domain: `EngineRuntimeService.getOptions` for required-engine readiness.
- Composables: `useModalAction`; router for navigation.
- Utility: `copyGameRequest`, `createLocalPlayer`, `getGameCreationError`.
- Children: `ModalDialog` (`wide`), `GamePlayerField`, `GameClockFields`, `AnalysisSnapshotFields`.
- Styles: `dialogs.css` (`.segmented-control`), `shared.css` form, field, toggle and button classes.

## Form
- **Game:** an `autofocus` name field and, for new workspaces only, a *Play a game* / *Free analysis* switch. Both seats unassigned in the defaults open in Free analysis.
- **Players** (live only): *Randomly assign colours*, then White and Black `GamePlayerField`s, labelled Player 1 and Player 2 when random colours are on. Random colours is disabled unless both seats are assigned.
- **Time & assistance:** `GameClockFields`, *Allow takebacks*, *Show live analysis moves* (live only, disabled unless both seats are assigned) and `AnalysisSnapshotFields`.
- The validation message from `getGameCreationError` on the effective request appears inline and disables submission. The submit button reads *Create workspace* or *Start game*.

## Initial values
- A new workspace copies the accepted `gameDefaults`: name, optional player and analysis snapshots, clock and assistance flags. Saved configurations stay available through Keep after profile edits or deletion; choosing a profile explicitly replaces a snapshot. Unsaved settings drafts never seed creation ([quick game defaults design](../../../../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows)).
- Start from setup keeps the prepared game's name, takeback and live-analysis options and analysis assignments, uses Local for both seats, seeds the clock from accepted defaults, and hides the workspace switch and Unassigned choices.
- Every opening mounts a fresh form.

## Submission
`_submit` builds the effective request (Free analysis omits both players; a request with an unassigned seat sets `showLiveAnalysisMoves` to `true`) and runs it through `useModalAction`:

1. `_validateRequiredEngines` checks each engine player of a live request with `EngineRuntimeService.getOptions`; an unavailable engine reports its name and blocks creation.
2. Setup calls `GamesStore.startGameFromSetup(prepared, request)` on the game captured before awaiting; creation calls `GamesStore.createGame(request)`, then, if the opening is still live, `UiStateStore.openTab` and navigation to `/game/:id`.
3. Success dismisses the opening. Failures stay inline for retry.

`randomiseColours` is passed through to the store, which draws colours at creation; form rendering, edits and readiness checks never draw colours. Cancel and shell dismissal are disabled while working. Closing or replacement suppresses late navigation and errors without rolling back a started domain mutation.

## Notes
- The modal does not decide whether the result is a live game or a free-analysis workspace; `GamesStore` does, from the players supplied.
- Openers: `HomeView` and `GameView` (custom game, the latter with a Menu-interruption `onClosed`), and `GameControlPanel` (Start game with `gameId`).
- The former `NewGameModal` form and its create/cancel relay were merged here so one component owns draft edits, validation, readiness, feedback and submission ([component simplification plan](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#1-remove-duplicated-modal-inputs-and-the-form-relay)).

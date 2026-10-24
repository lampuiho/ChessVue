# GameCreationModal

## Purpose
Own the custom creation/setup form, validation and submission in one mounted component. Props are `gameId?` and the provider's `signal`; its only event is `dismissed`.

## Consumes
- draft defaults from `SettingsStore`
- engine inventory choices from `EnginesStore`
- `ModalDialog` and shared button classes for dialog and action presentation
- local named form sections with global field and button classes

## Emits
- `dismissed`, bound by the provider to this particular mounted opening

## Notes
- Inline validation covers time control, player selection, analysis-engine selection, and the per-game live-analysis move preference for live games.
- The modal does not decide whether the result is a live game or free-analysis workspace; `GamesStore` does.
- New-game form fields should be grouped into named sections instead of one long modal template.
- When the request creates a live game, the form also captures whether that game's live current-position analysis rows may render engine move targets. The default live-game choice is score-only.
- The modal uses the shared dialog shell and keeps create and cancel actions in the shared dialog action row.
- The same validated form serves new-game creation and start-from-setup. Setup hides workspace/none choices and exposes clocks, takeback, analysis engines and live-move preferences while `GamesStore.startGameFromSetup` preserves the prepared board.
- Missing engine defaults remain explicit required selections. Independent none choices create free analysis without discarding the other selected seat. Invalid or empty custom time values block submission with an inline message.
- `_submit` builds the request, validates required player-engine launch readiness, and calls `GamesStore.createGame` or `startGameFromSetup` directly. No child form or create/cancel relay remains.
- `useModalAction(signal)` prevents duplicate submission and owns busy/error/retry feedback. Successful creation checks the opening's signal before opening its tab and navigating. Closing or replacement suppresses late UI delivery without rolling back a started domain mutation.
- Every opening mounts a fresh local form. Setup captures the prepared game before awaiting engine validation. Cancel and shell dismissal remain disabled while the form is working.

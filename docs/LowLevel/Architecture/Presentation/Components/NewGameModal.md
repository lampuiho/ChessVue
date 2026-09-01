# NewGameModal

## Purpose
Collect quick or custom new-game input before forwarding a validated create request.

## Consumes
- defaults from `SettingsStore`
- engine inventory choices from `EnginesStore`
- `ModalDialog` and `DialogButton` for shared dialog and action presentation
- `FormSection` and `FieldRow` for shallow form structure

## Emits
- `createRequested`
- `cancelRequested`

## Notes
- Inline validation covers time control, player selection, analysis-engine selection, and the per-game live-analysis move preference for live games.
- The modal does not decide whether the result is a live game or free-analysis workspace; `GamesStore` does.
- New-game form fields should be grouped into named sections instead of one long modal template.
- When the request creates a live game, the form also captures whether that game's live current-position analysis rows may render engine move targets. The default live-game choice is score-only.
- The modal uses the shared dialog shell and keeps create and cancel actions in the shared dialog action row.
- `NewGameModal` contains no HTML or template markup and binds modal state into common dialog and form controls.

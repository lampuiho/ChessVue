# NewGameModal

## Purpose
Collect quick or custom new-game input before forwarding a validated create request.

## Consumes
- defaults from `SettingsStore`
- engine inventory choices from `SettingsStore`
- `ModalDialog` and `DialogButton` for shared dialog and action presentation
- `FormSection` and `FieldRow` for shallow form structure

## Emits
- `createRequested`
- `cancelRequested`

## Notes
- Inline validation covers time control, player selection, and analysis-engine selection.
- The modal does not decide whether the result is a live game or free-analysis workspace; `GamesStore` does.
- New-game form fields should be grouped into named sections instead of one long modal template.
- The modal uses the shared dialog shell and keeps create and cancel actions in the shared dialog action row.
- `NewGameModal` contains no HTML or template markup and binds modal state into common dialog and form controls.

# NewGameModal

## Purpose
Collect quick or custom new-game input before forwarding a validated create request.

## Consumes
- defaults from `SettingsStore`
- engine inventory choices from `SettingsStore`
- `ModalDialog` and `DialogButton` for shared dialog and action presentation

## Emits
- `createRequested`
- `cancelRequested`

## Notes
- Inline validation covers time control, player selection, and analysis-engine selection.
- The modal does not decide whether the result is a live game or free-analysis workspace; `GamesStore` does.

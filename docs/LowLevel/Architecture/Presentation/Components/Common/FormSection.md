# FormSection

## Purpose
Provide a reusable form subsection wrapper with title, help text, and grouped fields.

## Consumes
- title
- description or help text
- field content slot
- optional validation summary

## Emits
- none directly

## Notes
- `NewGameModal` and `SettingsView` use `FormSection` to avoid long anonymous field stacks.

# SettingsSection

## Purpose
Render one named block of settings controls with local heading, description, and action area.

## Consumes
- section title
- optional section description
- form-field content
- optional section actions

## Emits
- none directly

## Notes
- `SettingsView` uses `SettingsSection` to separate session, gameplay, appearance, layout, and engine settings.
- The section wrapper keeps settings markup readable without owning field behaviour.

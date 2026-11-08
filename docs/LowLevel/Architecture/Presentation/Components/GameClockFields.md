# GameClockFields

Source: [`src/components/GameClockFields.vue`](../../../../../src/components/GameClockFields.vue)

## Purpose
Edit the time control of a game-creation request or of the saved game defaults.

## Interface
- Props: `id: string` (the select's ID); `label: string`.
- Model: required `v-model` of `ITimeControl`.
- Emits: `update:modelValue` through the model. Slots: none.

## Dependencies
- Utility: `gameClockChoices`, `selectGameClock` from `GameCreationUtility`.
- Callers: `GameCreationModal` and `SettingsView` Gameplay.
- Styles: `shared.css` (`.field-row`, `.time-fields`, `.field-control`, `.field-help`).

## Notes
- The select offers the canonical presets (Untimed, Bullet 1+0, Blitz 5+0, Rapid 10+0, Classical 30+0) and Custom. A clock without a preset shows as Custom.
- Choosing a preset replaces the model with that preset's canonical values through `selectGameClock`; choosing Custom keeps the current duration (default ten minutes) and increment without a preset.
- Custom shows *Minutes* (1–600) and *Increment (seconds)* (0–300) inputs, which write into the bound clock object. Named timed presets show their duration and increment as text; Untimed shows neither.
- The field does not validate; callers check the request with `getGameCreationError`, which rejects out-of-range values and presets whose values were edited.

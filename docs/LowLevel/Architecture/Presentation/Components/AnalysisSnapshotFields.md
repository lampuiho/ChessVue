# AnalysisSnapshotFields

Source: [`src/components/AnalysisSnapshotFields.vue`](../../../../../src/components/AnalysisSnapshotFields.vue)

## Purpose
Edit the up-to-four analysis engine snapshots of a game-creation request or of the saved game defaults.

## Interface
- Props: `engines: readonly DeepReadonly<IEngineRecord>[]`, the profiles available as copy sources.
- Model: required `v-model` of `IEngineRecord[]`.
- Emits: `update:modelValue` through the model. Slots: none.

## Dependencies
- Utility: `copyEngineProfile` from `GameCreationUtility`.
- Callers: `GameCreationModal` (accepted engine profiles) and `SettingsView` Gameplay (draft engine profiles).
- Styles: `shared.css` (`.analysis-snapshots`, `.field-label`, `.field-control`, `.text-button`).

## Notes
- Each saved row shows its entry path and a select whose default choice is *Keep `<name>` (saved configuration)*; choosing *Use profile: `<name>`* replaces that row with a copy of the profile. *Remove* deletes the row.
- *Add analysis engine* copies the chosen profile into a new row. It is disabled at four rows.
- A profile whose display name is already used by another row is disabled, because analysis engine names must be unique within a game.
- Every change replaces the model array; rows are copies, so later profile edits do not change saved snapshots.
- With no profiles, the field explains how to add one in Settings > Engines.

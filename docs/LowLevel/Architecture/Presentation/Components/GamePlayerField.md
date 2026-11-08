# GamePlayerField

Source: [`src/components/GamePlayerField.vue`](../../../../../src/components/GamePlayerField.vue)

## Purpose
Edit one seat of a game-creation request or of the saved game defaults.

## Interface
- Props: `id: string`; `label: string`; `colour: PlayerColour`; `engines: readonly DeepReadonly<IEngineRecord>[]`; `required?: boolean`.
- Model: `v-model` of `IPlayer | undefined` (`undefined` means unassigned).
- Emits: `update:modelValue` through the model. Slots: none.

## Dependencies
- Utility: `createLocalPlayer`, `createEnginePlayer` from `GameCreationUtility`.
- Callers: `GameCreationModal` (accepted engine profiles) and `SettingsView` Gameplay (draft engine profiles).
- Styles: `shared.css` (`.field-row`, `.field-label`, `.field-help`, `.field-control`).

## Notes
- Choices, in order: *Unassigned (free analysis)* unless `required`; *Local player*; *Keep `<name>` (saved configuration)* when the seat already holds an engine; then *Use profile: `<name>`* for each supplied profile. The saved engine's entry path appears as help text.
- Choosing a profile copies it into a new engine player for the seat's colour. Keep leaves the existing snapshot untouched, so later profile edits or deletion do not change a saved seat. Labelling replacements *Use profile:* keeps an explicit replacement distinguishable from keeping a saved configuration with the same name ([quick game defaults design](../../../../ArchivedPlans/QuickGameDefaultsDesign.md#settings-ui)).
- The caller supplies the label, which becomes *Player 1* or *Player 2* when random colours are selected; the seat still writes its canonical colour.
- The field does not validate or start engines; callers validate the whole request with `getGameCreationError`.

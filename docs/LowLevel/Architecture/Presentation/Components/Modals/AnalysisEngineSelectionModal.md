# AnalysisEngineSelectionModal

Source: [`src/components/modals/AnalysisEngineSelectionModal.vue`](../../../../../../src/components/modals/AnalysisEngineSelectionModal.vue)

## Purpose
Add one configured engine to a game's analysis seats.

## Interface
- Props: `gameId: string`; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Stores: `GamesStore` (`getGame`, `addAnalysisEngine`, `retryAnalysis`), `EnginesStore.listConfiguredEngines` (accepted profiles), `SettingsStore` (reactivity of the inventory).
- Composables: `useModalAction`.
- Children: `ModalDialog`.
- Styles: `dialogs.css` (`.choice-list`, `.choice-card`).

## Notes
- The choice list excludes profiles whose display name is already assigned to the game. Exclusion reads the canonical `analysis.seats` reactively, so empty, restored, failed and stopped seats count as assigned and the list updates while the dialog is open.
- With no configured profiles the dialog explains that one must be added in Settings first.
- *Add engine* calls `GamesStore.addAnalysisEngine(game, engine)`, captures the new seat object, awaits the add and then, outside board edit, retries that seat by its current index so analysis starts. Success dismisses; failures stay inline.
- Opened by `AnalysisPanel`, which enables Add only below four seats.
- The `currentAnalysisEngines` prop was removed; the modal resolves assignments from `gameId` ([component simplification plan](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#1-remove-duplicated-modal-inputs-and-the-form-relay)).

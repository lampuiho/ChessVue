# Contract-Aware Utility Index

## Purpose
Define shared private utilities that touch committed contract models.

These utilities behave like imported library code:

- they are private implementation only
- they are not public architecture modules
- they do not own scenarios
- they do not appear directly in process-flow docs
- they are visible only through the owner-private functions that delegate to them

If a helper does not touch committed contract models, it does not need to be designed here.

## Entry Format
Each entry must define:

- utility name
- purpose
- touched contract models
- allowed importers
- owner-private delegates
- purity or side-effect classification
- validation or failure semantics

## Session And Routing
### SessionNavigationUtility
- Purpose: share baseline route coercion, open-tab filtering, and fallback selection for persisted session state and routed navigation.
- Touched contract models: `IGameSessionSnapshot`, committed route map, `activeGameId`, `openGameIds`.
- Allowed importers: `UiStateStore`, `Router`.
- Owner-private delegates:
  - `UiStateStore._coerceOpenTabs`
  - `UiStateStore._coerceActiveRoute`
  - `Router._resolveStartupTarget`
  - `Router._restoreReturnRoute`
  - `Router._validateGameRoute`
  - `Router._selectFallbackRoute`
- Classification: `pure`.
- Validation or failure semantics: invalid or stale route targets are coerced to the nearest committed fallback without mutating persisted settings or workspace payloads.

## Persistence And Saved Documents
### SavedGameDocumentUtility
- Purpose: share canonical managed-save enumeration, saved-document access, and duplicate-identity repair around saved-game workflows.
- Touched contract models: `IGameWorkspace`, canonical saved-game document text.
- Allowed importers: `SavedGameDocumentService`, `GamesStore`, `RecentGameStore`.
- Owner-private delegates:
  - `SavedGameDocumentService._enumerateManagedSaveEntries`
  - `SavedGameDocumentService._writeSavedGameDocument`
  - `SavedGameDocumentService._readSavedGameDocument`
  - `GamesStore._remapDuplicateIdIfNeeded`
  - `RecentGameStore._enumerateRecentSaveTargets`
- Classification: `mixed`.
- Validation or failure semantics: raw document errors and invalid payloads are surfaced back through the owning store; duplicate identity repair must preserve the canonical payload shape before insertion into live state.

### WorkspaceRestoreUtility
- Purpose: share reconstruction of live workspace state from canonical persisted game payloads.
- Touched contract models: `IGameWorkspace`, `IAnalysisAssignment`, captured assigned-engine snapshots, `IClockSnapshot`.
- Allowed importers: `GamesStore`.
- Owner-private delegates:
  - `GamesStore._hydrateWorkspace`
  - `GamesStore._hydrateWorkspaceCollection`
  - `GamesStore._repairMissingActiveGame`
- Classification: `pure`.
- Validation or failure semantics: invalid or incomplete workspace payloads are rejected by the owning restore flow before they become active live state.

## Appearance
### AppearanceProjectionUtility
- Purpose: share resolved-theme mapping and appearance projection building from committed settings.
- Touched contract models: `ISettingsSnapshot`, `IAppearanceProjection`, `ResolvedThemeMode`.
- Allowed importers: `SettingsStore`.
- Owner-private delegates:
  - `SettingsStore._resolveThemeMode`
  - `SettingsStore._buildAppearanceProjection`
- Classification: `pure`.
- Validation or failure semantics: projection is derived only from validated settings snapshots and the current resolved system-theme input supplied through the owner boundary.

## Engine Position Mapping
### EnginePositionMappingUtility
- Purpose: share contract-aware projection between ChessVue workspace state and engine-facing position state used for continuous analysis and player-engine turns.
- Touched contract models: `IEnginePositionState`, `IGameWorkspace`, `IBoardPosition`, move-tree node identity.
- Allowed importers: `EnginesStore`, `EngineRuntimeService`, `EngineClient`.
- Owner-private delegates:
  - `EnginesStore._startAnalysisSessions`
  - `EnginesStore._startPlayerTurnSearch`
  - `EngineRuntimeService._syncEnginePosition`
  - `EngineClient._mapBoardPositionToProtocolPosition`
  - `EngineClient._shouldReuseCurrentGameLine`
- Classification: `pure`.
- Validation or failure semantics: produced engine-position state must preserve canonical move ordering and branch identity so runtime restart and position reuse decisions stay deterministic.

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
### PersistenceDocumentUtility
- Purpose: share canonical managed-save enumeration, saved-document access, and duplicate-identity repair around saved-game workflows.
- Touched contract models: `IGame`, canonical saved-game document text.
- Allowed importers: `SerializationService`, `GamesStore`, `RecentGameStore`.
- Owner-private delegates:
  - `SerializationService._listManagedSaveEntries`
  - `SerializationService._writeGameDocument`
  - `SerializationService._readGameDocument`
  - `GamesStore._remapDuplicateIdIfNeeded`
  - `RecentGameStore._enumerateRecentSaveTargets`
- Classification: `mixed`.
- Validation or failure semantics: raw document errors and invalid payloads are surfaced back through the owning store; duplicate identity repair must preserve the canonical payload shape before insertion into live state.

### WorkspaceRestoreUtility
- Purpose: share reconstruction of live workspace state from canonical persisted game payloads.
- Touched contract models: `IGame`, `MovePath`, nested `IMoveTree`, `IGameAnalysis`, copied in-game engine payloads, `IClockSnapshot`.
- Allowed importers: `GamesStore`.
- Owner-private delegates:
  - `GamesStore._hydrateWorkspace`
  - `GamesStore._hydrateWorkspaceCollection`
  - `GamesStore._repairMissingActiveGame`
- Classification: `pure`.
- Validation or failure semantics: invalid or incomplete workspace payloads are rejected by the owning restore flow before they become active live state. Successful hydration rebuilds runtime-only move-tree helpers such as parent references, resolves persisted `livePath` / `highlightPath` selectors, and exposes the resulting hydrated node references back to `GamesStore` before any node-based runtime navigation or mutation flow runs.

## Error Handling
### StandardErrorHandlingUtility
- Purpose: share normalisation of runtime and platform exceptions into logging plus caller-owned user-facing error presentation policy.
- Touched contract models: `IPlatformError` and the shared runtime-error presentation payload owned by the handling path.
- Allowed importers: `EngineRuntimeService`, `EnginesStore`, `GamesStore`, `SerializationService`, `UiStateStore`, `UserSettingService`.
- Owner-private delegates:
  - `EngineRuntimeService._handleRuntimeError`
  - `EnginesStore._handlePlayerTurnRuntimeError`
  - `GamesStore._handleRuntimeError`
  - `SerializationService._handlePlatformError`
  - `UiStateStore._handlePersistenceError`
  - `UserSettingService._handlePlatformError`
- Classification: `mixed`.
- Validation or failure semantics: every handled error is logged. The owning caller decides whether the error remains local state such as an analysis-engine unavailable row or is escalated into a user-facing runtime dialog. Blocking runtime dialogs may be rendered through `RuntimeErrorDialogMountUtility`, a private presentation-only helper that mounts a dedicated Vue app inside the shared dialog shell without adding a new public modal contract.

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
- Touched contract models: `IEnginePositionState`, `IGame`, `IBoardPosition`, move ordering and branch lineage from the current hydrated tree.
- Allowed importers: `GamesStore`, `EngineRuntimeService`, `EngineClient`.
- Owner-private delegates:
  - `GamesStore._startAnalysisSessions`
  - `GamesStore._requestRuntimePlayerMove`
  - `EngineRuntimeService._syncEnginePosition`
  - `EngineClient.syncPosition`
  - `EngineClient.requiresNewGameBoundary`
- Classification: `pure`.
- Validation or failure semantics: produced engine-position state must preserve canonical move ordering and branch identity so runtime restart and position reuse decisions stay deterministic.

## Chess Structure Support
### ChessBoardUtility
- Purpose: share public board-structure helpers used by domain services and tests without exposing a `domain/internal` module surface.
- Touched contract models: `IBoardPosition`, `ICastlingAvailability`, `IChessPiece`, `BoardId`, `PlayerColour`.
- Allowed importers: `GameRuleService`, `MoveNotationService`, `SerializationService`, domain tests, platform tests.
- Owner-private delegates:
  - `GameRuleService._cloneBoardPosition`
  - `GameRuleService._findKingBoardId`
  - `GameRuleService._getOpponentColour`
  - `SerializationService._normaliseBoardPosition`
- Classification: `pure`.
- Validation or failure semantics: helpers preserve structural board shape only. They do not invent missing pieces, infer legality, or mutate caller-owned board arrays in place.

### ChessSquareUtility
- Purpose: share board-index, coordinate, notation, and pawn-direction helpers used by chess-rule and notation code without exposing a `domain/internal` module surface.
- Touched contract models: `BoardId`, `PlayerColour`.
- Allowed importers: `GameRuleService`, `MoveNotationService`, domain tests, platform tests.
- Owner-private delegates:
  - `GameRuleService._boardIdToCoords`
  - `GameRuleService._coordsToBoardId`
  - `GameRuleService._getForwardDirection`
  - `MoveNotationService._boardIdToNotation`
- Classification: `pure`.
- Validation or failure semantics: helpers perform only structural coordinate conversion and deterministic notation mapping. Out-of-range coordinates return `undefined` rather than coercing to a board id.

## Platform Host Support
### NwjsUtility
- Purpose: share typed access to the shared `nw` host object used by the concrete NW.js platform implementation.
- Touched contract models: none directly; supports typed implementation of platform-owned contracts without extending the public abstraction surface.
- Allowed importers: `PlatformService`, `NwjsPlatformService`, `NwjsStorageAdapter`, `NwjsProcessManager`, `NwjsSystemThemeAdapter`, `NwjsUciEngineClient`.
- Owner-private delegates:
  - `PlatformService._resolveNw`
- Classification: `mixed`.
- Validation or failure semantics: the utility must return one shared typed `nw` object for the active build target, allow explicit test or bootstrap override, and fall back to the temporary mock host only when the real NW.js bindings are unavailable. `PlatformService` resolves that shared instance once, and the concrete NW.js store definitions receive it through injected parameters rather than resolving host globals independently.

### NodeUtility
- Purpose: share access to Node modules exposed through the NW.js host and the temporary mock-module fallback required before the real desktop bootstrap is present.
- Touched contract models: none directly; supports platform-owned file-system and process implementations without adding Node-module concerns to the public platform contract.
- Allowed importers: `NwjsStorageAdapter`, `NwjsProcessManager`, `NwjsUciEngineClient`.
- Owner-private delegates:
  - `NwjsStorageAdapter._resolveFs`
  - `NwjsStorageAdapter._resolvePath`
  - `NwjsProcessManager._resolveChildProcess`
  - `NwjsUciEngineClient._resolveChildProcess`
- Classification: `mixed`.
- Validation or failure semantics: the utility must resolve each required Node-backed dependency separately from the active NW.js host when available, and fall back to temporary mock implementations only when the real NW.js-exposed Node environment is unavailable.

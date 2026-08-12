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
- Managed-save enumeration and latest-save target selection remain owner-private helpers inside `SavedGamesStore` and `RecentGameStore`, while duplicate-id repair and workspace hydration remain owner-private helpers inside `GamesStore`.
- Direct `SerializationService.readGameDocument(...)` and `SerializationService.writeGameDocument(...)` calls do not need a contract-aware utility wrapper when the wrapper adds no shared behaviour beyond pass-through.

## Error Handling
### StandardErrorHandlingUtility
- Purpose: share normalisation of runtime and platform exceptions into logging plus caller-owned user-facing error presentation policy.
- Location: `src/utility/errors/StandardErrorHandlingUtility.ts`.
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

## Store-Private Contract Helpers
- Theme projection, session-route coercion, engine-position mapping, and workspace hydration remain owner-private helpers inside their stores or services unless they become genuinely shared across multiple owners with meaningful behaviour beyond local composition.

## Chess Structure Support
### ChessBoardUtility
- Purpose: share public board-structure helpers used by domain services and tests without exposing a `domain/internal` module surface.
- Touched contract models: `IBoardPosition`, `ICastlingAvailability`, `IChessPiece`, `BoardId`, `PlayerColour`.
- Allowed importers: `GameRuleService`, `MoveNotationService`, domain tests, platform tests.
- Owner-private delegates:
  - `GameRuleService._findKingBoardId`
  - `GameRuleService._getOpponentColour`
- Classification: `pure`.
- Validation or failure semantics: helpers preserve shared structural board concerns only. They do not invent missing pieces, infer legality, or clone caller-owned board arrays unless the owning service explicitly needs that behaviour.

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
### UciUtility
- Purpose: generate UCI protocol commands and parse UCI protocol output into shared engine, analysis, board, and move contracts.
- Location: `src/utility/UciUtility.ts`.
- Command-builder surface: `buildAnalysisCommands`, `buildDebugCommand`, `buildFindNextMoveCommands`, `buildIsReadyCommand`, `buildPonderMoveCommands`, `buildPositionCommand`, `buildQuitCommand`, `buildRegisterCommand`, `buildSetOptionCommand`, `buildStopCommand`, `buildUciCommand`, `buildUciMove`, and `buildUciNewGameCommand`.
- Touched contract models: `IEngineOptionMeta`, `IAnalysisLine`, `IBoardPosition`, `IGame`, and `IMove`.
- Allowed importers: concrete UCI engine clients and utility tests.
- Owner-private delegates: `NwjsUciEngineClient` handshake, game-boundary, state-transition, analysis-line, and best-move handlers.
- Classification: `mixed`; command construction and parsing are deterministic, while `buildUciMove(...)` may populate the runtime-only `IMove.$.uci` cache.
- Validation or failure semantics: invalid highlighted or live paths, untimed player searches, malformed UCI moves or option declarations, and unsupported option types throw rather than creating partial protocol data. Standard initial roots emit `position startpos`; one-time verification is cached under `IBoardPosition.$.isStandardInitialPosition`, while custom roots emit full FEN. A missed ponder returns only `stop` because the client must await and discard that search's final `bestmove` before starting another search.

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

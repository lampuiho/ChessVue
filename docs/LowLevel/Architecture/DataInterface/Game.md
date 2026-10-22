# Game Workspace Types

## Purpose
Define the canonical game model used by `GamesStore`, related services, and persisted saved-game payloads.

## Types
- `enum GameState`
- `enum ResultState`
- `enum ResultReason`
- `enum PlayerType`
- `enum PlayerActivityState`
- `enum DrawOfferDirection`

## Interfaces
- `interface IDrawOfferState`
- `interface IPlayerRuntime`
- `interface IPlayer`
- `interface IEnginePlayer`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface IGameplayOptions`
- `interface IGameRuntime`
- `interface IGame`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`

## Data Structures
```ts
enum GameState {
  LiveWhiteTurn = "liveWhiteTurn",
  LiveBlackTurn = "liveBlackTurn",
  PausedWhiteTurn = "pausedWhiteTurn",
  PausedBlackTurn = "pausedBlackTurn",
  LiveAnalysisFromWhiteTurnWhiteMove = "liveAnalysisFromWhiteTurnWhiteMove",
  LiveAnalysisFromWhiteTurnBlackMove = "liveAnalysisFromWhiteTurnBlackMove",
  LiveAnalysisFromBlackTurnWhiteMove = "liveAnalysisFromBlackTurnWhiteMove",
  LiveAnalysisFromBlackTurnBlackMove = "liveAnalysisFromBlackTurnBlackMove",
  PausedLiveAnalysisFromWhiteTurnWhiteMove = "pausedLiveAnalysisFromWhiteTurnWhiteMove",
  PausedLiveAnalysisFromWhiteTurnBlackMove = "pausedLiveAnalysisFromWhiteTurnBlackMove",
  PausedLiveAnalysisFromBlackTurnWhiteMove = "pausedLiveAnalysisFromBlackTurnWhiteMove",
  PausedLiveAnalysisFromBlackTurnBlackMove = "pausedLiveAnalysisFromBlackTurnBlackMove",
  AnalysisWhiteMove = "analysisWhiteMove",
  AnalysisBlackMove = "analysisBlackMove",
  BoardEdit = "boardEdit"
}

enum ResultState {
  Ongoing = "ongoing",
  Drawn = "drawn",
  WhiteWon = "whiteWon",
  BlackWon = "blackWon",
  Abandoned = "abandoned"
}

enum ResultReason {
  RuleResolved = "ruleResolved",
  Timeout = "timeout",
  Resignation = "resignation",
  DrawAgreement = "drawAgreement",
  Abandoned = "abandoned"
}

enum PlayerType {
  Local = "local",
  Engine = "engine"
}

enum PlayerActivityState {
  Active = "active",
  NonActive = "nonActive"
}

enum DrawOfferDirection {
  Incoming = "incoming",
  Outgoing = "outgoing"
}

interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: DrawOfferDirection
}

interface IPlayerRuntime {
  activityState: PlayerActivityState
}

interface IPlayer {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  $?: IPlayerRuntime
}

interface IEnginePlayer extends IPlayer {
  type: PlayerType.Engine
  assignedEngine: IAssignedEngine
}

interface ICapturedPieceGroup {
  pieceKind: PieceKind
  count: number
}

interface IGameMetadata {
  id: string
  name: string
  createdAt: RecordTimestamp
  updatedAt: RecordTimestamp
}

interface IGameplayOptions {
  allowTakeback?: boolean
  showLiveAnalysisMoves?: boolean
}

interface IGameRuntime {
  premoveQueue?: IPremoveQueue
  renderedPosition?: IBoardPosition
  renderedNode?: IMoveNode
  livePosition?: IBoardPosition
  liveNode?: IMoveNode
  pauseReasons?: PauseReason[]
  focusReturnUnsubscribe?: () => void
  deferredPlayerMove?: IMove
  pendingPlayerTurnPromise?: Deferred<IMove>
  pendingPlayerTurnHandlePromise?: Promise<void>
}

interface IGame {
  schemaVersion: number
  metadata: IGameMetadata
  gameState: GameState
  resultState: ResultState
  resultReason?: ResultReason
  drawOfferState?: IDrawOfferState
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  rootPosition: IBoardPosition
  moveTree: IMoveTree
  livePath?: MovePath
  renderedPath: MovePath
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  gameplayOptions: IGameplayOptions
  analysis: IGameAnalysis
  $?: IGameRuntime
}

interface ICreateGameRequest {
  name: string
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  analysisEngineProfiles: IEngineRecord[]
  showLiveAnalysisMoves?: boolean
  allowTakeback?: boolean
  timeControl: ITimeControl
  rootPosition?: IBoardPosition
}

interface IStartGameFromSetupRequest {
  name?: string
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  analysisEngineProfiles: IEngineRecord[]
  showLiveAnalysisMoves?: boolean
  allowTakeback?: boolean
  timeControl: ITimeControl
}
```

`renderedNode`, `liveNode`, `renderedPosition`, and `livePosition` are optional derived caches. `IGame.moveTree`, `renderedPath`, and `livePath` remain the only authoritative tree and selectors. While the ordinary rendered selection follows live play, `renderedPath` and `livePath` reference the same array and the two position caches reference the same `IBoardPosition`. Advancing a live move mutates both shared objects in place. Entering in-game analysis installs an independent rendered-path array even before it diverges, and advancing an analysis branch from the live node first detaches a rendered position so neither live selector nor live position changes. Returning to live play restores both aliases. **Why:** live play and the rendered history view may point at different nodes, so one ambiguous current-position field cannot represent both, while persisted caches would become a second authority after navigation, pruning, restore, or rewrite. A replacement must retain one tree with two explicit selectors, update derived caches with their owning selector, share references only while rendering live play, and detach before speculative analysis mutation.

Persistent move paths are mutable, store-owned selector values. Appending a child mutates the selected path in place and advances its runtime node cache. A live move therefore appends `livePath` once; when `renderedPath` shares that reference, the rendered selection advances automatically. Navigation, history selection, and analysis entry create or select a different path when isolation is required, while returning to the live node deliberately restores the shared `livePath` reference. **Why:** path identity expresses whether rendered state should follow live mutation. Deep-readonly observation prevents external consumers from mutating these owned arrays, and explicit store transitions control when sharing or isolation is intended.

## Rules
- `IGameRuntime.premoveQueue` is optional runtime-only FIFO data owned by this live game and its exact local player. Validation reads the current actual live position; invalidating structural actions explicitly clear the queue. See [the premove data structure](../../../PremoveDataStructure.md). Entries hold raw coordinates, expected piece kind and optional promotion; projection, red squares and detailed actual moves are derived. Queue behaviour is implemented separately after its data-driven specifications.
- `GameState` is the single authoritative playable-state enum. It replaces separate workspace, interaction, clock, and turn-waiting axes.
- `GameState.LiveWhiteTurn` and `GameState.LiveBlackTurn` are the only normal live-play states.
- `GameState.PausedWhiteTurn` and `GameState.PausedBlackTurn` are timed live states paused by user or app flow. Actual actions stay locked until Resume, but explicit Analyse entry is allowed. Already running engine output follows the paused runtime rules.
- `GameState.LiveAnalysisFrom*` means the game still has a committed live turn anchor and running live clock, but the visible board is exploring analysis moves instead of progressing the live node.
- `GameState.PausedLiveAnalysisFrom*` preserves that same live-analysis anchor and visible-side context while the associated live clock state remains paused.
- `GameState.AnalysisWhiteMove` and `GameState.AnalysisBlackMove` are non-live analysis states used for free analysis/setup and for post-result analysis after every terminal result, including checkmate.
- `GameState.BoardEdit` is a free-edit state only and is never combined with live play.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome. Check and checkmate stay on the materialised position and detailed move rather than on `IGame`. **Why:** timeout, resignation, agreement, and abandonment also end games, while historical and analysis positions can be in check without defining the workspace result. Storing checkmate on the game would conflate those axes; any replacement result model must still keep position facts separate from lifecycle outcome.
- Omitted `resultReason`, `drawOfferState`, `whitePlayer`, `blackPlayer`, `livePath`, and request-side player or engine-selection fields represent absence rather than a distinct `null` state.
- Checkmate, draw, resignation, timeout, and abandonment do not create an extra terminal `GameState`. They end live play and leave the game in one of the analysis states, while `resultState` and `resultReason` remain authoritative for the outcome.
- Player seats persist copied in-game engine payloads rather than profile IDs, so open or restored games keep their original launch configuration until the user explicitly reassigns them.
- Assigning a reusable player record parses it through `playerSchema` to create the persisted per-game player snapshot. This deliberately discards source runtime state, including engine callbacks, so later mutation or removal of the reusable record cannot alter the game participant.
- `IPlayer.type = engine` is the discriminator for treating the player as `IEnginePlayer`.
- `IEnginePlayer.assignedEngine` is the copied in-game engine payload for that seat.
- `ICreateGameRequest.whitePlayer`, `ICreateGameRequest.blackPlayer`, `IStartGameFromSetupRequest.whitePlayer`, and `IStartGameFromSetupRequest.blackPlayer` carry the selected seat assignments directly. Omitted seat fields mean the seat is intentionally unassigned for analysis/setup flows.
- `ICreateGameRequest.analysisEngineProfiles` and `IStartGameFromSetupRequest.analysisEngineProfiles` carry the selected reusable engine profiles for copied analysis-engine assignment.
- `IPlayer.$.activityState` is intentionally minimal. `active` means the seat can still participate normally, while `nonActive` covers unavailable engines, disconnected non-local players, or any other seat that has left normal participation.
- `$` is the runtime-only namespace. Anything under `$` is rebuilt in memory and is never persisted in the canonical saved-game payload.
- `IGame.$` owns game-scoped runtime concerns such as active pause reasons, focus-return teardown, a deferred live-turn move captured while paused, the deferred live-turn promise for the current turn, its awaiting handler and abort controller, and cached rendered or live node references. These flat runtime fields have exclusive state-layer owners: `GamePositionComposable` owns position and node caches, `GameClockComposable` owns pause and focus-registration state, and `GamePlayerTurnComposable` owns pending or deferred turn state.
- `IGame.$` is runtime-only but expected to be explicitly initialised during game creation or hydration. Missing runtime state is a bug, not a fallback path.
- `gameplayOptions.allowTakeback` is a persisted boolean per game and permits the confirmed rewrite of actual history; with it disabled, exploratory input requires explicit Analyse. **Why:** those are the only implemented behaviours; a policy enum would imply undefined modes and persistence/clock branches. Keeping the value on the game preserves the editing rule with the history it governs. Promote it only when another behaviour and its persisted semantics are defined.
- Turn ownership, move waiting, and move permissions are derived from `gameState`, not stored on `IPlayer`.
- Engine runtime details such as `processHandle`, availability, and last error live on `IEnginePlayer.assignedEngine.$`, not on `IPlayer.$`.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGame`.
- The baseline persisted saved-game artefact reuses `IGame` directly; there is no separate persisted `IGameDocument` shape.
- `schemaVersion` is part of `IGame`. **Why:** the persisted boundary must reject unknown formats instead of guessing their shape and needs an explicit dispatch key if a later schema is introduced. Version `1` is the first and only current schema.
- `livePath` and `renderedPath` are persisted selectors for exact restore. They identify nodes by child-index traversal from `moveTree.root` and are resolved into runtime references during hydration.
- `renderedPath` tracks the line currently highlighted in history and analysis. In normal live play it matches `livePath`, while in analysis or history navigation it may differ.
- `drawOfferState` is cleared when the draw is accepted, declined, or withdrawn, when another terminal result supersedes it, or when the game leaves live play for free analysis/setup.
- `gameplayOptions.showLiveAnalysisMoves` is persisted as part of the game, defaults to `false` for new live games and setup-to-live transitions, and is not part of global settings or remembered UI layout state.
- `analysis.seats` is persisted and restored as part of the game, and its current row order is the source of truth for mapping remembered engine-group fold state by index.
- `IGame` is the game-facing object used by mutation flows. IDs remain on `metadata.id` for routing, persistence, and lookup.
- Every persisted UTC instant is a real `Date` subclass from `@/utility/date` (e.g. `RecordTimestamp` for `metadata.createdAt`/`updatedAt`), not a string. Each subclass overrides `toString` with its own display format so components never format dates themselves; `toJSON`/schema validation still round-trip through ISO 8601 strings on disk.

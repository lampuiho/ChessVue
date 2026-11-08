# Game Workspace Types

## Purpose
Define the canonical game model used by `GamesStore`, its `src/state/game/*Composable.ts` owners, related services, and persisted saved-game payloads. Sources: `contracts/Game.ts` and `contracts/Premove.ts`.

## Types
- `enum GameState`
- `enum ResultState`
- `enum ResultReason`
- `enum PlayerType`
- `enum PlayerActivityState`
- `enum DrawOfferDirection`
- `type ReadonlyGame`
- `type IGamePositionState`

## Interfaces
- `interface IDrawOfferState`
- `interface IPlayerRuntime`
- `interface IPlayer`
- `interface IEnginePlayer`
- `interface ICapturedPieceGroup`
- `interface IGameMetadata`
- `interface IGameplayOptions`
- `interface IPremoveQueue`
- `interface IGameRuntime`
- `interface IGame`
- `interface ICreateGameRequest`
- `interface IStartGameFromSetupRequest`

## Data Structures
```ts
const enum GameState {
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

const enum ResultState {
  Ongoing = "ongoing",
  Drawn = "drawn",
  WhiteWon = "whiteWon",
  BlackWon = "blackWon",
  Abandoned = "abandoned"
}

const enum ResultReason {
  Checkmate = "checkmate",
  Stalemate = "stalemate",
  InsufficientMaterial = "insufficientMaterial",
  Timeout = "timeout",
  Resignation = "resignation",
  DrawAgreement = "drawAgreement",
  Abandoned = "abandoned"
}

const enum PlayerType {
  Local = "local",
  Engine = "engine"
}

const enum PlayerActivityState {
  Active = "active",
  NonActive = "nonActive"
}

const enum DrawOfferDirection {
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

// contracts/Premove.ts
interface IPremoveQueue {
  player: IPlayer
  moves: IMoveRaw[]
}

interface IGameRuntime {
  premoveQueue?: IPremoveQueue
  resultNotificationPending?: boolean
  renderedPosition?: IBoardPosition
  renderedNode?: IMoveNode
  livePosition?: IBoardPosition
  liveNode?: IMoveNode
  pauseReasons?: PauseReason[]
  focusReturnUnsubscribe?: () => void
  deferredPlayerMove?: IMove
  pendingPlayerTurnPromise?: Deferred<IMove>
  pendingPlayerTurnHandlePromise?: Promise<void>
  pendingPlayerTurnAbortController?: AbortController
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

type ReadonlyGame = DeepReadonly<IGame>
type IGamePositionState = Pick<IGame, "rootPosition" | "moveTree" | "livePath" | "renderedPath" | "$">

interface ICreateGameRequest {
  name: string
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  randomiseColours?: boolean
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
  randomiseColours?: boolean
  analysisEngineProfiles: IEngineRecord[]
  showLiveAnalysisMoves?: boolean
  allowTakeback?: boolean
  timeControl: ITimeControl
}
```

`renderedNode`, `liveNode`, `renderedPosition`, and `livePosition` are optional derived caches. `IGame.moveTree`, `renderedPath`, and `livePath` remain the only authoritative tree and selectors. While the ordinary rendered selection follows live play, `renderedPath` and `livePath` reference the same array and the two position caches reference the same `IBoardPosition`. Advancing a live move mutates both shared objects in place. Entering in-game analysis installs an independent rendered-path array even before it diverges, and advancing an analysis branch from the live node first detaches a rendered position so neither live selector nor live position changes. Returning to live play restores both aliases, and `GamePositionComposable.hydrateGame(...)` re-establishes them for a loaded game whose saved selectors are equal outside live analysis. **Why:** live play and the rendered history view may point at different nodes, so one ambiguous current-position field cannot represent both, while persisted caches would become a second authority after navigation, pruning, restore, or rewrite. A replacement must retain one tree with two explicit selectors, update derived caches with their owning selector, share references only while rendering live play, and detach before speculative analysis mutation.

Persistent move paths are mutable, store-owned selector values. Appending a child mutates the selected path in place and advances its runtime node cache. A live move therefore appends `livePath` once; when `renderedPath` shares that reference, the rendered selection advances automatically. Navigation, history selection, and analysis entry create or select a different path when isolation is required, while returning to the live node deliberately restores the shared `livePath` reference. **Why:** path identity expresses whether rendered state should follow live mutation. Deep-readonly observation prevents external consumers from mutating these owned arrays, and explicit store transitions control when sharing or isolation is intended.

## Schemas
- `gameStates`, `resultStates`, `resultReasons`, `playerTypes`, `playerActivityStates`, and `drawOfferDirections` feed `gameStateSchema`, `resultStateSchema`, `resultReasonSchema` (already `.optional()`), `playerTypeSchema`, `playerActivityStateSchema`, and `drawOfferDirectionSchema`.
- `playerSchema` is a discriminated union on `type`: a local player has `colour`, `type`, and a non-empty `displayName`; an engine player also requires `assignedEngine` through `assignedEngineSchema`. Neither branch declares `$`.
- `drawOfferStateSchema`, `playerRuntimeSchema`, `capturedPieceGroupSchema` (`count >= 0`), `gameMetadataSchema` (non-empty `id` and `name`, `RecordTimestamp` instants), and `gameplayOptionsSchema` validate their interfaces.
- `gameSchema` is the canonical saved-game schema. It requires `schemaVersion: 1` and declares every persisted `IGame` field except `$`.
- `createGameRequestSchema` and `startGameFromSetupRequestSchema` validate creation requests; both cap `analysisEngineProfiles` at four `engineRecordSchema` entries. `createGameRequestSchema.omit({ rootPosition: true })` is also the base of the settings defaults schema (see [Settings](Settings.md)).

## Rules
- `GameState` is the single authoritative playable-state enum. It replaces separate workspace, interaction, clock, and turn-waiting axes.
- `GameState.LiveWhiteTurn` and `GameState.LiveBlackTurn` are the only normal live-play states.
- `GameState.PausedWhiteTurn` and `GameState.PausedBlackTurn` are timed live states paused by user or app flow. Actual actions stay locked until Resume, but explicit Analyse entry is allowed. Already running engine output follows the paused runtime rules.
- `GameState.LiveAnalysisFrom*` means the game still has a committed live turn anchor and running live clock, but the visible board is exploring analysis moves instead of progressing the live node.
- `GameState.PausedLiveAnalysisFrom*` preserves that same live-analysis anchor and visible-side context while the associated live clock state remains paused.
- `GameState.AnalysisWhiteMove` and `GameState.AnalysisBlackMove` are non-live analysis states used for free analysis/setup and for post-result analysis after every terminal result, including checkmate.
- `GameState.BoardEdit` is a free-edit state only and is never combined with live play.
- `resultState` records the outcome only, while `resultReason` records why the game reached that outcome. Check and checkmate as position facts stay on the materialised position and detailed move rather than on `IGame`. **Why:** timeout, resignation, agreement, and abandonment also end games, while historical and analysis positions can be in check without defining the workspace result. Storing a position's check state on the game would conflate those axes; any replacement result model must still keep position facts separate from lifecycle outcome.
- Rule-resolved endings name their rule. After each committed live move `GameStatusComposable.updateGameResultFromLivePosition(...)` applies `GameRuleUtility.resolveGameResult(...)`, which yields `Checkmate` with the winning `resultState`, or `Stalemate` or `InsufficientMaterial` with `ResultState.Drawn`. `GameClockComposable` records `Timeout`, and `GameStatusComposable` records `Resignation` and `DrawAgreement`. The named reason lets `GameResultModal` state the cause and lets `GameAnalysisComposable` skip engine search when the rendered live position ended by checkmate or stalemate, without re-deriving the terminal position.
- `ResultState.Abandoned` and `ResultReason.Abandoned` are reserved: presentation can display them, but no current workflow produces them.
- The persisted `ResultReason` set replaced the former single `ruleResolved` value without a schema-version change; no compatibility reader maps the old value, so a saved game containing it fails validation.
- Omitted `resultReason`, `drawOfferState`, `whitePlayer`, `blackPlayer`, `livePath`, and request-side player, colour-randomisation, or gameplay-option fields represent absence rather than a distinct `null` state.
- Checkmate, draw, resignation, timeout, and abandonment do not create an extra terminal `GameState`. They end live play and leave the game in one of the analysis states, while `resultState` and `resultReason` remain authoritative for the outcome.
- Player seats persist copied in-game engine payloads rather than profile IDs, so open or restored games keep their original launch configuration until the user explicitly reassigns them.
- Assigning a reusable player record parses it through `playerSchema` to create the persisted per-game player snapshot (`GamePlayerTurnComposable.createPlayerSnapshot(...)`). This deliberately discards source runtime state, including engine callbacks, so later mutation or removal of the reusable record cannot alter the game participant.
- `IPlayer.type = engine` is the discriminator for treating the player as `IEnginePlayer`.
- `IEnginePlayer.assignedEngine` is the copied in-game engine payload for that seat.
- `ICreateGameRequest.whitePlayer`, `ICreateGameRequest.blackPlayer`, `IStartGameFromSetupRequest.whitePlayer`, and `IStartGameFromSetupRequest.blackPlayer` carry the selected seat assignments directly. Two present seats produce a live game; an omitted seat means the seat is intentionally unassigned for analysis/setup flows.
- `randomiseColours` on either request is honoured only when both seats are present. `GameWorkspaceComposable` then draws once, assigns the two input participants to White and Black, copies each participant's engine configuration with it, and renames built-in local names (`White`/`Black`) to `Player 1`/`Player 2`. The game persists only the resulting assignments, so restore never draws again.
- `ICreateGameRequest.analysisEngineProfiles` and `IStartGameFromSetupRequest.analysisEngineProfiles` carry the selected reusable engine profiles for copied analysis-engine assignment.
- `IPlayer.$.activityState` is intentionally minimal. `active` means the seat can still participate normally, while `nonActive` is reserved for unavailable engines, disconnected non-local players, or any other seat that has left normal participation. Player snapshots and hydrated players currently always receive `active`.
- `$` is the runtime-only namespace. Anything under `$` is rebuilt in memory and is never persisted in the canonical saved-game payload.
- `IGame.$` owns game-scoped runtime concerns. Each flat field has one exclusive state-layer owner:
  - `GamePositionComposable` creates the runtime (`createGameRuntime`, `requireGameRuntime`) and owns `renderedPosition`, `renderedNode`, `livePosition`, and `liveNode`.
  - `GameClockComposable` owns `pauseReasons` and `focusReturnUnsubscribe`. `pauseReasons` lists the active `PauseReason` owners; resuming one reason leaves the game paused until none remain. A loaded game saved in a paused state receives `[PauseReason.Manual]` because saved states omit runtime owners. The focus registration exists only while an ongoing timed live or live-analysis clock is running.
  - `GamePlayerTurnComposable` owns `pendingPlayerTurnPromise`, `pendingPlayerTurnHandlePromise`, `pendingPlayerTurnAbortController`, and `deferredPlayerMove`; `GameTurnRuntimeComposable.clearPlayerTurnRuntime(...)` is the shared cancellation path that aborts with `Aborted` and awaits the handler.
  - `GamePremoveComposable` owns `premoveQueue` (see [Premove Queue](#premove-queue)).
  - `GameStatusComposable.flagResultNotification(...)` sets `resultNotificationPending` whenever a live game reaches a terminal result through a rule result, timeout, resignation, or draw agreement. `GameView` consumes it once by clearing it and opening `GameResultModal`. Because the flag is runtime-only, a finished game that is restored or reopened does not announce its result again.
- `IGame.$` is runtime-only but expected to be explicitly initialised during game creation or hydration. Missing runtime state is a bug, not a fallback path; `requireGameRuntime(...)` throws.
- `IGamePositionState` is the narrow structural view taken by `GamePositionComposable` selector, path, and cache functions. They read and write only the root, tree, selectors, and runtime caches.
- `ReadonlyGame` is the type returned by `GamesStore.getGame(...)` and `listGames()`; mutations go through store actions. See [Readonly Projections](index.md#readonly-projections).
- `gameplayOptions.allowTakeback` is a persisted boolean per game and permits takeback and the confirmed rewrite of actual history in a live game; with it disabled or omitted, live takeback is rejected and exploratory input requires explicit Analyse. **Why:** those are the only implemented behaviours; a policy enum would imply undefined modes and persistence/clock branches. Keeping the value on the game preserves the editing rule with the history it governs. Promote it only when another behaviour and its persisted semantics are defined.
- Turn ownership, move waiting, and move permissions are derived from `gameState`, not stored on `IPlayer`.
- Engine runtime details such as `process`, availability, and last error live on `IEnginePlayer.assignedEngine.$`, not on `IPlayer.$`.
- `ICapturedPieceGroup` is a derived read model for player-strip captured-material display and is not persisted on `IGame`.
- The baseline persisted saved-game artefact reuses `IGame` directly; there is no separate persisted `IGameDocument` shape. See [GameDocument](GameDocument.md).
- `schemaVersion` is part of `IGame`. **Why:** the persisted boundary must reject unknown formats instead of guessing their shape and needs an explicit dispatch key if a later schema is introduced. Version `1` is the first and only current schema.
- `livePath` and `renderedPath` are persisted selectors for exact restore. They identify nodes by child-index traversal from `moveTree.root` and are resolved into runtime references during hydration.
- `renderedPath` tracks the line currently highlighted in history and analysis. In normal live play it matches `livePath`, while in analysis or history navigation it may differ.
- `drawOfferState` is cleared when the draw is accepted, declined, or withdrawn, when another terminal result supersedes it, or when the game leaves live play for free analysis/setup.
- `gameplayOptions.showLiveAnalysisMoves` is persisted as part of the game and is not part of remembered UI layout state. New games and setup-to-live transitions copy it from the creation request; the presentation creation paths resolve an omitted request value to `false` through `copyGameRequest(...)`, while the settings `gameDefaults` supply the usual request value.
- Presentation creation paths likewise resolve an omitted request `allowTakeback` to `true`, so new games persist explicit gameplay options.
- `analysis.seats` is persisted and restored as part of the game, and its current row order is the source of truth for mapping remembered engine-group fold state by index.
- `IGame` is the game-facing object used by mutation flows. IDs remain on `metadata.id` for routing, persistence, and lookup.
- `metadata.updatedAt` is refreshed by `GameRecordComposable.timestampGame(...)` at data-changing actions. It is a record timestamp only: canonical games are reactive objects, so rendering follows the changed data rather than a revision counter, and premove queue edits do not timestamp. The removed revision mechanism is recorded in the archived [workspace revision removal plan](../../../ArchivedPlans/WorkspaceRevisionRemovalPlan.md).
- Every persisted UTC instant is a real `Date` subclass from `@/utility/date` (e.g. `RecordTimestamp` for `metadata.createdAt`/`updatedAt`), not a string. Each subclass overrides `toString` with its own display format so components never format dates themselves; `toJSON`/schema validation still round-trip through ISO 8601 strings on disk.

## Premove Queue
`IGameRuntime.premoveQueue` is the optional runtime-only FIFO of off-turn local input for one live game, declared in `contracts/Premove.ts`.

- `player` is the actual local seat object that owns the queue. `GamesStore.makeMove(...)` creates and appends to the queue only for an ongoing live game shown at its live node, when exactly one seat is local and the side to move is not that local seat. Structural actions clear the queue whenever ownership could change, so consumers trust this invariant rather than comparing owners.
- `moves` holds the supplied `IMoveRaw` references in order, using absolute board IDs and an optional explicit `promotionPiece`. Index zero is for the next actual local turn; later entries depend on earlier ones. `GamePremoveComposable.appendPremove(...)` pushes the supplied object without copying, sanitising, or validating it, and the array is `shallowReactive` so push, shift, and clear are observable without converting entries. An empty or absent queue means no premoves; the queue is removed after its last entry is consumed or cancelled.
- There is no stored expected moving kind, entry ID, node anchor, copied FEN, speculative history, or additional turn owner. Source kind and colour come from the board at each projected step, and execution reads the actual board again. A chosen promotion changes the projected piece, so a later raw move uses the promoted kind naturally. **Why:** stored expectations or anchors would be a second authority that could disagree with the actual board after a real move; invalidation is instead explicit at the actions that change ownership or history.
- After each actual live move, `GamePremoveComposable.revalidatePremoves(...)` makes one detached pass over the queue from the actual live position and clears the whole queue if the game has ended or any entry is no longer a candidate move for the owning colour. When the local turn is due, `GamePlayerTurnComposable` matches the head against the actual legal moves, builds the detailed move, shifts it, and submits it through the ordinary turn path; an illegal due head clears the queue. A head accepted while the game is paused waits in `deferredPlayerMove` with only the tail queued.
- Takeback, confirmed history rewrite, board-edit root replacement, player reassignment, start-from-setup, resignation, draw agreement, timeout, explicit tab close, and store disposal clear the queue. Board cancellation input clears it through `GamesStore.clearPremoves(...)`. Analysis, history navigation, and pause retain it.
- Canonical positions are never projected. `GamePositionComposable.getPremoveProjection(...)` copies the base position once and applies any held local move plus every queued entry to that copy, returning the derived position and the shaded squares (including castle rook endpoints).
- Save excludes `$`, and hydration creates an empty runtime, so loaded games start without premoves.

The design and its lifecycle rationale are recorded in the archived [premove data structure](../../../ArchivedPlans/PremoveDataStructure.md) and its parent [premove plan](../../../ArchivedPlans/PreMovePlan%28ToDo%29.md).

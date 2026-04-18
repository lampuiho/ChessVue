import { z } from 'zod'
import { gameAnalysisSchema, type IGameAnalysis } from './Analysis'
import { assignedEngineSchema, engineRecordSchema, type IAssignedEngine, type IEngineRecord } from './Engine'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { movePathSchema, moveTreeSchema, type IMove, type IMoveTree, type MovePath } from './Move'
import { clockSnapshotSchema, timeControlSchema, type IClockSnapshot, type ITimeControl } from './TimeControl'
import { pieceKindSchema, playerColourSchema, type PieceKind, type PlayerColour } from './Chess'
import { type PauseReason } from './state'

export const enum GameState {
  LiveWhiteTurn = 'liveWhiteTurn',
  LiveBlackTurn = 'liveBlackTurn',
  PausedWhiteTurn = 'pausedWhiteTurn',
  PausedBlackTurn = 'pausedBlackTurn',
  LiveAnalysisFromWhiteTurnWhiteMove = 'liveAnalysisFromWhiteTurnWhiteMove',
  LiveAnalysisFromWhiteTurnBlackMove = 'liveAnalysisFromWhiteTurnBlackMove',
  LiveAnalysisFromBlackTurnWhiteMove = 'liveAnalysisFromBlackTurnWhiteMove',
  LiveAnalysisFromBlackTurnBlackMove = 'liveAnalysisFromBlackTurnBlackMove',
  PausedLiveAnalysisFromWhiteTurnWhiteMove = 'pausedLiveAnalysisFromWhiteTurnWhiteMove',
  PausedLiveAnalysisFromWhiteTurnBlackMove = 'pausedLiveAnalysisFromWhiteTurnBlackMove',
  PausedLiveAnalysisFromBlackTurnWhiteMove = 'pausedLiveAnalysisFromBlackTurnWhiteMove',
  PausedLiveAnalysisFromBlackTurnBlackMove = 'pausedLiveAnalysisFromBlackTurnBlackMove',
  AnalysisWhiteMove = 'analysisWhiteMove',
  AnalysisBlackMove = 'analysisBlackMove',
  BoardEdit = 'boardEdit',
  Checkmate = 'checkmate',
}
export const enum ResultState {
  Ongoing = 'ongoing',
  Drawn = 'drawn',
  WhiteWon = 'whiteWon',
  BlackWon = 'blackWon',
  Abandoned = 'abandoned',
}
export const enum ResultReason {
  RuleResolved = 'ruleResolved',
  Timeout = 'timeout',
  Resignation = 'resignation',
  DrawAgreement = 'drawAgreement',
  Abandoned = 'abandoned',
}
export const enum PlayerType {
  Local = 'local',
  Engine = 'engine',
}
export const enum PlayerActivityState {
  Active = 'active',
  NonActive = 'nonActive',
}
export const enum DrawOfferDirection {
  Incoming = 'incoming',
  Outgoing = 'outgoing',
}
export const gameStates = [
  GameState.LiveWhiteTurn,
  GameState.LiveBlackTurn,
  GameState.PausedWhiteTurn,
  GameState.PausedBlackTurn,
  GameState.LiveAnalysisFromWhiteTurnWhiteMove,
  GameState.LiveAnalysisFromWhiteTurnBlackMove,
  GameState.LiveAnalysisFromBlackTurnWhiteMove,
  GameState.LiveAnalysisFromBlackTurnBlackMove,
  GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove,
  GameState.PausedLiveAnalysisFromWhiteTurnBlackMove,
  GameState.PausedLiveAnalysisFromBlackTurnWhiteMove,
  GameState.PausedLiveAnalysisFromBlackTurnBlackMove,
  GameState.AnalysisWhiteMove,
  GameState.AnalysisBlackMove,
  GameState.BoardEdit,
  GameState.Checkmate,
] as const
export const resultStates = [ResultState.Ongoing, ResultState.Drawn, ResultState.WhiteWon, ResultState.BlackWon, ResultState.Abandoned] as const
export const resultReasons = [ResultReason.RuleResolved, ResultReason.Timeout, ResultReason.Resignation, ResultReason.DrawAgreement, ResultReason.Abandoned] as const
export const playerTypes = [PlayerType.Local, PlayerType.Engine] as const
export const playerActivityStates = [PlayerActivityState.Active, PlayerActivityState.NonActive] as const
export const drawOfferDirections = [DrawOfferDirection.Incoming, DrawOfferDirection.Outgoing] as const

export interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: DrawOfferDirection
}
export interface IPlayerRuntime {
  activityState: PlayerActivityState
}
export interface IPlayer {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  $?: IPlayerRuntime
}
export interface IEnginePlayer extends IPlayer {
  type: PlayerType.Engine
  assignedEngine: IAssignedEngine
}
export interface ICapturedPieceGroup {
  pieceKind: PieceKind
  count: number
}
export interface IGameMetadata {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
export interface ILiveAnalysisOptions {
  showLiveAnalysisMoves: boolean
}
export interface IGameRuntime {
  pauseReasons?: PauseReason[]
  focusReturnUnsubscribe?: () => void
  deferredPlayerMove?: IMove
}
export interface IGame {
  schemaVersion: number
  metadata: IGameMetadata
  gameState: GameState
  resultState: ResultState
  resultReason?: ResultReason
  drawOfferState?: IDrawOfferState
  whitePlayer?: IPlayer | IEnginePlayer
  blackPlayer?: IPlayer | IEnginePlayer
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  livePath?: MovePath
  highlightPath: MovePath
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  liveAnalysisOptions: ILiveAnalysisOptions
  analysis: IGameAnalysis
  $?: IGameRuntime
}
export interface ICreateGameRequest {
  name: string
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  analysisEngineProfiles: IEngineRecord[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
  boardRoot?: IBoardPosition
}
export interface IStartGameFromSetupRequest {
  name?: string
  whitePlayer?: IPlayer
  blackPlayer?: IPlayer
  analysisEngineProfiles: IEngineRecord[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
}
export const gameStateSchema = z.enum(gameStates)
export const resultStateSchema = z.enum(resultStates)
export const resultReasonSchema = z.enum(resultReasons).nullable().optional().transform((value) => value ?? undefined)
export const playerTypeSchema = z.enum(playerTypes)
export const playerActivityStateSchema = z.enum(playerActivityStates)
export const drawOfferDirectionSchema = z.enum(drawOfferDirections)

export const drawOfferStateSchema = z.object({
  offeringColour: playerColourSchema,
  respondingColour: playerColourSchema,
  direction: drawOfferDirectionSchema,
})

export const playerRuntimeSchema = z.object({
  activityState: playerActivityStateSchema,
})

export const playerSchema = z.discriminatedUnion('type', [
  z.object({
    colour: playerColourSchema,
    type: z.literal(PlayerType.Local),
    displayName: z.string().min(1),
  }),
  z.object({
    colour: playerColourSchema,
    type: z.literal(PlayerType.Engine),
    displayName: z.string().min(1),
    assignedEngine: assignedEngineSchema,
  }),
])

export const capturedPieceGroupSchema = z.object({
  pieceKind: pieceKindSchema,
  count: z.number().int().min(0),
})

export const gameMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

export const liveAnalysisOptionsSchema = z.object({
  showLiveAnalysisMoves: z.boolean(),
})

export const gameSchema = z.object({
  schemaVersion: z.literal(1),
  metadata: gameMetadataSchema,
  gameState: gameStateSchema,
  resultState: resultStateSchema,
  resultReason: resultReasonSchema,
  drawOfferState: drawOfferStateSchema.nullable().optional().transform((value) => value ?? undefined),
  whitePlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  blackPlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  boardRoot: boardPositionSchema,
  moveTree: moveTreeSchema,
  livePath: movePathSchema.nullable().optional().transform((value) => value ?? undefined),
  highlightPath: movePathSchema,
  timeControl: timeControlSchema,
  clockSnapshot: clockSnapshotSchema,
  liveAnalysisOptions: liveAnalysisOptionsSchema,
  analysis: gameAnalysisSchema,
})

export const createGameRequestSchema = z.object({
  name: z.string().min(1),
  whitePlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  blackPlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  analysisEngineProfiles: z.array(engineRecordSchema).max(4),
  showLiveAnalysisMoves: z.boolean(),
  timeControl: timeControlSchema,
  boardRoot: boardPositionSchema.optional(),
})

export const startGameFromSetupRequestSchema = z.object({
  name: z.string().min(1).optional(),
  whitePlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  blackPlayer: playerSchema.nullable().optional().transform((value) => value ?? undefined),
  analysisEngineProfiles: z.array(engineRecordSchema).max(4),
  showLiveAnalysisMoves: z.boolean(),
  timeControl: timeControlSchema,
})

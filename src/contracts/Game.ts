import { z } from 'zod'
import { analysisAssignmentSchema, assignedEngineSchema, type IAnalysisAssignment, type IAssignedEngine } from './Engine'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { movePathSchema, moveTreeSchema, type IMoveTree, type MovePath } from './Move'
import { clockSnapshotSchema, timeControlSchema, type IClockSnapshot, type ITimeControl } from './TimeControl'
import { pieceKindSchema, playerColourSchema, type PieceKind, type PlayerColour } from './Chess'

export const enum WorkspaceKind {
  LiveGame = 'liveGame',
  FreeAnalysisSetup = 'freeAnalysisSetup',
}
export const enum InteractionContext {
  CurrentPosition = 'currentPosition',
  HistoryReview = 'historyReview',
  InGameAnalysis = 'inGameAnalysis',
  BoardEdit = 'boardEdit',
}
export const enum ClockStateKind {
  None = 'none',
  Running = 'running',
  Paused = 'paused',
  Expired = 'expired',
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
export const enum DrawOfferDirection {
  Incoming = 'incoming',
  Outgoing = 'outgoing',
}
export const workspaceKinds = [WorkspaceKind.LiveGame, WorkspaceKind.FreeAnalysisSetup] as const
export const interactionContexts = [InteractionContext.CurrentPosition, InteractionContext.HistoryReview, InteractionContext.InGameAnalysis, InteractionContext.BoardEdit] as const
export const clockStateKinds = [ClockStateKind.None, ClockStateKind.Running, ClockStateKind.Paused, ClockStateKind.Expired] as const
export const resultStates = [ResultState.Ongoing, ResultState.Drawn, ResultState.WhiteWon, ResultState.BlackWon, ResultState.Abandoned] as const
export const resultReasons = [ResultReason.RuleResolved, ResultReason.Timeout, ResultReason.Resignation, ResultReason.DrawAgreement, ResultReason.Abandoned] as const
export const playerTypes = [PlayerType.Local, PlayerType.Engine] as const
export const drawOfferDirections = [DrawOfferDirection.Incoming, DrawOfferDirection.Outgoing] as const

export interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: DrawOfferDirection
}
export interface IPlayerSlot {
  colour: PlayerColour
  type: PlayerType
  displayName: string
  assignedEngine: IAssignedEngine | null
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
export interface IGameWorkspace {
  schemaVersion: number
  metadata: IGameMetadata
  workspaceKind: WorkspaceKind
  interactionContext: InteractionContext
  clockState: ClockStateKind
  resultState: ResultState
  resultReason: ResultReason | null
  drawOfferState: IDrawOfferState | null
  whitePlayer: IPlayerSlot | null
  blackPlayer: IPlayerSlot | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  livePath: MovePath | null
  highlightPath: MovePath
  timeControl: ITimeControl
  clockSnapshot: IClockSnapshot
  liveAnalysisOptions: ILiveAnalysisOptions
  analysisAssignment: IAnalysisAssignment
}
export interface ICreateGameRequest {
  name: string
  whitePlayerType: PlayerType | null
  blackPlayerType: PlayerType | null
  whiteEngineId: string | null
  blackEngineId: string | null
  analysisEngineIds: string[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
  boardRoot?: IBoardPosition
}
export interface IStartGameFromSetupRequest {
  name?: string
  whitePlayerType: PlayerType
  blackPlayerType: PlayerType
  whiteEngineId: string | null
  blackEngineId: string | null
  analysisEngineIds: string[]
  showLiveAnalysisMoves: boolean
  timeControl: ITimeControl
}
export interface IReassignPlayerRequest {
  playerType: PlayerType | null
  engineId: string | null
}
export const workspaceKindSchema = z.enum(workspaceKinds)
export const interactionContextSchema = z.enum(interactionContexts)
export const clockStateKindSchema = z.enum(clockStateKinds)
export const resultStateSchema = z.enum(resultStates)
export const resultReasonSchema = z.enum(resultReasons).nullable()
export const playerTypeSchema = z.enum(playerTypes)
export const drawOfferDirectionSchema = z.enum(drawOfferDirections)

export const drawOfferStateSchema = z.object({
  offeringColour: playerColourSchema,
  respondingColour: playerColourSchema,
  direction: drawOfferDirectionSchema,
})

export const playerSlotSchema = z.object({
  colour: playerColourSchema,
  type: playerTypeSchema,
  displayName: z.string().min(1),
  assignedEngine: assignedEngineSchema.nullable(),
})

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

export const gameWorkspaceSchema = z.object({
  schemaVersion: z.literal(1),
  metadata: gameMetadataSchema,
  workspaceKind: workspaceKindSchema,
  interactionContext: interactionContextSchema,
  clockState: clockStateKindSchema,
  resultState: resultStateSchema,
  resultReason: resultReasonSchema,
  drawOfferState: drawOfferStateSchema.nullable(),
  whitePlayer: playerSlotSchema.nullable(),
  blackPlayer: playerSlotSchema.nullable(),
  boardRoot: boardPositionSchema,
  moveTree: moveTreeSchema,
  livePath: movePathSchema.nullable(),
  highlightPath: movePathSchema,
  timeControl: timeControlSchema,
  clockSnapshot: clockSnapshotSchema,
  liveAnalysisOptions: liveAnalysisOptionsSchema,
  analysisAssignment: analysisAssignmentSchema,
})

export const createGameRequestSchema = z.object({
  name: z.string().min(1),
  whitePlayerType: playerTypeSchema.nullable(),
  blackPlayerType: playerTypeSchema.nullable(),
  whiteEngineId: z.string().min(1).nullable(),
  blackEngineId: z.string().min(1).nullable(),
  analysisEngineIds: z.array(z.string().min(1)).max(4),
  showLiveAnalysisMoves: z.boolean(),
  timeControl: timeControlSchema,
  boardRoot: boardPositionSchema.optional(),
})

export const startGameFromSetupRequestSchema = z.object({
  name: z.string().min(1).optional(),
  whitePlayerType: playerTypeSchema,
  blackPlayerType: playerTypeSchema,
  whiteEngineId: z.string().min(1).nullable(),
  blackEngineId: z.string().min(1).nullable(),
  analysisEngineIds: z.array(z.string().min(1)).max(4),
  showLiveAnalysisMoves: z.boolean(),
  timeControl: timeControlSchema,
})

export const reassignPlayerRequestSchema = z.object({
  playerType: playerTypeSchema.nullable(),
  engineId: z.string().min(1).nullable(),
})

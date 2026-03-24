import { z } from 'zod'

import { analysisAssignmentSchema, assignedEngineSchema, type IAnalysisAssignment, type IAssignedEngine } from './Engine'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { moveTreeSchema, type IMoveTree } from './Move'
import { clockSnapshotSchema, timeControlSchema, type IClockSnapshot, type ITimeControl } from './TimeControl'
import { playerColourSchema, type PieceKind, type PlayerColour } from './Chess'

export type WorkspaceKind = 'liveGame' | 'freeAnalysisSetup'
export type InteractionContext = 'currentPosition' | 'historyReview' | 'inGameAnalysis' | 'boardEdit'
export type ClockStateKind = 'none' | 'running' | 'paused' | 'expired'
export type ResultState = 'ongoing' | 'drawn' | 'whiteWon' | 'blackWon' | 'abandoned'
export type ResultReason = 'ruleResolved' | 'timeout' | 'resignation' | 'drawAgreement' | 'abandoned' | null
export type PlayerType = 'local' | 'engine'

export interface IDrawOfferState {
  offeringColour: PlayerColour
  respondingColour: PlayerColour
  direction: 'incoming' | 'outgoing'
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
  resultReason: ResultReason
  drawOfferState: IDrawOfferState | null
  whitePlayer: IPlayerSlot | null
  blackPlayer: IPlayerSlot | null
  boardRoot: IBoardPosition
  moveTree: IMoveTree
  liveNodeId: string | null
  visibleNodeId: string
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

export const workspaceKindSchema = z.enum(['liveGame', 'freeAnalysisSetup'])
export const interactionContextSchema = z.enum(['currentPosition', 'historyReview', 'inGameAnalysis', 'boardEdit'])
export const clockStateKindSchema = z.enum(['none', 'running', 'paused', 'expired'])
export const resultStateSchema = z.enum(['ongoing', 'drawn', 'whiteWon', 'blackWon', 'abandoned'])
export const resultReasonSchema = z.enum(['ruleResolved', 'timeout', 'resignation', 'drawAgreement', 'abandoned']).nullable()
export const playerTypeSchema = z.enum(['local', 'engine'])

export const drawOfferStateSchema = z.object({
  offeringColour: playerColourSchema,
  respondingColour: playerColourSchema,
  direction: z.enum(['incoming', 'outgoing']),
})

export const playerSlotSchema = z.object({
  colour: playerColourSchema,
  type: playerTypeSchema,
  displayName: z.string().min(1),
  assignedEngine: assignedEngineSchema.nullable(),
})

export const capturedPieceGroupSchema = z.object({
  pieceKind: z.enum(['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']),
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
  liveNodeId: z.string().uuid().nullable(),
  visibleNodeId: z.string().uuid(),
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

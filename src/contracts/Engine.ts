import { z } from 'zod'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { moveSchema, type IMove } from './Move'
import type { IAnalysisLine } from './Analysis'

export type ProcessHandle = string
export const enum EngineProtocol {
  Uci = 'uci',
}
export const enum EngineClientType {
  Uci = 'uci',
}
export const enum EngineAvailability {
  Ready = 'ready',
  Starting = 'starting',
  Running = 'running',
  Unavailable = 'unavailable',
  Failed = 'failed',
}
export const enum EngineAnalysisSearchMode {
  Infinite = 'infinite',
}
export const engineProtocols = [EngineProtocol.Uci] as const
export const engineClientTypes = [EngineClientType.Uci] as const
export const engineAvailabilities = [EngineAvailability.Ready, EngineAvailability.Starting, EngineAvailability.Running, EngineAvailability.Unavailable, EngineAvailability.Failed] as const
export const engineAnalysisSearchModes = [EngineAnalysisSearchMode.Infinite] as const

export interface IEngineOptionMap {
  [optionName: string]: string | number | boolean
}
export interface IEngineRecord {
  id: string
  displayName: string
  executablePath: string
  clientType: EngineClientType
  protocol: EngineProtocol
  options: IEngineOptionMap
}
export interface IAssignedEngineRuntime {
  processHandle?: ProcessHandle
  availability: EngineAvailability
  lastError?: string
  analysisCallback?: (update: IEngineAnalysisUpdate) => void
  analysisLines: Map<number, IAnalysisLine>
}
export interface IAssignedEngine {
  displayName: string
  executablePath: string
  clientType: EngineClientType
  protocol: EngineProtocol
  options: IEngineOptionMap
  $?: IAssignedEngineRuntime
}
export interface IEnginePositionState {
  rootPosition: IBoardPosition
  movesFromRoot: IMove[]
  currentPosition: IBoardPosition
  requiresNewGameBoundary: boolean
}
export interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: EngineAnalysisSearchMode
}
export interface IEngineAnalysisUpdate {
  position: IBoardPosition
  positionKey: string
  bestMove?: IMove
  lines: IAnalysisLine[]
  isFinal: boolean
}
export interface IEngineRegistrationRequest {
  name?: string
  code?: string
  registerLater: boolean
}
export const engineProtocolSchema = z.enum(engineProtocols)
export const engineClientTypeSchema = z.enum(engineClientTypes)
export const engineAvailabilitySchema = z.enum(engineAvailabilities)
export const engineAnalysisSearchModeSchema = z.enum(engineAnalysisSearchModes)
export const engineOptionValueSchema = z.union([z.string(), z.number(), z.boolean()])
export const engineOptionMapSchema = z.record(z.string(), engineOptionValueSchema)

export const engineRecordSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  executablePath: z.string(),
  clientType: engineClientTypeSchema.default(EngineClientType.Uci),
  protocol: engineProtocolSchema,
  options: engineOptionMapSchema,
})

export const assignedEngineSchema = z.object({
  displayName: z.string().min(1),
  executablePath: z.string(),
  clientType: engineClientTypeSchema.default(EngineClientType.Uci),
  protocol: engineProtocolSchema,
  options: engineOptionMapSchema,
})

export const enginePositionStateSchema = z.object({
  rootPosition: boardPositionSchema,
  movesFromRoot: z.array(moveSchema),
  currentPosition: boardPositionSchema,
  requiresNewGameBoundary: z.boolean(),
})

export const engineAnalysisRequestSchema = z.object({
  multiPv: z.number().int().min(1),
  searchMode: engineAnalysisSearchModeSchema,
})

export const engineRegistrationRequestSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  registerLater: z.boolean(),
})

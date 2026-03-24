import { z } from 'zod'

import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { moveSchema, type IMove } from './Move'

export type EngineProtocol = 'uci'
export type EngineRole = 'player' | 'analysis'
export type EngineAvailability = 'ready' | 'starting' | 'running' | 'unavailable' | 'failed'

export interface IEngineOptionMap {
  [optionName: string]: string | number | boolean
}

export interface IEngineRecord {
  id: string
  displayName: string
  executablePath: string
  protocol: EngineProtocol
  options: IEngineOptionMap
}

export interface IAssignedEngine {
  assignedEngineId: string
  sourceProfileId: string | null
  displayName: string
  executablePath: string
  protocol: EngineProtocol
  options: IEngineOptionMap
}

export interface IAnalysisAssignment {
  assignedEngines: IAssignedEngine[]
}

export interface IEnginePositionState {
  rootPosition: IBoardPosition
  movesFromRoot: IMove[]
  currentPosition: IBoardPosition
  requiresNewGameBoundary: boolean
}

export interface IEngineRuntimeSession {
  sessionId: string
  gameId: string
  assignedEngineId: string
  role: EngineRole
  availability: EngineAvailability
  targetPositionState: IEnginePositionState | null
  lastError: string | null
}

export interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: 'infinite'
}

export interface IEngineRegistrationRequest {
  name: string | null
  code: string | null
  registerLater: boolean
}

export interface IEngineSessionEvent {
  kind:
    | 'handshakeStarted'
    | 'handshakeCompleted'
    | 'ready'
    | 'copyProtectionChecking'
    | 'copyProtectionOk'
    | 'copyProtectionError'
    | 'registrationChecking'
    | 'registrationOk'
    | 'registrationError'
  detail: string | null
}

export const engineProtocolSchema = z.enum(['uci'])
export const engineRoleSchema = z.enum(['player', 'analysis'])
export const engineAvailabilitySchema = z.enum(['ready', 'starting', 'running', 'unavailable', 'failed'])
export const engineOptionValueSchema = z.union([z.string(), z.number(), z.boolean()])
export const engineOptionMapSchema = z.record(z.string(), engineOptionValueSchema)

export const engineRecordSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  executablePath: z.string(),
  protocol: engineProtocolSchema,
  options: engineOptionMapSchema,
})

export const assignedEngineSchema = z.object({
  assignedEngineId: z.string().min(1),
  sourceProfileId: z.string().min(1).nullable(),
  displayName: z.string().min(1),
  executablePath: z.string(),
  protocol: engineProtocolSchema,
  options: engineOptionMapSchema,
})

export const analysisAssignmentSchema = z.object({
  assignedEngines: z.array(assignedEngineSchema).max(4),
})

export const enginePositionStateSchema = z.object({
  rootPosition: boardPositionSchema,
  movesFromRoot: z.array(moveSchema),
  currentPosition: boardPositionSchema,
  requiresNewGameBoundary: z.boolean(),
})

export const engineRuntimeSessionSchema = z.object({
  sessionId: z.string().min(1),
  gameId: z.string().min(1),
  assignedEngineId: z.string().min(1),
  role: engineRoleSchema,
  availability: engineAvailabilitySchema,
  targetPositionState: enginePositionStateSchema.nullable(),
  lastError: z.string().nullable(),
})

export const engineAnalysisRequestSchema = z.object({
  multiPv: z.number().int().min(1),
  searchMode: z.literal('infinite'),
})

export const engineRegistrationRequestSchema = z.object({
  name: z.string().nullable(),
  code: z.string().nullable(),
  registerLater: z.boolean(),
})

export const engineSessionEventSchema = z.object({
  kind: z.enum([
    'handshakeStarted',
    'handshakeCompleted',
    'ready',
    'copyProtectionChecking',
    'copyProtectionOk',
    'copyProtectionError',
    'registrationChecking',
    'registrationOk',
    'registrationError',
  ]),
  detail: z.string().nullable(),
})

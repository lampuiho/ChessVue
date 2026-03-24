import { z } from 'zod'
import { boardPositionSchema, type IBoardPosition } from './ChessboardState'
import { moveSchema, type IMove } from './Move'

export const enum EngineProtocol {
  Uci = 'uci',
}

export const enum EngineRole {
  Player = 'player',
  Analysis = 'analysis',
}

export const enum EngineAvailability {
  Ready = 'ready',
  Starting = 'starting',
  Running = 'running',
  Unavailable = 'unavailable',
  Failed = 'failed',
}

export const enum EngineSearchMode {
  Infinite = 'infinite',
}

export const enum EngineSessionEventKind {
  HandshakeStarted = 'handshakeStarted',
  HandshakeCompleted = 'handshakeCompleted',
  Ready = 'ready',
  CopyProtectionChecking = 'copyProtectionChecking',
  CopyProtectionOk = 'copyProtectionOk',
  CopyProtectionError = 'copyProtectionError',
  RegistrationChecking = 'registrationChecking',
  RegistrationOk = 'registrationOk',
  RegistrationError = 'registrationError',
}
export const engineProtocols = [EngineProtocol.Uci] as const
export const engineRoles = [EngineRole.Player, EngineRole.Analysis] as const
export const engineAvailabilities = [EngineAvailability.Ready, EngineAvailability.Starting, EngineAvailability.Running, EngineAvailability.Unavailable, EngineAvailability.Failed] as const
export const engineSearchModes = [EngineSearchMode.Infinite] as const
export const engineSessionEventKinds = [
  EngineSessionEventKind.HandshakeStarted,
  EngineSessionEventKind.HandshakeCompleted,
  EngineSessionEventKind.Ready,
  EngineSessionEventKind.CopyProtectionChecking,
  EngineSessionEventKind.CopyProtectionOk,
  EngineSessionEventKind.CopyProtectionError,
  EngineSessionEventKind.RegistrationChecking,
  EngineSessionEventKind.RegistrationOk,
  EngineSessionEventKind.RegistrationError,
] as const

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
  searchMode: EngineSearchMode
}

export interface IEngineRegistrationRequest {
  name: string | null
  code: string | null
  registerLater: boolean
}

export interface IEngineSessionEvent {
  kind: EngineSessionEventKind
  detail: string | null
}

export const engineProtocolSchema = z.enum(engineProtocols)
export const engineRoleSchema = z.enum(engineRoles)
export const engineAvailabilitySchema = z.enum(engineAvailabilities)
export const engineSearchModeSchema = z.enum(engineSearchModes)
export const engineSessionEventKindSchema = z.enum(engineSessionEventKinds)
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
  searchMode: engineSearchModeSchema,
})

export const engineRegistrationRequestSchema = z.object({
  name: z.string().nullable(),
  code: z.string().nullable(),
  registerLater: z.boolean(),
})

export const engineSessionEventSchema = z.object({
  kind: engineSessionEventKindSchema,
  detail: z.string().nullable(),
})

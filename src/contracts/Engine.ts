import { z } from 'zod'
import type { IBoardPosition } from './ChessboardState'
import type { IMove } from './Move'
import type { IAnalysisLine } from './Analysis'
import type { DeepReadonly } from './Readonly'
import type { Deferred } from '@/utility/async/Deferred';
import type { IProcess } from './platform/IProcess';

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
export const enum EngineOptionType {
  Action = 'action',
  Boolean = 'boolean',
  Choice = 'choice',
  Integer = 'integer',
  Text = 'text',
}
export const engineProtocols = [EngineProtocol.Uci] as const
export const engineClientTypes = [EngineClientType.Uci] as const
export const engineAvailabilities = [EngineAvailability.Ready, EngineAvailability.Starting, EngineAvailability.Running, EngineAvailability.Unavailable, EngineAvailability.Failed] as const
export const engineAnalysisSearchModes = [EngineAnalysisSearchMode.Infinite] as const

export interface IEngineOptionMap {
  [optionName: string]: string | number | boolean
}
export interface IEngineOptionMeta {
  name: string;
  type: EngineOptionType;
  defaultValue?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  choices?: string[];
}
export interface IEngineRecord {
  id: string
  displayName: string
  executablePath: string
  clientType: EngineClientType
  protocol: EngineProtocol
  options: IEngineOptionMap
}
export interface IEngineAnalysisOperation {
  abortController: AbortController;
  completion: Deferred<void>;
  isFinal: boolean;
}
export interface IAssignedEngineRuntime {
  process?: IProcess;
  availability: EngineAvailability
  lastError?: string
  analysisCallback?: (update: IEngineAnalysisUpdate) => void
  analysisLines: Map<number, IAnalysisLine>
  analysisOperation?: IEngineAnalysisOperation;
  analysisWork?: Promise<void>;
  /** Settles when the current client call drains, even if its caller has been cancelled. */
  analysisClientWork?: Promise<void>;
  /** Issued physical shutdown shared by successive terminal requests. */
  analysisShutdownWork?: Promise<void>;
  analysisNeedsStop?: boolean;
}
export interface IAssignedEngine {
  displayName: string
  executablePath: string
  clientType: EngineClientType
  protocol: EngineProtocol
  options: IEngineOptionMap
  $?: IAssignedEngineRuntime
}
export interface IEngineAnalysisRequest {
  multiPv: number
  searchMode: EngineAnalysisSearchMode
}
export interface IEngineAnalysisUpdate {
  readonly position: DeepReadonly<IBoardPosition>
  readonly bestMove?: DeepReadonly<IMove>
  /** All retained lines in engine rank order; the rendered-line limit belongs to the game subscription. */
  readonly lines: readonly DeepReadonly<IAnalysisLine>[];
  readonly isFinal: boolean
}
export type EngineAnalysisUpdateHandler = (update: IEngineAnalysisUpdate) => boolean | void;
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

export const engineAnalysisRequestSchema = z.object({
  multiPv: z.number().int().min(1),
  searchMode: engineAnalysisSearchModeSchema,
})

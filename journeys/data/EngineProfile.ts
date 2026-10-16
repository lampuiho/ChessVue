import { EngineClientType, EngineProtocol, type IEngineRecord } from '@/contracts';

export function createEngineProfiles(): IEngineRecord[] {
  return ['A', 'B', 'unavailable'].map((name) => ({
    id: `journey-${name.toLowerCase()}`, displayName: `Journey ${name}`, executablePath: `journey://${name.toLowerCase()}`,
    clientType: EngineClientType.Uci, protocol: EngineProtocol.Uci, options: { MultiPV: 3, Hash: 16 },
  }));
}

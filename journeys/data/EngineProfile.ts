import { EngineClientType, type IEngineRecord } from '@/contracts';

export function createEngineProfiles(): IEngineRecord[] {
  return ['A', 'B', 'unavailable'].map((name) => ({
    id: `journey-${name.toLowerCase()}`, displayName: `Journey ${name}`, entryPath: `journey://${name.toLowerCase()}`,
    clientType: EngineClientType.Uci, options: { MultiPV: 3, Hash: 16 },
  }));
}

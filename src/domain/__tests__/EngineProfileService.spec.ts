import { describe, expect, it } from 'vitest';
import { EngineClientType, EngineProtocol, type IEngineRecord } from '@/contracts';
import { EngineProfileService } from '..';

describe('EngineProfileService', () => {
  it('copies a saved engine profile into an assigned engine snapshot', () => {
    const engineRecord: IEngineRecord = {
      id: 'engine-1',
      displayName: 'Stockfish',
      executablePath: 'stockfish.exe',
      clientType: EngineClientType.Uci,
      protocol: EngineProtocol.Uci,
      options: { Threads: 1 },
    };

    const assignedEngine = EngineProfileService.createAssignedEngine(engineRecord);
    engineRecord.options.Threads = 4;

    expect(assignedEngine).toEqual({
      displayName: 'Stockfish',
      executablePath: 'stockfish.exe',
      clientType: EngineClientType.Uci,
      protocol: EngineProtocol.Uci,
      options: { Threads: 1 },
    });
  });
});

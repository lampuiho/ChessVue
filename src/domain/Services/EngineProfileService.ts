import type { IAssignedEngine, IEngineRecord } from '@/contracts';

export const EngineProfileService = {
  createAssignedEngine(engineRecord: IEngineRecord): IAssignedEngine {
    return {
      displayName: engineRecord.displayName,
      executablePath: engineRecord.executablePath,
      clientType: engineRecord.clientType,
      protocol: engineRecord.protocol,
      options: structuredClone(engineRecord.options),
    };
  },
};

import type { ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

import type { ProcessHandle } from '../contracts';

export interface INwjsProcessRegistry {
  get(processHandle: ProcessHandle): ISpawnedProcess | undefined;
  set(processHandle: ProcessHandle, process: ISpawnedProcess): void;
  delete(processHandle: ProcessHandle): void;
}
export function createNwjsProcessRegistry(): INwjsProcessRegistry {
  const processByHandle = new Map<ProcessHandle, ISpawnedProcess>();
  return {
    get(processHandle: ProcessHandle): ISpawnedProcess | undefined {
      return processByHandle.get(processHandle);
    },
    set(processHandle: ProcessHandle, process: ISpawnedProcess): void {
      processByHandle.set(processHandle, process);
    },
    delete(processHandle: ProcessHandle): void {
      processByHandle.delete(processHandle);
    },
  };
}

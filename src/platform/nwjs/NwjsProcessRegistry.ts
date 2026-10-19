import type { ProcessHandle } from '@/contracts/platform';
import type { ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

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
    set(processHandle: ProcessHandle, process: ISpawnedProcess) {
      processByHandle.set(processHandle, process);
    },
    delete(processHandle: ProcessHandle) {
      processByHandle.delete(processHandle);
    },
  };
}

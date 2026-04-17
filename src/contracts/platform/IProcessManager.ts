import type { ProcessHandle } from '../Engine';

export interface IProcessManager {
  spawnProcess(executablePath: string, args?: string[]): Promise<ProcessHandle>;
  assertProcessHandleOpen(processHandle: ProcessHandle): void;
  stopProcess(processHandle: ProcessHandle): Promise<void>;
  restartProcess(processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle>;
}

import type { IProcess } from './IProcess';

export interface IProcessManager {
  spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>;
  assertProcessOpen(process: IProcess): void;
  stopProcess(process: IProcess): Promise<void>;
  restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess>;
}

import type { IProcess } from './IProcess';

export interface IProcessManager {
  spawnProcess(executablePath: string, args?: string[]): Promise<IProcess>;
  assertProcessOpen(process: IProcess): void;
  stopProcess(process: IProcess): Promise<void>;
  restartProcess(process: IProcess, executablePath: string, args?: string[]): Promise<IProcess>;
}

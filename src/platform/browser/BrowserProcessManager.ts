import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IProcessManager, ProcessHandle } from '@/contracts/platform';

export class BrowserProcessManager implements IProcessManager {
  async spawnProcess(_executablePath: string, _args?: string[]): Promise<ProcessHandle> {
    throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Local UCI engines require the desktop app.' });
  }
  assertProcessHandleOpen(_processHandle: ProcessHandle): never {
    throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'assertProcessHandleOpen', message: 'Local processes are unavailable in the browser.' });
  }
  async stopProcess(processHandle: ProcessHandle): Promise<void> {
    this.assertProcessHandleOpen(processHandle);
  }
  async restartProcess(_processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle> {
    return this.spawnProcess(executablePath, args);
  }
}

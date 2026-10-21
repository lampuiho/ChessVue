import { defineStore } from 'pinia';

import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import type { IProcessManager, ProcessHandle } from '@/contracts/platform';
import { getNodeChildProcess } from '@/utility/nwjs/NodeUtility';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';

interface IProcessSession {
  process: ISpawnedProcess;
}

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export function defineNwjsProcessManagerStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  return defineStore('nwjsProcessManager', () => {
    const childProcess = getNodeChildProcess();
    let nextHandleId = 1;
    const sessionByHandle = new Map<ProcessHandle, IProcessSession>();

    async function spawnProcess(executablePath: string, args: string[] = []): Promise<ProcessHandle> {
      const process = childProcess.spawn(executablePath, args, { stdio: 'pipe' }) as unknown as ISpawnedProcess;
      const handle = `process-${nextHandleId++}`;
      return new Promise<ProcessHandle>((resolve, reject) => {
        const _handleSpawn = () => {
          _cleanup();
          sessionByHandle.set(handle, { process });
          processRegistry.set(handle, process);
          process.once('exit', (_code: number | null, _signal: NodeJS.Signals | null) => {
            sessionByHandle.delete(handle);
            processRegistry.delete(handle);
          });
          resolve(handle);
        };
        const _handleError = (error: Error & { code?: string }) => {
          _cleanup();
          reject(_createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', `Process failed to start: ${executablePath}.`, error.message));
        };
        const _cleanup = () => {
          process.removeListener('spawn', _handleSpawn);
          process.removeListener('error', _handleError);
        };
        process.once('spawn', _handleSpawn);
        process.once('error', _handleError);
      });
    }
    function assertProcessHandleOpen(processHandle: ProcessHandle) {
      _getSession(processHandle);
    }
    async function stopProcess(processHandle: ProcessHandle) {
      const session = _getSession(processHandle);
      await new Promise<void>((resolve) => {
        session.process.once('exit', () => resolve());
        session.process.kill();
      });
      sessionByHandle.delete(processHandle);
      processRegistry.delete(processHandle);
    }
    async function restartProcess(processHandle: ProcessHandle, executablePath: string, args: string[] = []): Promise<ProcessHandle> {
      await stopProcess(processHandle);
      return spawnProcess(executablePath, args);
    }
    function _getSession(processHandle: ProcessHandle): IProcessSession {
      const session = sessionByHandle.get(processHandle);
      if (session === undefined) throw _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'process', `Process handle is no longer valid: ${processHandle}.`);
      return session;
    }

    const processManager = { spawnProcess, assertProcessHandleOpen, stopProcess, restartProcess } satisfies IProcessManager;
    return processManager;
  });
}

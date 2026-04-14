import { defineStore } from 'pinia';

import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import { getNodeChildProcess } from '@/utility/nwjs/NodeUtility';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

import type { IProcessManager, ProcessHandle } from '../contracts';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';

interface IProcessSession {
  process: ISpawnedProcess;
  exitSubscribers: Map<string, (error: IPlatformError) => void>;
  isStopping: boolean;
}

function createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail: string | null = null): IPlatformError {
  return { kind, operation, message, detail };
}
export function defineNwjsProcessManagerStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  return defineStore('nwjsProcessManager', () => {
    const childProcess = getNodeChildProcess();
    let nextHandleId = 1;
    let nextSubscriptionId = 1;
    const sessionByHandle = new Map<ProcessHandle, IProcessSession>();

    async function spawnProcess(executablePath: string, args: string[] = []): Promise<ProcessHandle> {
      const process = childProcess.spawn(executablePath, args, { stdio: 'pipe' }) as unknown as ISpawnedProcess;
      const handle = `process-${nextHandleId++}`;
      return new Promise<ProcessHandle>((resolve, reject) => {
        const handleSpawn = () => {
          cleanup();
          sessionByHandle.set(handle, { process, exitSubscribers: new Map(), isStopping: false });
          processRegistry.set(handle, process);
          process.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            const session = sessionByHandle.get(handle);
            if (session === undefined) return;
            sessionByHandle.delete(handle);
            processRegistry.delete(handle);
            if (session.isStopping) return;
            const error = createPlatformError(PlatformErrorKind.UnexpectedExit, 'spawnProcess', `Process exited unexpectedly: ${executablePath}.`, `code=${code ?? 'null'} signal=${signal ?? 'null'}`);
            for (const subscriber of session.exitSubscribers.values()) subscriber(error);
          });
          resolve(handle);
        };
        const handleError = (error: Error & { code?: string }) => {
          cleanup();
          reject(createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', `Process failed to start: ${executablePath}.`, error.message));
        };
        const cleanup = () => {
          process.removeListener('spawn', handleSpawn);
          process.removeListener('error', handleError);
        };
        process.once('spawn', handleSpawn);
        process.once('error', handleError);
      });
    }
    function subscribeToUnexpectedExit(processHandle: ProcessHandle, onUnexpectedExit: (error: IPlatformError) => void): () => void {
      const session = _getSession(processHandle);
      const subscriptionId = `unexpected-exit-${nextSubscriptionId++}`;
      session.exitSubscribers.set(subscriptionId, onUnexpectedExit);
      return () => {
        session.exitSubscribers.delete(subscriptionId);
      };
    }
    async function stopProcess(processHandle: ProcessHandle): Promise<void> {
      const session = _getSession(processHandle);
      session.isStopping = true;
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
      if (session === undefined) throw createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'process', `Process handle is no longer valid: ${processHandle}.`);
      return session;
    }

    const processManager = { spawnProcess, subscribeToUnexpectedExit, stopProcess, restartProcess } satisfies IProcessManager;
    return processManager;
  });
}

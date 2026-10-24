import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import type { IProcess, IProcessManager } from '@/contracts/platform';
import { getNodeChildProcess } from '@/utility/nwjs/NodeUtility';
import { isProcessOpen, type INwjsGlobal, type ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export function defineNwjsProcessManagerStore(_nw: INwjsGlobal) {
  return defineStore('nwjsProcessManager', () => {
    const childProcess = getNodeChildProcess();
    async function spawnProcess(executablePath: string, args: string[] = []) {
      const process = childProcess.spawn(executablePath, args, { stdio: 'pipe' });
      return new Promise<ISpawnedProcess>((resolve, reject) => {
        const _handleSpawn = () => {
          process.stdout.setEncoding('utf8');
          process.stderr.setEncoding('utf8');
          _cleanup();
          resolve(markRaw(process));
        };
        const _handleError = (error: Error) => {
          _cleanup();
          reject(_createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', 'Process failed to start: ' + executablePath + '.', error.message));
        };
        const _cleanup = () => {
          process.removeListener('spawn', _handleSpawn);
          process.removeListener('error', _handleError);
        };
        process.once('spawn', _handleSpawn);
        process.once('error', _handleError);
      });
    }
    function assertProcessOpen(process: IProcess) {
      if (!isProcessOpen(process as ISpawnedProcess)) throw _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'process', 'Engine process is no longer running.');
    }
    async function stopProcess(process: IProcess) {
      assertProcessOpen(process);
      await new Promise<void>((resolve) => {
        process.once('exit', () => resolve());
        process.kill();
      });
    }
    async function restartProcess(process: IProcess, executablePath: string, args: string[] = []) {
      await stopProcess(process);
      return spawnProcess(executablePath, args);
    }
    return { spawnProcess, assertProcessOpen, stopProcess, restartProcess } satisfies IProcessManager;
  });
}

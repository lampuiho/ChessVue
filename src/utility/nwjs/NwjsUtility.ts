import { PlatformTarget } from '@/contracts/platform/PlatformTarget';
import { PlatformErrorKind, type IPlatformError } from '@/contracts/PlatformError';
import { getMockNwjs } from './NwjsMockUtility';
import type { INwjsGlobal, ISpawnedProcess } from './models';

export { PlatformTarget };
export type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from './models';

let _nwOverride: INwjsGlobal | null = null;
export function getPlatformTarget(): PlatformTarget {
  if (__CHESSVUE_PLATFORM__ !== 'auto') return __CHESSVUE_PLATFORM__;
  const nw = _nwOverride ?? (globalThis as typeof globalThis & { nw?: INwjsGlobal }).nw;
  return nw?.Window ? PlatformTarget.Nwjs : PlatformTarget.Browser;
}
export function setNwjsOverride(nw: INwjsGlobal | null) {
  _nwOverride = nw;
}
export function getNwjs(): INwjsGlobal {
  const platform = getPlatformTarget();
  if (platform !== PlatformTarget.Nwjs) throw new Error(`Unsupported platform target: ${platform}.`);
  if (_nwOverride !== null) return _nwOverride;
  const nw = (globalThis as typeof globalThis & { nw?: INwjsGlobal }).nw;
  return nw ?? getMockNwjs();
}
export function isProcessOpen(process: ISpawnedProcess): boolean {
  return process.exitCode === null && process.signalCode === null;
}
export function attachProcessLineListeners(process: ISpawnedProcess, onLine: (line: string) => void, onExit: (code: number | null, signal: NodeJS.Signals | null) => void): () => void {
  let lineBuffer = '';
  const _onData = (chunk: string) => {
    lineBuffer += chunk;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 0) onLine(trimmedLine);
    }
  };
  process.stdout?.on('data', _onData);
  process.stderr?.on('data', _onData);
  process.once('exit', onExit);
  return () => {
    process.stdout?.removeListener('data', _onData);
    process.stderr?.removeListener('data', _onData);
    process.removeListener('exit', onExit);
  };
}
export async function writeProcessLine(process: ISpawnedProcess, command: string) {
  if (!isProcessOpen(process)) throw _createProcessError(PlatformErrorKind.InvalidProcessHandle, 'Engine process is no longer running.');
  if (!process.stdin) throw _createProcessError(PlatformErrorKind.ProcessStartFailed, `Engine stdin is unavailable for process ${process.pid}.`);
  process.stdin.write(`${command}\n`);
}
function _createProcessError(kind: PlatformErrorKind, message: string): IPlatformError {
  return { kind, operation: 'engineClient', message };
}

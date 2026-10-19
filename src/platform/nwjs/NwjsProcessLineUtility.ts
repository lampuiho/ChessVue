import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import type { ProcessHandle } from '@/contracts/platform';
import type { ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export function attachProcessLineListeners(process: ISpawnedProcess, onLine: (line: string) => void, onExit: (code: number | null, signal: NodeJS.Signals | null) => void): () => void {
  let lineBuffer = '';
  const onData = (chunk: string | Buffer) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 0) onLine(trimmedLine);
    }
  };
  process.stdout?.on('data', onData);
  process.stderr?.on('data', onData);
  process.once('exit', onExit);
  return () => {
    process.stdout?.removeListener('data', onData);
    process.stderr?.removeListener('data', onData);
    process.removeListener('exit', onExit);
  };
}
export async function writeProcessLine(process: ISpawnedProcess, processHandle: ProcessHandle, command: string) {
  if (!process.stdin) throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine stdin is unavailable for process ${processHandle}.`);
  process.stdin.write(`${command}\n`);
}

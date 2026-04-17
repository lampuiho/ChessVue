import { describe, expect, it } from 'vitest';

import { registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('NwjsProcessManager', () => {
  it('isolates unexpected process exits per session', async () => {
    const manager = getPlatformService().getProcessManager();
    const firstHandle = await manager.spawnProcess('stockfish.exe');
    const firstProcess = getEnvironment().latestProcess();
    const secondHandle = await manager.spawnProcess('stockfish.exe');
    const secondProcess = getEnvironment().latestProcess();

    firstProcess.emit('exit', 1, null);
    expect(() => manager.assertProcessHandleOpen(firstHandle)).toThrowError(/Process handle is no longer valid/);
    expect(() => manager.assertProcessHandleOpen(secondHandle)).not.toThrow();
    secondProcess.emit('exit', 0, null);
  });
});

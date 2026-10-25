import path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NwjsProcessManager } from '../nwjs/NwjsProcessManager';
import { EngineClientType } from '@/contracts/Engine';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';

afterEach(() => { setNodeModuleOverrides(); vi.unstubAllGlobals(); });
describe('NW.js Worker paths', () => {
  it('uses Node file URLs for actual native paths, preserving spaces, percent and hash characters', async () => {
    setNodeModuleOverrides({ path, url, fs, childProcess: { spawn: vi.fn() } });
    const create = vi.fn(function () { return Object.assign(new EventTarget(), { terminate: vi.fn(), postMessage: vi.fn() }); });
    vi.stubGlobal('Worker', create);
    const manager = new NwjsProcessManager(EngineClientType.UciWorker);
    const entry = path.resolve('external engines/entry % #.js');
    const process = await manager.spawnProcess(entry);
    expect(create).toHaveBeenCalledWith(new URL(url.pathToFileURL(entry).href), expect.any(Object));
    await manager.stopProcess(process);
    await manager.stopProcess(process);
    await manager.dispose();
  });
});

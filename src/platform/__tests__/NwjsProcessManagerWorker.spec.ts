import path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NwjsProcessManager } from '../nwjs/NwjsProcessManager';
import { EngineClientType } from '@/contracts/Engine';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';

afterEach(() => { setNodeModuleOverrides(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('NW.js Worker paths', () => {
  it('loads native file URLs through a Blob bootstrap preserving spaces, percent and hash characters', async () => {
    setNodeModuleOverrides({ path, url, fs, childProcess: { spawn: vi.fn() } });
    let source!: NodeBlob;
    const revoke = vi.fn();
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL(blob: Blob | MediaSource) { source = blob as unknown as NodeBlob; return 'blob:test/bootstrap'; }
      static revokeObjectURL = revoke;
    });
    const create = vi.fn();
    vi.stubGlobal('Worker', class extends EventTarget {
      postMessage = vi.fn();
      constructor(entry: string | URL, options?: WorkerOptions) { super(); create(entry, options); }
      terminate() {}
    });
    const manager = new NwjsProcessManager(EngineClientType.UciWorker);
    const entry = path.resolve('external engines/entry % #.js');
    const process = await manager.spawnProcess(entry);
    expect(create).toHaveBeenCalledWith('blob:test/bootstrap', expect.any(Object));
    expect(await source.text()).toContain(JSON.stringify(url.pathToFileURL(entry).href));
    await manager.stopProcess(process);
    await manager.stopProcess(process);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test/bootstrap');
    await manager.dispose();
  });
});

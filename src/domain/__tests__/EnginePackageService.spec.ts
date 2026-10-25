import { afterEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import { EngineClientType } from '@/contracts/Engine';
import { EnginePackageService } from '../EnginePackageService';
import { WorkerScriptLoader } from '@/utility/WorkerScriptLoader';

vi.mock('@/utility/nwjs/NwjsUtility', () => ({ getPlatformTarget: () => 'browser', PlatformTarget: { Browser: 'browser' } }));
afterEach(() => { vi.restoreAllMocks(); });
describe('engine package policy', () => {
  it('preserves archive paths and bytes and rejects traversal and conflicting files before storage', async () => {
    const bytes = new Uint8Array([0, 128, 255]);
    const archive = await EnginePackageService.readArchive({ path: 'vendor.zip', data: zipSync({ 'vendor/build/entry.js': bytes, 'vendor/build/data.wasm': bytes }) });
    expect(archive.files).toEqual([{ path: 'vendor/build/entry.js', data: bytes }, { path: 'vendor/build/data.wasm', data: bytes }]);
    await expect(EnginePackageService.readArchive({ path: 'unsafe.zip', data: zipSync({ '../escape.js': bytes }) })).rejects.toMatchObject({ operation: 'readEngineArchive' });
    const write = vi.spyOn(WorkerScriptLoader.prototype, 'writeFiles').mockResolvedValue(undefined);
    await expect(EnginePackageService.install('Test', { files: [{ path: 'folder', data: bytes }, { path: 'folder/entry.js', data: bytes }] })).rejects.toMatchObject({ operation: 'validateEnginePackageFiles' });
    expect(write).not.toHaveBeenCalled();
  });
  it('keeps a folder warning separate from a failed root enumeration', async () => {
    const roots = vi.spyOn(WorkerScriptLoader.prototype, 'listRoots').mockResolvedValue(['engine-files/A', 'engine-files/B']);
    vi.spyOn(WorkerScriptLoader.prototype, 'listFiles').mockImplementation(async root => { if (root.endsWith('/B')) throw new Error('Cannot read B.'); return ['original.js']; });
    expect(await EnginePackageService.listPackages()).toEqual([
      expect.objectContaining({ source: 'bundled' }),
      { packagePath: 'engine-files/A', displayName: 'A', source: 'user', files: ['original.js'] },
      { packagePath: 'engine-files/B', displayName: 'B', source: 'user', files: [], warning: 'Cannot read B.' },
    ]);
    roots.mockRejectedValue(new Error('Enumeration failed.'));
    await expect(EnginePackageService.listPackages()).rejects.toMatchObject({ operation: 'listEnginePackages', message: 'Enumeration failed.' });
  });
  it('blocks supplied profile/game references at folder boundaries without tracking temporary processes', async () => {
    const remove = vi.spyOn(WorkerScriptLoader.prototype, 'removeFiles').mockResolvedValue(undefined);
    const reference = { clientType: EngineClientType.UciWorker, entryPath: 'engine-files/A/main.js', displayName: 'Open game' };
    await expect(EnginePackageService.remove('engine-files/A', [reference])).rejects.toMatchObject({ operation: 'removeEnginePackage', message: expect.stringContaining('Open game') });
    await EnginePackageService.remove('engine-files/A', [{ ...reference, entryPath: 'engine-files/AA/main.js' }]);
    expect(remove).toHaveBeenCalledOnce();
    await expect(EnginePackageService.remove('engines/stockfish', [])).rejects.toMatchObject({ operation: 'removeEnginePackage' });
    expect(remove).toHaveBeenCalledOnce();
  });
});

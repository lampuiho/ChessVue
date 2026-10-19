import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { PlatformErrorKind } from '@/contracts';
import { BrowserFileSystem } from '@/platform/browser/BrowserFileSystem';
import { defineBrowserStorageAdapterStore } from '@/platform/browser/BrowserStorageAdapter';
import { JourneyStorageBarrier } from '../../runtime/storage/JourneyStorageBarrier';
import { createJourney } from '../../index';
import { SerializationService } from '@/domain/SerializationService';

const key = 'storage-barrier-test';
let barrier: JourneyStorageBarrier;
let files: BrowserFileSystem;
let adapter: ReturnType<ReturnType<typeof defineBrowserStorageAdapterStore>>;
beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
  files = new BrowserFileSystem(sessionStorage, key);
  files.writeTextFile('saves/a/Opening.json', 'original', { ensureParentDirectory: true });
  adapter = defineBrowserStorageAdapterStore(sessionStorage, key)();
  barrier = new JourneyStorageBarrier();
  barrier.install(adapter);
});
afterEach(() => barrier.reset());
describe('journey storage faults and barriers', () => {
  it.each(['readTextFile', 'listDirectory', 'writeTextFile', 'deleteFile'] as const)('fails only the next exact %s path and retries without modifying prior bytes', async (operation) => {
    const path = operation === 'listDirectory' ? 'saves/a' : 'saves/a/Opening.json';
    const act = () => operation === 'writeTextFile' ? adapter.writeTextFile(path, 'replacement', { overwrite: true }) : adapter[operation](path);
    barrier.failNext(operation, path);
    expect(await adapter.readTextFile('saves/a/./Opening.json').catch((error: unknown) => error)).toEqual(operation === 'readTextFile' ? expect.objectContaining({ kind: PlatformErrorKind.PermissionDenied }) : 'original');
    if (operation !== 'readTextFile') await expect(act()).rejects.toMatchObject({ kind: PlatformErrorKind.PermissionDenied, operation });
    expect(files.readFile('saves/a/Opening.json')).toBe('original');
    await act();
    expect(barrier.operations().at(-1)?.state).toBe('succeeded');
  });
  it('keeps other paths and operations usable and consumes only the requested failure count', async () => {
    barrier.failNext('writeTextFile', 'saves/a/Opening.json', 2);
    await adapter.writeTextFile('saves/a/Other.json', 'other');
    expect(await adapter.readTextFile('saves/a/Opening.json')).toBe('original');
    for (let index = 0; index < 2; index++) await expect(adapter.writeTextFile('saves/a/Opening.json', 'new', { overwrite: true })).rejects.toMatchObject({ kind: PlatformErrorKind.PermissionDenied });
    await adapter.writeTextFile('saves/a/Opening.json', 'new', { overwrite: true });
    expect(files.readFile('saves/a/Other.json')).toBe('other');
    expect(files.readFile('saves/a/Opening.json')).toBe('new');
    expect(() => barrier.failNext('writeTextFile', 'x', 0)).toThrow('positive');
  });
  it('delivers a captured old read only on release while another path remains usable', async () => {
    const id = barrier.holdNext('readTextFile', 'saves/a/Opening.json');
    const read = adapter.readTextFile('saves/a/Opening.json');
    await adapter.writeTextFile('saves/a/Opening.json', 'new', { overwrite: true });
    expect(await adapter.listDirectory('saves/a')).toHaveLength(1);
    expect(barrier.operations().find((call) => call.id === id)?.state).toBe('held');
    barrier.release(id);
    expect(await read).toBe('original');
    expect(await adapter.readTextFile('saves/a/Opening.json')).toBe('new');
  });
  it.each(['writeTextFile', 'deleteFile'] as const)('cancels held %s on reset without late mutation and clears unused faults', async (operation) => {
    const id = barrier.holdNext(operation, 'saves/a/Opening.json');
    const pending = operation === 'writeTextFile' ? adapter.writeTextFile('saves/a/Opening.json', 'new', { overwrite: true }) : adapter.deleteFile('saves/a/Opening.json');
    const rejected = expect(pending).rejects.toMatchObject({ kind: PlatformErrorKind.Cancelled });
    barrier.failNext('readTextFile', 'saves/a/Opening.json');
    barrier.reset();
    barrier.release(id);
    await rejected;
    expect(await adapter.readTextFile('saves/a/Opening.json')).toBe('original');
    expect(barrier.operations()).toHaveLength(1);
  });
  it('builds independent canonical seeds and limits startup faults to the named variant', () => {
    const first = createJourney('storage-failures');
    const original = JSON.stringify(first);
    for (const file of first.files.filter((file) => file.path.startsWith('saves/'))) expect(SerializationService.deserialiseGame(file.raw).metadata.id).toMatch(/^io-/);
    first.files[0]!.raw = 'changed';
    expect(JSON.stringify(createJourney('storage-failures'))).toBe(original);
    expect(createJourney('storage-failures').storageFaults).toBeUndefined();
    expect(createJourney('storage-failures', 1, 'startup-session').storageFaults).toEqual([{ operation: 'writeTextFile', path: 'game-session.json' }]);
  });
});

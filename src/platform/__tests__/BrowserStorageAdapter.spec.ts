import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserFileSystem } from '../browser/BrowserFileSystem';
import { defineBrowserStorageAdapterStore } from '../browser/BrowserStorageAdapter';

let pinia: Pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
});
afterEach(() => {
  disposePinia(pinia);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function createStorage() {
  return defineBrowserStorageAdapterStore(localStorage, 'browser-test')();
}
describe('browser persistence', () => {
  it('retains canonical paths and dates across adapter instances without stale writes', async () => {
    const storage = createStorage();
    await storage.writeTextFile('saves\\game/auto.json', 'first', { ensureParentDirectory: true });
    const firstDate = (await storage.listDirectory('saves/game'))[0]!.lastModifiedUtc!;
    const other = new BrowserFileSystem(localStorage, 'browser-test');
    other.writeTextFile('settings.json', 'settings');
    await storage.writeTextFile('saves/game/auto.json', 'updated', { overwrite: true });
    expect(other.readTextFile('saves/game/auto.json')).toBe('updated');
    expect(await storage.readTextFile('settings.json')).toBe('settings');
    expect((await storage.listDirectory('saves'))[0]).toMatchObject({ name: 'game', isDirectory: true, path: 'saves/game' });
    expect((await storage.listDirectory('saves/game'))[0]!.lastModifiedUtc!.getTime()).toBeGreaterThan(firstDate.getTime());
  });
  it('enforces parents, overwrite, directories and deletion', async () => {
    const storage = createStorage();
    await expect(storage.writeTextFile('missing/file.json', '')).rejects.toMatchObject({ kind: 'notFound' });
    await storage.ensureDirectory('saves/game');
    await storage.writeTextFile('saves/game/test.json', '{}');
    await expect(storage.writeTextFile('saves/game/test.json', 'replacement')).rejects.toMatchObject({ kind: 'alreadyExists' });
    await expect(storage.ensureDirectory('saves/game/test.json/child')).rejects.toMatchObject({ kind: 'invalidOperation' });
    await expect(storage.writeTextFile('saves/game', '{}')).rejects.toMatchObject({ kind: 'invalidOperation' });
    await storage.deleteFile('saves/game/test.json');
    await expect(storage.readTextFile('saves/game/test.json')).rejects.toMatchObject({ kind: 'notFound' });
    await expect(storage.deleteFile('saves/game/test.json')).rejects.toMatchObject({ kind: 'notFound' });
  });
  it('maps corruption and storage failure without claiming the write succeeded', async () => {
    const storage = createStorage();
    localStorage.setItem('browser-test', '{ invalid');
    await expect(storage.readTextFile('settings.json')).rejects.toMatchObject({ kind: 'invalidDocument' });
    localStorage.removeItem('browser-test');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(storage.writeTextFile('settings.json', '{}')).rejects.toMatchObject({ kind: 'permissionDenied' });
    expect(await storage.listDirectory('.')).toEqual([]);
  });
  it('imports a real browser File without adding it to managed storage', async () => {
    const storage = createStorage();
    const pending = storage.showOpenDialog();
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File(['{"schemaVersion":1}'], 'game.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change'));
    const path = await pending;
    expect(await storage.readTextFile(path)).toBe('{"schemaVersion":1}');
    expect(await storage.listDirectory('.')).toEqual([]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  it('rejects cancelled and invalid UTF-8 imports and removes the picker', async () => {
    const storage = createStorage();
    const cancelled = storage.showOpenDialog();
    document.querySelector('input')!.dispatchEvent(new Event('cancel'));
    await expect(cancelled).rejects.toMatchObject({ kind: 'cancelled' });
    const invalid = storage.showOpenDialog();
    const input = document.querySelector<HTMLInputElement>('input')!;
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([0xff])], 'bad.json')] });
    input.dispatchEvent(new Event('change'));
    await expect(invalid).rejects.toMatchObject({ kind: 'invalidDocument' });
    expect(document.querySelector('input')).toBeNull();
  });
  it('downloads external exports without treating them as managed saves', async () => {
    const storage = createStorage();
    const createUrl = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = vi.fn();
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Game.json');
      expect(this.href).toBe('blob:test');
    });
    const path = await storage.showSaveDialog('saves/Game.json');
    await storage.writeTextFile(path, '{"schemaVersion":1}');
    expect(click).toHaveBeenCalledOnce();
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(await storage.listDirectory('.')).toEqual([]);
    expect(document.querySelector('a')).toBeNull();
    vi.unstubAllGlobals();
  });
});

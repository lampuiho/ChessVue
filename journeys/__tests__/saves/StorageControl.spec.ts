import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserFileSystem } from '@/platform/browser/BrowserFileSystem';
import { changeManagedFile } from '../../JourneyStorageControl';
beforeEach(() => sessionStorage.clear());
describe('managed save fault control', () => {
  it('changes only an existing managed file and makes deletion visible to a fresh reader', () => {
    const files = new BrowserFileSystem(sessionStorage, 'save-fault');
    files.writeTextFile('saves/game/auto.json', 'original', { ensureParentDirectory: true });
    files.writeTextFile('settings.json', 'settings');
    const before = sessionStorage.getItem('save-fault');
    for (const path of ['settings.json', '../saves/game/auto.json', 'saves/game/new.json']) {
      expect(() => changeManagedFile(files, path, null)).toThrow('existing managed save');
    }
    expect(sessionStorage.getItem('save-fault')).toBe(before);
    changeManagedFile(files, 'saves/game/auto.json', '{broken');
    expect(new BrowserFileSystem(sessionStorage, 'save-fault').readFile('saves/game/auto.json')).toBe('{broken');
    changeManagedFile(files, 'saves/game/auto.json', null);
    expect(new BrowserFileSystem(sessionStorage, 'save-fault').listFiles()).toEqual(['settings.json']);
  });
});

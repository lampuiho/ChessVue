import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { WorkerScriptLoader } from '../WorkerScriptLoader';

const _base = new URL('https://example.test/app/');
const _config = { databaseName: 'generic-test', storeName: 'assets', rootPath: 'stored-files' };
let loader: WorkerScriptLoader;
let blobs: NodeBlob[];
let failConstruction: boolean;
const _terminated = vi.fn();
const _revoked = vi.fn();
beforeEach(() => {
  loader = new WorkerScriptLoader(_config);
  blobs = [];
  failConstruction = false;
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL(blob: Blob | MediaSource) { blobs.push(blob as unknown as NodeBlob); return 'blob:test/' + blobs.length; }
    static revokeObjectURL = _revoked;
  });
  vi.stubGlobal('Worker', class extends EventTarget {
    constructor(readonly url: string | URL, readonly options?: WorkerOptions) { super(); if (failConstruction) throw new Error('Worker denied.'); }
    terminate() { _terminated(this); }
  });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe('WorkerScriptLoader', () => {
  it('preserves literal special characters and nested app bases without encoding ordinary URLs', () => {
    const url = loader.resolveUrl('stored-files/Scripts % # \u68cb/nested/main.js', _base);
    expect(url.href).toBe('https://example.test/app/stored-files/Scripts%20%25%20%23%20%E6%A3%8B/nested/main.js');
    expect(loader.isStoredUrl(url, _base)).toBe(true);
    expect(loader.isStoredUrl(new URL('https://other.test/app/stored-files/a/b.js'), _base)).toBe(false);
    expect(loader.isStoredUrl(new URL('https://example.test/stored-files/a/b.js'), _base)).toBe(false);
    expect(loader.resolveUrl('ordinary/main.js?build=1', _base).href).toBe('https://example.test/app/ordinary/main.js?build=1');
    for (const path of ['stored-files/a/../main.js', 'stored-files/a/./main.js', 'stored-files/a//main.js', 'stored-files/a/\\main.js']) expect(() => loader.resolveUrl(path, _base)).toThrow('Invalid stored file path');
  });
  it('starts ordinary app Workers directly without storage or Blob resources', async () => {
    const entry = new URL('engines/main.js', _base);
    const worker = await loader.createWorker(entry, _base, undefined, { name: 'Example' });
    expect(worker).toMatchObject({ url: entry, options: { name: 'Example' } });
    expect(blobs).toEqual([]);
    worker.terminate();
    expect(_terminated).toHaveBeenCalledWith(worker);
    expect(_revoked).not.toHaveBeenCalled();
  });
  it('makes each file Worker own its bootstrap URL until normal termination', async () => {
    const entry = new URL('file:///external%20engines/main%20%25%20%23.js');
    const first = await loader.createWorker(entry, _base);
    const second = await loader.createWorker(entry, _base);
    expect(first).toBeInstanceOf(Worker);
    expect(await blobs[0]!.text()).toContain(JSON.stringify(entry.href));
    expect(blobs[0]!.type).toBe('text/javascript');
    first.terminate();
    first.terminate();
    expect(_revoked.mock.calls).toEqual([['blob:test/1']]);
    expect(_terminated).not.toHaveBeenCalledWith(second);
    second.terminate();
    expect(_revoked.mock.calls).toEqual([['blob:test/1'], ['blob:test/2']]);
  });
  it('releases allocated URLs when Worker construction fails', async () => {
    failConstruction = true;
    await expect(loader.createWorker(new URL('file:///main.js'), _base)).rejects.toThrow('Worker denied');
    expect(_revoked.mock.calls).toEqual([['blob:test/1']]);
  });
  it('creates no resources for an already-cancelled launch', async () => {
    const owner = new AbortController();
    owner.abort(new Error('Disposed.'));
    await expect(loader.createWorker(new URL('file:///main.js'), _base, owner.signal)).rejects.toThrow('Disposed');
    expect(blobs).toEqual([]);
  });
});

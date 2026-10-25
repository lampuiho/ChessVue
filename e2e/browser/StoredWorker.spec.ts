import { expect, test } from '@playwright/test';

test('runs a non-UCI Worker with original sibling scripts and binary assets using only the generic library', async ({ page }) => {
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utility/StoredWorkerUtility.ts';
    const { StoredWorkerUtility } = await import(modulePath);
    const library = new StoredWorkerUtility({ databaseName: 'generic-worker-assets', storeName: 'assets', rootPath: 'stored-files', serviceWorkerPath: 'engine-package-service-worker.js' });
    const base = new URL('./', document.baseURI);
    const root = 'stored-files/Calculator % # \u68cb';
    const encode = (value: string) => new TextEncoder().encode(value);
    await library.writeFiles(root, [
      { path: 'nested/main.js', data: encode("importScripts('./math.js');onmessage=async e=>{const bytes=new Uint8Array(await (await fetch('./weights.bin')).arrayBuffer());postMessage(add(e.data,bytes[0]));};") },
      { path: 'nested/math.js', data: encode('function add(a,b){return a+b;}') },
      { path: 'nested/weights.bin', data: new Uint8Array([7, 128, 255]) },
    ]);
    await library.register(base);
    const worker = new Worker(library.resolveUrl(root + '/nested/main.js', base));
    const answer = await new Promise<number>((resolve, reject) => {
      worker.onmessage = event => resolve(event.data);
      worker.onerror = event => reject(new Error(event.message));
      worker.postMessage(35);
    });
    worker.terminate();
    const raw = await fetch(library.resolveUrl(root + '/nested/weights.bin', base));
    const bytes = Array.from(new Uint8Array(await raw.arrayBuffer()));
    const script = await fetch(library.resolveUrl(root + '/nested/math.js', base));
    const malformed = await fetch(new URL('stored-files/Calculator%2Fescape/main.js', base));
    const method = await fetch(library.resolveUrl(root + '/nested/main.js', base), { method: 'POST' });
    await library.removeFiles(root);
    const missing = await fetch(library.resolveUrl(root + '/nested/main.js', base));
    const roots = await library.listRoots();
    await library.dispose();
    return { answer, bytes, mime: script.headers.get('content-type'), cache: script.headers.get('cache-control'), malformed: malformed.status, method: method.status, missing: missing.status, roots };
  });
  expect(result).toEqual({ answer: 42, bytes: [7, 128, 255], mime: 'text/javascript', cache: 'no-store', malformed: 400, method: 405, missing: 404, roots: [] });
});
test('uses configurable storage, rolls back failed and cancelled writes, and reports storage failures without HTML', async ({ page }) => {
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utility/StoredWorkerUtility.ts';
    const { StoredWorkerUtility } = await import(modulePath);
    const library = new StoredWorkerUtility({ databaseName: 'plain-script-test', storeName: 'assets', rootPath: 'stored-files', serviceWorkerPath: 'plain-files.js' });
    const base = new URL('https://example.test/nested/');
    const root = 'stored-files/example';
    const files = [{ path: 'first.js', data: new Uint8Array([1]) }, { path: 'second.wasm', data: new Uint8Array([0, 97, 115, 109]) }];
    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (++writes === 2) throw new DOMException('Disk full.', 'QuotaExceededError');
      return put.apply(this, args);
    };
    let failure = '';
    try { await library.writeFiles(root, files); } catch (error) { failure = (error as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    const rolledBack = await library.listRoots();
    const owner = new AbortController();
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args);
      owner.abort(new Error('Import cancelled.'));
      return request;
    };
    let cancelled = '';
    try { await library.writeFiles(root, files, owner.signal); } catch (error) { cancelled = (error as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    const cancelledRoots = await library.listRoots();
    await library.writeFiles(root, files);
    const stored = await library.listFiles(root);
    const wasm = await library.respond(new Request(library.resolveUrl(root + '/second.wasm', base)), base);
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => { throw new DOMException('Storage denied.', 'SecurityError'); };
    let unavailable: Response;
    try { unavailable = await library.respond(new Request(library.resolveUrl(root + '/first.js', base)), base); }
    finally { indexedDB.open = open; }
    await library.removeFiles(root);
    return { failure, rolledBack, cancelled, cancelledRoots, stored, mime: wasm.headers.get('content-type'), bytes: Array.from(new Uint8Array(await wasm.arrayBuffer())), status: unavailable.status, body: await unavailable.text() };
  });
  expect(result.failure).toBe('Disk full.');
  expect(result.rolledBack).toEqual([]);
  expect(result.cancelled).toBe('Import cancelled.');
  expect(result.cancelledRoots).toEqual([]);
  expect(result.stored).toEqual(['first.js', 'second.wasm']);
  expect(result.mime).toBe('application/wasm');
  expect(result.bytes).toEqual([0, 97, 115, 109]);
  expect(result.status).toBe(500);
  expect(result.body).toBe('File storage failed.');
});

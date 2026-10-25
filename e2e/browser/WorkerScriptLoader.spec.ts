import { expect, test } from '@playwright/test';

test('creates a self-contained Worker from local storage with scripts, fetch, Request and XHR assets', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/stored-files/')) requests.push(request.url()); });
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'serviceWorker', { get() { throw new Error('Service workers are unavailable.'); } });
  });
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utility/WorkerScriptLoader.ts';
    const { WorkerScriptLoader } = await import(modulePath);
    const loader = new WorkerScriptLoader({ databaseName: 'generic-worker-assets', storeName: 'assets', rootPath: 'stored-files' });
    const base = new URL('./', document.baseURI);
    const root = 'stored-files/Calculator % # \u68cb';
    const encode = (value: string) => new TextEncoder().encode(value);
    const source = "importScripts('./math.js');onmessage=async e=>{const direct=new Uint8Array(await (await fetch(new URL('./weights.bin',location.href))).arrayBuffer());const copied=new Uint8Array(await (await fetch(new Request(new URL('./weights.bin?cache=1',location.href),{headers:{'X-Test':'kept'}}))).arrayBuffer());const xhr=new XMLHttpRequest();xhr.open('GET','./weights.bin');xhr.responseType='arraybuffer';xhr.onload=()=>postMessage({answer:add(e.data,direct[0]),copied:[...copied],xhr:[...new Uint8Array(xhr.response)]});xhr.send();};";
    await loader.writeFiles(root, [
      { path: 'nested/main.js', data: encode(source) },
      { path: 'nested/math.js', data: encode('function add(a,b){return a+b;}') },
      { path: 'nested/weights.bin', data: new Uint8Array([7, 128, 255]) },
    ]);
    const createUrl = URL.createObjectURL.bind(URL);
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    const allocated: Array<{ url: string; blob: Blob }> = [];
    const revoked: string[] = [];
    URL.createObjectURL = blob => { const url = createUrl(blob); allocated.push({ url, blob: blob as Blob }); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); revokeUrl(url); };
    try {
      const entry = loader.resolveUrl(root + '/nested/main.js', base);
      const worker = await loader.createWorker(entry, base);
      const second = await loader.createWorker(entry, base);
      const ask = (target: Worker) => new Promise<unknown>((resolve, reject) => {
        target.onmessage = event => resolve(event.data);
        target.onerror = event => reject(new Error(event.message));
        target.postMessage(35);
      });
      const first = await ask(worker);
      const original = await allocated[0]!.blob.text();
      worker.terminate();
      worker.terminate();
      const firstRelease = [...revoked];
      const independent = await ask(second);
      second.terminate();
      await loader.removeFiles(root);
      let missing = '';
      try { await loader.createWorker(entry, base); } catch (error) { missing = (error as Error).message; }
      return { first, independent, unchanged: original === source, firstRelease, allocated: allocated.map(file => ({ url: file.url, type: file.blob.type })), revoked, missing, roots: await loader.listRoots() };
    } finally { URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; }
  });
  expect(result.first).toEqual({ answer: 42, copied: [7, 128, 255], xhr: [7, 128, 255] });
  expect(result.independent).toEqual(result.first);
  expect(result.unchanged).toBe(true);
  expect(result.allocated).toHaveLength(8);
  expect(result.allocated.slice(0, 4).map(file => file.type)).toEqual(['text/javascript', 'text/javascript', 'application/octet-stream', 'text/javascript']);
  expect(result.firstRelease).toEqual(result.allocated.slice(0, 4).map(file => file.url));
  expect(result.revoked).toEqual(result.allocated.map(file => file.url));
  expect(result.missing).toContain('Stored worker entry not found');
  expect(result.roots).toEqual([]);
  expect(requests).toEqual([]);
});

test('rolls back failed and cancelled writes and exposes storage errors directly', async ({ page }) => {
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utility/WorkerScriptLoader.ts';
    const { WorkerScriptLoader } = await import(modulePath);
    const loader = new WorkerScriptLoader({ databaseName: 'plain-script-test', storeName: 'assets', rootPath: 'stored-files' });
    const base = new URL('./', document.baseURI);
    const root = 'stored-files/example';
    const files = [{ path: 'first.js', data: new Uint8Array([1]) }, { path: 'second.wasm', data: new Uint8Array([0, 97, 115, 109]) }];
    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (++writes === 2) throw new DOMException('Disk full.', 'QuotaExceededError');
      return put.apply(this, args);
    };
    let failure = '';
    try { await loader.writeFiles(root, files); } catch (error) { failure = (error as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    const rolledBack = await loader.listRoots();
    const owner = new AbortController();
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args);
      owner.abort(new Error('Import cancelled.'));
      return request;
    };
    let cancelled = '';
    try { await loader.writeFiles(root, files, owner.signal); } catch (error) { cancelled = (error as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    const cancelledRoots = await loader.listRoots();
    await loader.writeFiles(root, files);
    const stored = await loader.listFiles(root);
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => { throw new DOMException('Storage denied.', 'SecurityError'); };
    let unavailable = '';
    try { await loader.createWorker(loader.resolveUrl(root + '/first.js', base), base); } catch (error) { unavailable = (error as Error).message; }
    finally { indexedDB.open = open; }
    await loader.removeFiles(root);
    return { failure, rolledBack, cancelled, cancelledRoots, stored, unavailable };
  });
  expect(result).toEqual({ failure: 'Disk full.', rolledBack: [], cancelled: 'Import cancelled.', cancelledRoots: [], stored: ['first.js', 'second.wasm'], unavailable: 'Storage denied.' });
});

test('releases all local assets on constructor failure and allocates nothing for cancelled launches', async ({ page }) => {
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utility/WorkerScriptLoader.ts';
    const { WorkerScriptLoader } = await import(modulePath);
    const loader = new WorkerScriptLoader({ databaseName: 'failed-worker-test', storeName: 'files', rootPath: 'scripts' });
    const base = new URL('./', document.baseURI);
    await loader.writeFiles('scripts/test', [{ path: 'main.js', data: new TextEncoder().encode('onmessage=()=>postMessage(1);') }, { path: 'data.wasm', data: new Uint8Array([0, 97, 115, 109]) }]);
    const WorkerClass = Worker;
    const createUrl = URL.createObjectURL.bind(URL);
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    const allocated: string[] = [];
    const revoked: string[] = [];
    const types: string[] = [];
    URL.createObjectURL = blob => { const url = createUrl(blob); allocated.push(url); types.push((blob as Blob).type); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); revokeUrl(url); };
    globalThis.Worker = function () { throw new Error('Worker denied.'); } as unknown as typeof Worker;
    let failure = '', cancelled = '';
    try {
      const entry = loader.resolveUrl('scripts/test/main.js', base);
      try { await loader.createWorker(entry, base); } catch (error) { failure = (error as Error).message; }
      const owner = new AbortController();
      owner.abort(new Error('Launch cancelled.'));
      try { await loader.createWorker(entry, base, owner.signal); } catch (error) { cancelled = (error as Error).message; }
    } finally { globalThis.Worker = WorkerClass; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; }
    return { allocated, revoked, types, failure, cancelled };
  });
  expect(result.failure).toBe('Worker denied.');
  expect(result.cancelled).toBe('Launch cancelled.');
  expect(result.allocated).toHaveLength(3);
  expect(result.revoked).toEqual(result.allocated);
  expect(result.types).toEqual(['application/wasm', 'text/javascript', 'text/javascript']);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserProcessManager } from '../browser/BrowserProcessManager';
import { StoredWorkerUtility } from '@/utility/StoredWorkerUtility';

let manager: BrowserProcessManager;
let workers: Worker[];
beforeEach(() => {
  workers = [];
  vi.stubGlobal('Worker', vi.fn(function () {
    const worker = Object.assign(new EventTarget(), { terminate: vi.fn(), postMessage: vi.fn() }) as unknown as Worker;
    workers.push(worker);
    return worker;
  }));
  manager = new BrowserProcessManager();
});
afterEach(async () => { await manager.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('stored Worker launches', () => {
  it('shares lazy registration, creates independent processes and retains registration after stopping', async () => {
    let finish!: () => void;
    const register = vi.spyOn(StoredWorkerUtility.prototype, 'register').mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const bundled = await manager.spawnProcess('engines/example.js');
    expect(register).not.toHaveBeenCalled();
    const a = manager.spawnProcess('engine-files/A/start.js');
    const b = manager.spawnProcess('engine-files/B/start.js');
    expect(register).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(1);
    finish();
    const [first, second] = await Promise.all([a, b]);
    expect(first).not.toBe(second);
    expect(workers).toHaveLength(3);
    await manager.stopProcess(first);
    await manager.stopProcess(first);
    manager.assertProcessOpen(second);
    await manager.spawnProcess('engine-files/C/start.js');
    expect(register).toHaveBeenCalledOnce();
    await manager.dispose();
    for (const worker of workers) expect(worker.terminate).toHaveBeenCalledOnce();
    await manager.stopProcess(bundled);
  });
  it('propagates one real registration failure to concurrent starts and permits a later attempt', async () => {
    let fail!: (error: unknown) => void;
    const register = vi.spyOn(StoredWorkerUtility.prototype, 'register').mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; })).mockResolvedValue(undefined);
    const a = manager.spawnProcess('engine-files/A/start.js');
    const b = manager.spawnProcess('engine-files/B/start.js');
    const outcomes = Promise.allSettled([a, b]);
    fail(new Error('Registration denied.'));
    for (const result of await outcomes) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ operation: 'spawnProcess', detail: expect.stringContaining('Registration denied') });
    }
    expect(workers).toHaveLength(0);
    await manager.spawnProcess('engine-files/A/start.js');
    expect(register).toHaveBeenCalledTimes(2);
    expect(workers).toHaveLength(1);
  });
  it('settles pending starts on disposal and prevents late Worker creation', async () => {
    const register = vi.spyOn(StoredWorkerUtility.prototype, 'register').mockImplementation((_base, signal) => new Promise<void>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
    }));
    const outcomes = Promise.allSettled([manager.spawnProcess('engine-files/A/start.js'), manager.spawnProcess('engine-files/B/start.js')]);
    await manager.dispose();
    expect((await outcomes).map(result => result.status)).toEqual(['rejected', 'rejected']);
    await expect(manager.spawnProcess('engine-files/C/start.js')).rejects.toMatchObject({ operation: 'spawnProcess' });
    expect(register).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(0);
  });
  it('awaits a late native registration and unregister without creating an engine Worker', async () => {
    let registered!: (registration: ServiceWorkerRegistration) => void;
    let unregistered!: (value: boolean) => void;
    const registration = { unregister: vi.fn(() => new Promise<boolean>(resolve => { unregistered = resolve; })) } as unknown as ServiceWorkerRegistration;
    const container = { register: vi.fn(() => new Promise<ServiceWorkerRegistration>(resolve => { registered = resolve; })) };
    vi.stubGlobal('navigator', { serviceWorker: container });
    const outcomes = Promise.allSettled([manager.spawnProcess('engine-files/A/start.js'), manager.spawnProcess('engine-files/B/start.js')]);
    let disposed = false;
    const cleanup = manager.dispose().then(() => { disposed = true; });
    expect(container.register).toHaveBeenCalledOnce();
    expect(disposed).toBe(false);
    expect(registration.unregister).not.toHaveBeenCalled();
    registered(registration);
    for (const outcome of await outcomes) expect(outcome.status).toBe('rejected');
    expect(workers).toHaveLength(0);
    expect(registration.unregister).toHaveBeenCalledOnce();
    expect(disposed).toBe(false);
    unregistered(true);
    await cleanup;
    expect(disposed).toBe(true);
  });
  it('disposes only the Workers belonging to that manager instance', async () => {
    const other = new BrowserProcessManager();
    const first = await manager.spawnProcess('engines/first.js');
    const second = await other.spawnProcess('engines/second.js');
    await manager.dispose();
    expect(() => manager.assertProcessOpen(first)).toThrow();
    other.assertProcessOpen(second);
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    expect(workers[1]!.terminate).not.toHaveBeenCalled();
    await other.dispose();
    expect(workers[1]!.terminate).toHaveBeenCalledOnce();
  });
});

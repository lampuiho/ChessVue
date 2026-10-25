import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserProcessManager } from '../browser/BrowserProcessManager';
import { WorkerScriptLoader } from '@/utility/WorkerScriptLoader';

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
describe('Worker process ownership', () => {
  it('starts independent loads and stops only the selected process', async () => {
    let finishA!: () => void;
    let finishB!: () => void;
    const create = vi.spyOn(WorkerScriptLoader.prototype, 'createWorker').mockImplementation(url => new Promise<Worker>(resolve => {
      const finish = () => resolve(new Worker(url));
      if (url.pathname.includes('/A/')) finishA = finish;
      else finishB = finish;
    }));
    const a = manager.spawnProcess('engine-files/A/start.js');
    const b = manager.spawnProcess('engine-files/B/start.js');
    expect(create).toHaveBeenCalledTimes(2);
    expect(workers).toHaveLength(0);
    finishB();
    const second = await b;
    manager.assertProcessOpen(second);
    finishA();
    const first = await a;
    expect(first).not.toBe(second);
    await manager.stopProcess(first);
    await manager.stopProcess(first);
    expect(workers[1]!.terminate).toHaveBeenCalledOnce();
    expect(workers[0]!.terminate).not.toHaveBeenCalled();
    manager.assertProcessOpen(second);
  });
  it('isolates a load failure and permits another explicit attempt', async () => {
    const create = vi.spyOn(WorkerScriptLoader.prototype, 'createWorker').mockRejectedValueOnce(new Error('Storage denied.')).mockImplementation(async url => new Worker(url));
    const outcomes = await Promise.allSettled([manager.spawnProcess('engine-files/A/start.js'), manager.spawnProcess('engine-files/B/start.js')]);
    expect(outcomes[0]).toMatchObject({ status: 'rejected', reason: { operation: 'spawnProcess', detail: expect.stringContaining('Storage denied') } });
    expect(outcomes[1]!.status).toBe('fulfilled');
    await manager.spawnProcess('engine-files/A/start.js');
    expect(create).toHaveBeenCalledTimes(3);
    expect(workers).toHaveLength(2);
  });
  it('cancels pending reads on disposal without constructing Workers', async () => {
    vi.spyOn(WorkerScriptLoader.prototype, 'createWorker').mockImplementation((_url, _base, signal) => new Promise<Worker>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
    }));
    const outcomes = Promise.allSettled([manager.spawnProcess('engine-files/A/start.js'), manager.spawnProcess('engine-files/B/start.js')]);
    await manager.dispose();
    expect((await outcomes).map(result => result.status)).toEqual(['rejected', 'rejected']);
    await expect(manager.spawnProcess('engine-files/C/start.js')).rejects.toMatchObject({ operation: 'spawnProcess' });
    expect(workers).toHaveLength(0);
  });
  it('terminates a Worker delivered after manager disposal', async () => {
    let finish!: (worker: Worker) => void;
    vi.spyOn(WorkerScriptLoader.prototype, 'createWorker').mockImplementation(() => new Promise<Worker>(resolve => { finish = resolve; }));
    const outcome = manager.spawnProcess('engine-files/A/start.js');
    const failed = expect(outcome).rejects.toMatchObject({ operation: 'spawnProcess' });
    await manager.dispose();
    const worker = new Worker('blob:late');
    finish(worker);
    await failed;
    expect(worker.terminate).toHaveBeenCalledOnce();
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

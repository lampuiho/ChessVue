import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineAnalysisSearchMode, EngineAvailability, EngineOptionType, type IAssignedEngine } from '@/contracts';
import type { IEngineAnalysisUpdate } from '@/contracts/platform';
import { defineBrowserUciEngineClientStore } from '../browser/BrowserEngineClient';
import { BrowserProcessManager, type BrowserEngineRegistry } from '../browser/BrowserProcessManager';
import { createAssignedEngine, createEngineGame } from './NwjsPlatformTestUtility';

class FakeWorker extends EventTarget {
  readonly commands: string[] = [];
  terminated = false;
  respondToUci = true;
  constructor(readonly url: URL) { super(); }
  postMessage(command: string) {
    this.commands.push(command);
    const output = command === 'uci' && this.respondToUci ? ['option name Hash type spin default 16 min 1 max 1024', 'uciok']
      : command === 'isready' ? ['readyok']
      : command === 'go infinite' ? ['info depth 8 multipv 1 score cp 23 pv e7e5 g1f3']
      : command === 'stop' || command.startsWith('go wtime') ? ['bestmove e7e5 ponder g1f3'] : [];
    queueMicrotask(() => {
      if (!this.terminated) for (const line of output) this.dispatchEvent(new MessageEvent('message', { data: line }));
    });
  }
  terminate() { this.terminated = true; }
  crash() { this.dispatchEvent(new ErrorEvent('error', { message: 'WASM load failed', cancelable: true })); }
}
let pinia: Pinia;
let registry: BrowserEngineRegistry;
let manager: BrowserProcessManager;
let workers: FakeWorker[];
let client: ReturnType<ReturnType<typeof defineBrowserUciEngineClientStore>>;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  registry = new Map();
  workers = [];
  manager = new BrowserProcessManager(registry, (url) => {
    const worker = new FakeWorker(url);
    workers.push(worker);
    return worker as unknown as Worker;
  });
  client = defineBrowserUciEngineClientStore(registry)();
});
afterEach(() => {
  manager.dispose();
  disposePinia(pinia);
});
async function _createEngine(): Promise<IAssignedEngine> {
  const engine = createAssignedEngine();
  engine.executablePath = 'stockfish.js';
  engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
  return engine;
}
describe('browser UCI transport', () => {
  it('uses the bundled worker for handshake, option discovery, analysis and stop', async () => {
    const engine = await _createEngine();
    await client.initialiseEngine(engine);
    expect(workers[0]!.url.pathname).toBe('/engines/stockfish/stockfish-19-lite-single.js');
    expect(client.getOptions(engine)).toContainEqual({ name: 'Hash', type: EngineOptionType.Integer, defaultValue: 16, minimum: 1, maximum: 1024 });
    const updates: IEngineAnalysisUpdate[] = [];
    await client.startAnalysis(engine, createEngineGame(), { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => { updates.push(update); });
    expect(updates[0]!.lines[0]!.pv).toHaveLength(2);
    expect(workers[0]!.commands).toContain('setoption name MultiPV value 3');
    await client.stopAnalysis(engine);
    await client.startPlayerTurn(engine, createEngineGame());
    expect((await client.awaitPlayerTurnMove(engine)).$?.uci).toBe('e7e5');
  });
  it('returns legal UCI player moves from worker messages', async () => {
    const engine = await _createEngine();
    await client.initialiseEngine(engine);
    await client.startPlayerTurn(engine, createEngineGame());
    expect((await client.awaitPlayerTurnMove(engine)).$?.uci).toBe('e7e5');
  });
  it('rejects pending initialisation and invalidates the handle on worker failure', async () => {
    const engine = await _createEngine();
    workers[0]!.respondToUci = false;
    const starting = client.initialiseEngine(engine);
    const rejected = expect(starting).rejects.toMatchObject({ kind: 'unexpectedExit', detail: 'WASM load failed' });
    workers[0]!.crash();
    await rejected;
    expect(() => manager.assertProcessHandleOpen(engine.$!.processHandle!)).toThrow();
    expect(workers[0]!.terminated).toBe(true);
  });
  it('isolates worker lifetimes and replaces handles on restart', async () => {
    const first = await manager.spawnProcess('stockfish.js');
    const second = await manager.spawnProcess('/custom-uci.js');
    const restarted = await manager.restartProcess(first, 'stockfish.js');
    expect(restarted).not.toBe(first);
    expect(() => manager.assertProcessHandleOpen(first)).toThrow();
    expect(workers[0]!.terminated).toBe(true);
    expect(() => manager.assertProcessHandleOpen(second)).not.toThrow();
    manager.dispose();
    expect(registry.size).toBe(0);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });
  it('rejects native executables, cross-origin URLs and desktop arguments', async () => {
    await expect(manager.spawnProcess('C:\\Engines\\stockfish.exe')).rejects.toMatchObject({ kind: 'processStartFailed' });
    await expect(manager.spawnProcess('https://elsewhere.example/engine.js')).rejects.toMatchObject({ kind: 'processStartFailed' });
    await expect(manager.spawnProcess('stockfish.js', ['--threads=2'])).rejects.toMatchObject({ kind: 'processStartFailed' });
    expect(workers).toHaveLength(0);
  });
  it('ignores worker output after its session has stopped', async () => {
    const engine = await _createEngine();
    await client.initialiseEngine(engine);
    const onUpdate = vi.fn();
    await client.startAnalysis(engine, createEngineGame(), { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, onUpdate);
    const count = onUpdate.mock.calls.length;
    await manager.stopProcess(engine.$!.processHandle!);
    workers[0]!.dispatchEvent(new MessageEvent('message', { data: 'info depth 9 score cp 99 pv e7e5' }));
    expect(onUpdate).toHaveBeenCalledTimes(count);
  });
});

import { isProxy, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineClientType, EngineAnalysisSearchMode, EngineAvailability, EngineOptionType, type IAssignedEngine } from '@/contracts';
import type { IEngineAnalysisUpdate, IEngineClient } from '@/contracts/platform';
import { BrowserUciEngineClient } from '../browser/BrowserEngineClient';
import { BrowserProcessManager } from '../browser/BrowserProcessManager';
import { BrowserWorkerProcess } from '@/utility/BrowserWorkerProcess';
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
let manager: BrowserProcessManager;
let workers: FakeWorker[];
let client: IEngineClient;
beforeEach(() => {
  workers = [];
  vi.stubGlobal('Worker', vi.fn(function (url: URL) {
    const worker = new FakeWorker(url);
    workers.push(worker);
    return worker;
  }));
  manager = new BrowserProcessManager();
  client = new BrowserUciEngineClient();
});
afterEach(() => {
  manager.dispose();
  vi.unstubAllGlobals();
});
async function _createEngine(): Promise<IAssignedEngine> {
  const engine = createAssignedEngine();
  engine.clientType = EngineClientType.UciWorker;
  engine.entryPath = 'engines/stockfish/stockfish-19-lite-single.js';
  engine.$ = { process: await manager.spawnProcess(engine.entryPath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
  return engine;
}
describe('browser UCI process', () => {
  it('uses the bundled worker for handshake, option discovery, analysis and stop', async () => {
    const assigned = await _createEngine();
    const engine = reactive(assigned);
    expect(engine.$!.process).toBe(assigned.$!.process);
    expect(engine.$!.process).toBeInstanceOf(BrowserWorkerProcess);
    expect(isProxy(engine.$!.process)).toBe(false);
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
  it('rejects pending initialisation and closes the process on worker failure', async () => {
    const engine = await _createEngine();
    workers[0]!.respondToUci = false;
    const starting = client.initialiseEngine(engine);
    const rejected = expect(starting).rejects.toMatchObject({ kind: 'unexpectedExit', detail: 'WASM load failed' });
    workers[0]!.crash();
    await rejected;
    expect(() => manager.assertProcessOpen(engine.$!.process!)).toThrow();
    expect(workers[0]!.terminated).toBe(true);
    await expect(client.stopEngine(engine)).resolves.toBeUndefined();
  });
  it('isolates worker lifetimes and replaces process objects on restart', async () => {
    const first = await manager.spawnProcess('engines/stockfish/stockfish-19-lite-single.js');
    const second = await manager.spawnProcess('/custom-uci.js');
    const restarted = await manager.restartProcess(first, 'engines/stockfish/stockfish-19-lite-single.js');
    expect(restarted).not.toBe(first);
    expect(() => manager.assertProcessOpen(first)).toThrow();
    expect(workers[0]!.terminated).toBe(true);
    expect(() => manager.assertProcessOpen(second)).not.toThrow();
    manager.dispose();
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });
  it('rejects native executables, cross-origin URLs and desktop arguments', async () => {
    await expect(manager.spawnProcess('C:\\Engines\\stockfish.exe')).rejects.toMatchObject({ kind: 'processStartFailed' });
    await expect(manager.spawnProcess('https://elsewhere.example/engine.js')).rejects.toMatchObject({ kind: 'processStartFailed' });
    await expect(manager.spawnProcess('engines/stockfish/stockfish-19-lite-single.js', ['--threads=2'])).rejects.toMatchObject({ kind: 'processStartFailed' });
    expect(workers).toHaveLength(0);
  });
  it('ignores worker output after its session has stopped', async () => {
    const engine = await _createEngine();
    await client.initialiseEngine(engine);
    const onUpdate = vi.fn();
    await client.startAnalysis(engine, createEngineGame(), { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, onUpdate);
    const count = onUpdate.mock.calls.length;
    await manager.stopProcess(engine.$!.process!);
    workers[0]!.dispatchEvent(new MessageEvent('message', { data: 'info depth 9 score cp 99 pv e7e5' }));
    expect(onUpdate).toHaveBeenCalledTimes(count);
  });
  it('uses a process directly without manager registration', async () => {
    const worker = new FakeWorker(new URL('http://localhost/engine.js'));
    const process = new BrowserWorkerProcess(worker as unknown as Worker);
    expect(() => manager.assertProcessOpen(process)).not.toThrow();
    await manager.stopProcess(process);
    expect(worker.terminated).toBe(true);
    await expect(manager.stopProcess(process)).resolves.toBeUndefined();
  });
  it('keeps manager cleanup when the client detaches its session', async () => {
    const engine = await _createEngine();
    await client.initialiseEngine(engine);
    await client.stopEngine(engine);
    expect(workers[0]!.terminated).toBe(false);
    const process = engine.$!.process!;
    process.kill();
    const kill = vi.spyOn(process, 'kill');
    manager.dispose();
    expect(kill).not.toHaveBeenCalled();
  });
  it('terminates a created worker when process construction fails', async () => {
    const worker = new FakeWorker(new URL('http://localhost/engine.js'));
    vi.spyOn(worker, 'addEventListener').mockImplementation(() => { throw new Error('Listener setup failed.'); });
    vi.stubGlobal('Worker', function () { return worker; });
    await expect(manager.spawnProcess('engines/stockfish/stockfish-19-lite-single.js')).rejects.toMatchObject({ kind: 'processStartFailed', detail: expect.stringContaining('Listener setup failed.') });
    expect(worker.terminated).toBe(true);
  });
  it('parses complete UCI lines from one message with blanks and CRLF', async () => {
    const engine = await _createEngine();
    workers[0]!.respondToUci = false;
    const starting = client.initialiseEngine(engine);
    workers[0]!.dispatchEvent(new MessageEvent('message', { data: '  option name Hash type spin default 32 min 1 max 1024\r\n\nuciok' }));
    await starting;
    expect(client.getOptions(engine)).toContainEqual({ name: 'Hash', type: EngineOptionType.Integer, defaultValue: 32, minimum: 1, maximum: 1024 });
  });
});

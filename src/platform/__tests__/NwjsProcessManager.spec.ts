import { EngineClientType } from '@/contracts/Engine';
import type { IProcessManager } from '@/contracts/platform';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { isProxy, reactive } from 'vue';
import { registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('NwjsProcessManager', () => {
  it('returns the original raw process with both output streams decoded before delivery', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const process = await manager.spawnProcess('stockfish.exe');
    const native = getEnvironment().latestProcess();
    expect(process).toBe(native);
    expect(reactive({ process }).process).toBe(native);
    expect(isProxy(process)).toBe(false);
    expect(native.listenerCount('spawn')).toBe(0);
    expect(native.listenerCount('error')).toBe(0);
    for (const stream of [native.stdout, native.stderr]) {
      const chunks: string[] = [];
      const receive = (chunk: string) => { expect(typeof chunk).toBe('string'); chunks.push(chunk); };
      stream.on('data', receive);
      const bytes = Buffer.from('option name Café\n');
      const split = bytes.indexOf(0xc3) + 1;
      stream.write(bytes.subarray(0, split));
      stream.write(bytes.subarray(split));
      expect(chunks.join('')).toBe('option name Café\n');
      stream.removeListener('data', receive);
    }
    await manager.stopProcess(process);
  });
  it.each([[1, null], [null, 'SIGTERM']] as const)('isolates exit code %s / signal %s by process identity', async (code, signal) => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const first = await manager.spawnProcess('stockfish.exe');
    const firstNative = getEnvironment().latestProcess();
    const second = await manager.spawnProcess('stockfish.exe');
    firstNative.emit('exit', code, signal);
    expect(() => manager.assertProcessOpen(first)).toThrowError(/no longer running/);
    expect(() => manager.assertProcessOpen(second)).not.toThrow();
    await manager.stopProcess(second);
  });
  it('recognises a native process without manager registration', async () => {
    const native = getEnvironment().spawn();
    await Promise.resolve();
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    expect(() => manager.assertProcessOpen(native)).not.toThrow();
    await manager.stopProcess(native);
  });
  it('rejects startup errors and removes its temporary startup listeners', async () => {
    const failed = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: vi.fn(() => false) });
    const spawn = vi.spyOn(getEnvironment(), 'spawn').mockReturnValueOnce(failed);
    const pending = getPlatformService().getProcessManager(EngineClientType.Uci).spawnProcess('missing.exe');
    failed.emit('error', new Error('Executable not found.'));
    await expect(pending).rejects.toMatchObject({ kind: 'processStartFailed', operation: 'spawnProcess' });
    expect(failed.listenerCount('spawn')).toBe(0);
    expect(failed.listenerCount('error')).toBe(0);
    spawn.mockRestore();
  });
  it('waits for native exit after the termination signal is accepted', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const process = await manager.spawnProcess('stockfish.exe');
    const native = getEnvironment().latestProcess();
    vi.spyOn(native, 'kill').mockReturnValueOnce(true);
    let stopped = false;
    const stopping = manager.stopProcess(process).then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    native.emit('exit', null, 'SIGTERM');
    await stopping;
    expect(stopped).toBe(true);
    expect(native.listenerCount('exit')).toBe(0);
    expect(native.listenerCount('error')).toBe(0);
  });
  it('restarts with a distinct native process and closes the previous one', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const previous = await manager.spawnProcess('stockfish.exe');
    const replacement = await manager.restartProcess(previous, 'stockfish.exe');
    expect(replacement).not.toBe(previous);
    expect(replacement).toBe(getEnvironment().latestProcess());
    expect(() => manager.assertProcessOpen(previous)).toThrow();
    expect(() => manager.assertProcessOpen(replacement)).not.toThrow();
    await manager.stopProcess(replacement);
  });
  it('returns the same class for both bindings and keeps Worker disposal independent of native ownership', async () => {
    const worker = Object.assign(new EventTarget(), { terminate: vi.fn(), postMessage: vi.fn() });
    vi.stubGlobal('Worker', vi.fn(function () { return worker; }));
    try {
      const platform = getPlatformService();
      const nativeManager = platform.getProcessManager(EngineClientType.Uci);
      const workerManager = platform.getProcessManager(EngineClientType.UciWorker);
      expect(workerManager.constructor).toBe(nativeManager.constructor);
      expect(workerManager).not.toBe(nativeManager);
      expect(isProxy(nativeManager)).toBe(false);
      expect(isProxy(workerManager)).toBe(false);
      const native = await nativeManager.spawnProcess('stockfish.exe');
      const browser = await workerManager.spawnProcess('engines/example.js');
      const dispose = (workerManager as IProcessManager & { dispose(): Promise<void> }).dispose();
      expect(worker.terminate).toHaveBeenCalledOnce();
      await dispose;
      expect(() => workerManager.assertProcessOpen(browser)).toThrow();
      nativeManager.assertProcessOpen(native);
      await nativeManager.stopProcess(native);
      await nativeManager.stopProcess(native);
      const restarted = await nativeManager.restartProcess(native, 'stockfish.exe');
      nativeManager.assertProcessOpen(restarted);
      await nativeManager.stopProcess(restarted);
    } finally { vi.unstubAllGlobals(); }
  });

  it('disposes only owned native processes, awaits their exit and rejects later starts', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci) as IProcessManager & { dispose(): Promise<void> };
    const unrelated = getEnvironment().spawn();
    const first = await manager.spawnProcess('stockfish.exe');
    const second = await manager.spawnProcess('stockfish.exe');
    const native = getEnvironment().latestProcess();
    const kill = vi.spyOn(native, 'kill').mockReturnValue(true);
    let settled = false;
    const closing = manager.dispose().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(kill).toHaveBeenCalledOnce();
    native.emit('exit', 0, null);
    await closing;
    await manager.dispose();
    expect(kill).toHaveBeenCalledOnce();
    expect(() => manager.assertProcessOpen(first)).toThrow();
    expect(() => manager.assertProcessOpen(second)).toThrow();
    expect(() => manager.assertProcessOpen(unrelated)).not.toThrow();
    await expect(manager.spawnProcess('late.exe')).rejects.toMatchObject({ kind: 'processStartFailed' });
    unrelated.kill();
  });
  it('settles disposal silently when owned processes refuse or throw during termination', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci) as IProcessManager & { dispose(): Promise<void> };
    await manager.spawnProcess('first.exe');
    const first = getEnvironment().latestProcess();
    await manager.spawnProcess('second.exe');
    const second = getEnvironment().latestProcess();
    const refused = vi.spyOn(first, 'kill').mockReturnValue(false);
    const thrown = vi.spyOn(second, 'kill').mockImplementation(() => { throw new Error('Permission denied.'); });
    await expect(manager.dispose()).resolves.toBeUndefined();
    expect(refused).toHaveBeenCalledOnce();
    expect(thrown).toHaveBeenCalledOnce();
    expect(first.listenerCount('exit')).toBe(1);
    expect(second.listenerCount('exit')).toBe(1);
    first.emit('exit', 0, null);
    second.emit('exit', 0, null);
  });
  it('settles a native start cancelled by manager disposal before spawn delivery', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci) as IProcessManager & { dispose(): Promise<void> };
    const starting = manager.spawnProcess('stockfish.exe');
    const rejected = expect(starting).rejects.toMatchObject({ kind: 'processStartFailed' });
    await manager.dispose();
    await rejected;
    expect(getEnvironment().latestProcess().exitCode).toBe(0);
  });
  it('silently settles a thrown termination signal and allows retry without leaking listeners', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const process = await manager.spawnProcess('stockfish.exe');
    const native = getEnvironment().latestProcess();
    vi.spyOn(native, 'kill').mockImplementationOnce(() => { throw new Error('Permission denied.'); });
    await expect(manager.stopProcess(process)).resolves.toBeUndefined();
    expect(native.listenerCount('exit')).toBe(1);
    await manager.stopProcess(process);
    expect(native.listenerCount('exit')).toBe(0);
  });
  it('silently retries a refused signal and settles concurrent stops without leaking listeners', async () => {
    const manager = getPlatformService().getProcessManager(EngineClientType.Uci);
    const process = await manager.spawnProcess('stockfish.exe');
    const native = getEnvironment().latestProcess();
    const kill = vi.spyOn(native, 'kill').mockReturnValueOnce(false);
    await expect(manager.stopProcess(process)).resolves.toBeUndefined();
    expect(native.listenerCount('exit')).toBe(1);
    kill.mockReturnValue(true);
    const first = manager.stopProcess(process);
    const second = manager.stopProcess(process);
    native.emit('exit', 0, null);
    await Promise.all([first, second]);
    expect(native.listenerCount('exit')).toBe(0);
  });
});

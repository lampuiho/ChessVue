import { describe, expect, it, vi } from 'vitest';
import { BrowserWorkerProcess } from '@/utility/BrowserWorkerProcess';

class FakeWorker extends EventTarget {
  readonly postMessage = vi.fn<(command: string) => void>();
  readonly terminate = vi.fn();
}
function _createProcess() {
  const worker = new FakeWorker();
  const process = new BrowserWorkerProcess(worker as unknown as Worker);
  return { worker, process };
}
describe('BrowserWorkerProcess', () => {
  it('buffers partial input and posts complete commands without their terminators', () => {
    const { worker, process } = _createProcess();
    expect(process.stdin.write('u')).toBe(true);
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(process.stdin.write('ci\r\nisready\nsetoption name Hash value ')).toBe(true);
    expect(worker.postMessage.mock.calls).toEqual([['uci'], ['isready']]);
    process.stdin.write('32\n');
    expect(worker.postMessage).toHaveBeenLastCalledWith('setoption name Hash value 32');
    process.kill();
  });
  it('keeps Worker message boundaries and ignores non-string messages', () => {
    const { worker, process } = _createProcess();
    const receive = vi.fn();
    process.stdout.on('data', receive);
    for (const data of ['uci', 'ok', 'readyok\r\ninfo depth 1\n', { type: 'ready' }]) worker.dispatchEvent(new MessageEvent('message', { data }));
    expect(receive.mock.calls).toEqual([['uci\n'], ['ok\n'], ['readyok\r\ninfo depth 1\n']]);
    expect(process).not.toHaveProperty('stderr');
    process.kill();
  });
  it('removes listener registrations and emits a single managed exit without replay', () => {
    const { worker, process } = _createProcess();
    const receive = vi.fn();
    const removedExit = vi.fn();
    const exit = vi.fn(() => expect(process.closed).toBe(true));
    const remove = vi.spyOn(worker, 'removeEventListener');
    process.stdout.on('data', receive);
    process.stdout.removeListener('data', receive);
    process.once('exit', removedExit);
    process.removeListener('exit', removedExit);
    process.once('exit', exit);
    worker.dispatchEvent(new MessageEvent('message', { data: 'uciok' }));
    expect(process.kill()).toBe(true);
    expect(process.kill()).toBe(false);
    process.once('exit', removedExit);
    worker.dispatchEvent(new MessageEvent('message', { data: 'late output' }));
    worker.dispatchEvent(new Event('messageerror'));
    expect(receive).not.toHaveBeenCalled();
    expect(removedExit).not.toHaveBeenCalled();
    expect(exit.mock.calls).toEqual([[null, null]]);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(remove.mock.calls.map(([name]) => name)).toEqual(['message', 'error', 'messageerror']);
    expect(process.exitDetail).toBe('Engine worker terminated.');
    expect(() => process.stdin.write('uci\n')).toThrowError(expect.objectContaining({ kind: 'invalidProcessHandle' }));
  });
  it.each([
    ['error', 'WASM load failed', 'WASM load failed'],
    ['error', '', 'The engine worker failed to load or crashed.'],
    ['messageerror', '', 'The engine worker emitted an unreadable message.'],
  ])('closes on %s and retains its diagnostic %s', (type, message, detail) => {
    const { worker, process } = _createProcess();
    const exit = vi.fn(() => expect(process.exitDetail).toBe(detail));
    process.once('exit', exit);
    const event = type === 'error' ? new ErrorEvent(type, { message, cancelable: true }) : new Event(type);
    worker.dispatchEvent(event);
    expect(exit).toHaveBeenCalledWith(null, null);
    expect(process.closed).toBe(true);
    expect(worker.terminate).toHaveBeenCalledOnce();
    if (type === 'error') expect(event.defaultPrevented).toBe(true);
  });
  it('closes and reports command-delivery failure when postMessage throws', () => {
    const { worker, process } = _createProcess();
    worker.postMessage.mockImplementation(() => { throw new Error('Channel failed.'); });
    const exit = vi.fn();
    process.once('exit', exit);
    expect(() => process.stdin.write('uci\n')).toThrowError(expect.objectContaining({ kind: 'unexpectedExit', message: 'The engine worker could not receive a command.', detail: 'Error: Channel failed.' }));
    expect(process.exitDetail).toBe('Error: Channel failed.');
    expect(exit).toHaveBeenCalledWith(null, null);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

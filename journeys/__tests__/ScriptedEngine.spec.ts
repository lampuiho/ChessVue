import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialBoardPosition, genLegalMoves, getUci } from '@/utility/chess';
import { ScriptedEngine } from '../ScriptedEngine';

describe('journey UCI process', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('handshakes, analyses three legal PVs and settles stop', async () => {
    const engine = new ScriptedEngine('journey://a');
    const output: string[] = [];
    engine.stdout.on('data', (chunk) => output.push(String(chunk).trim()));
    const spawned = vi.fn();
    engine.once('spawn', spawned);
    engine.stdin.write('uci\n');
    engine.stdin.write('isready\n');
    await Promise.resolve();
    expect(spawned).toHaveBeenCalledOnce();
    expect(output).toContain('uciok');
    expect(output).toContain('readyok');
    engine.stdin.write('position startpos moves e2e4 e7e5\n');
    engine.stdin.write('go infinite\n');
    await vi.advanceTimersByTimeAsync(150);
    const lines = output.filter((line) => line.startsWith('info '));
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('multipv 3');
    expect(output.some((line) => line.startsWith('bestmove '))).toBe(false);
    engine.stdin.write('stop\n');
    await Promise.resolve();
    expect(output[output.length - 1]).toMatch(/^bestmove [a-h][1-8][a-h][1-8]/);
    engine.kill();
  });
  it('returns a deterministic legal player move for FEN and cancels pending output on kill', async () => {
    const engine = new ScriptedEngine('journey://b');
    const output: string[] = [];
    engine.stdout.on('data', (chunk) => output.push(String(chunk).trim()));
    engine.stdin.write('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1\n');
    engine.stdin.write('go wtime 60000 btime 60000\n');
    await vi.advanceTimersByTimeAsync(150);
    const move = output[output.length - 1]!.split(' ')[1];
    expect(genLegalMoves(createInitialBoardPosition()).map(getUci)).toContain(move);
    engine.stdin.write('go infinite\n');
    const count = output.length;
    const exited = vi.fn();
    engine.once('exit', exited);
    engine.kill();
    await vi.advanceTimersByTimeAsync(150);
    expect(output).toHaveLength(count);
    expect(exited).toHaveBeenCalledOnce();
  });
  it('rejects unavailable and arbitrary executable paths without launching a process', async () => {
    for (const path of ['journey://unavailable', 'C:/real-engine.exe']) {
      const engine = new ScriptedEngine(path);
      const error = vi.fn();
      engine.once('error', error);
      await Promise.resolve();
      expect(error).toHaveBeenCalledOnce();
      expect(error.mock.calls[0]![0]).toBeInstanceOf(Error);
    }
  });
});

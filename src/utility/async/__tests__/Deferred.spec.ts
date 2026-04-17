import { describe, expect, it } from 'vitest';

import { Deferred } from '../Deferred';

describe('Deferred', () => {
  it('is awaitable and resolves to the provided value', async () => {
    const deferred = new Deferred<number>();

    queueMicrotask(() => deferred.resolve(42));

    expect(await deferred).toBe(42);
  });
  it('returns the resolved content when awaited', async () => {
    const deferred = new Deferred<{ ok: boolean; value: string }>();

    queueMicrotask(() => deferred.resolve({ ok: true, value: 'task-done' }));

    const result = await deferred;

    expect(result).toEqual({ ok: true, value: 'task-done' });
  });
  it('rejects through try and catch', async () => {
    const deferred = new Deferred<never>();
    const error = new Error('Deferred failed.');

    queueMicrotask(() => deferred.reject(error));

    try {
      await deferred;
      throw new Error('Expected Deferred to reject.');
    } catch (caughtError) {
      expect(caughtError).toBe(error);
    }
  });
});

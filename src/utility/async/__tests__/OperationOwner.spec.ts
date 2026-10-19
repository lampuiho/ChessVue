import { afterEach, expect, it, vi } from 'vitest';
import { OperationOwner } from '../OperationOwner';
import { abortable, abortableDelay } from '../Abortable';
import { Deferred } from '../Deferred';
afterEach(() => vi.useRealTimers());
it('settles cancellation and releases its delay before starting replacement work', async () => {
  vi.useFakeTimers();
  const owner = new OperationOwner();
  const events: string[] = [];
  const original = owner.run(async (signal) => {
    events.push('start');
    try { await abortableDelay(350, signal); events.push('obsolete'); }
    finally { events.push('settled'); }
  });
  await vi.advanceTimersByTimeAsync(0);
  const replacement = owner.run(async () => { events.push('replacement'); });
  await Promise.all([original, replacement]);
  expect(events).toEqual(['start', 'settled', 'replacement']);
  expect(vi.getTimerCount()).toBe(0);
});
it.each(['resolve', 'reject'])('detaches uncancellable work and handles its late %s', async (outcome) => {
  const owner = new OperationOwner();
  const pending = new Deferred<string>();
  const results: string[] = [];
  const original = owner.run(async (signal) => { results.push(await abortable(pending, signal)); });
  await Promise.resolve();
  const replacement = owner.run(async () => { results.push('current'); });
  await Promise.all([original, replacement]);
  if (outcome === 'resolve') pending.resolve('obsolete');
  else pending.reject(new Error('obsolete'));
  await Promise.resolve();
  expect(results).toEqual(['current']);
});
it('propagates real failures, remains reusable and prevents starts after disposal', async () => {
  const owner = new OperationOwner();
  await expect(owner.run(async () => { throw new Error('failed'); })).rejects.toThrow('failed');
  const action = vi.fn(async () => {});
  await owner.run(action);
  await owner.dispose();
  await owner.run(action);
  expect(action).toHaveBeenCalledTimes(1);
});

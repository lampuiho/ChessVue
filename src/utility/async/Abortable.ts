/** Stops delivery on cancellation while still handling the underlying promise's rejection. */
export function abortable<T>(work: PromiseLike<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const _cancel = () => { signal.removeEventListener('abort', _cancel); reject(signal.reason); };
    signal.addEventListener('abort', _cancel, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', _cancel));
    if (signal.aborted) _cancel();
  });
}
export function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const _cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', _cancel); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', _cancel); resolve(); }, milliseconds);
    signal.addEventListener('abort', _cancel, { once: true });
    if (signal.aborted) _cancel();
  });
}

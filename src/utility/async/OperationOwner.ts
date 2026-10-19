/** Serialises owned work and settles cancellation before its replacement starts. */
export class OperationOwner {
  private _controller?: AbortController;
  private _completion = Promise.resolve();
  private _disposed = false;
  run(action: (signal: AbortSignal) => Promise<void>) {
    this._controller?.abort();
    const controller = new AbortController();
    this._controller = controller;
    if (this._disposed) controller.abort();
    const completion = this._completion.then(async () => {
      if (controller.signal.aborted) return;
      try {
        await action(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    });
    this._completion = completion.catch(() => {});
    return completion;
  }
  cancel() {
    this._controller?.abort();
    return this._completion;
  }
  dispose() {
    this._disposed = true;
    return this.cancel();
  }
}

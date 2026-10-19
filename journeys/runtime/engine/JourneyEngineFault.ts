export class JourneyEngineFault {
  private readonly _failures = new Map<string, number>();
  failNext(path: string, count = 1) {
    if (!Number.isInteger(count) || count < 0) throw new Error('Failure count must be a non-negative integer.');
    this._failures.set(path, count);
  }
  consumeFailure(path: string): boolean {
    const count = this._failures.get(path) ?? 0;
    if (count) this._failures.set(path, count - 1);
    return count > 0;
  }
  reset() { this._failures.clear(); }
}

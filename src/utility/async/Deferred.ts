export class Deferred<T> extends Promise<T> {
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason?: unknown) => void;

  promise?: Promise<T>;
  constructor(promise?: Promise<T>) {
    const controller = new AbortController();
    const signal = controller.signal;
    super((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.promise = promise;
    this.promise?.then(x => this.resolve(x), e => this.reject(e));
  }
  get [Symbol.toStringTag]() { return "Promise"; }
}

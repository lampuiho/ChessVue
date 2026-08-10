export class Deferred<T> extends Promise<T> {
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason?: unknown) => void;

  static get [Symbol.species](): PromiseConstructor { return Promise; }
  promise?: Promise<T>;
  constructor(promise?: Promise<T>) {
    let resolvePromise!: (value: T | PromiseLike<T>) => void;
    let rejectPromise!: (reason?: unknown) => void;
    super((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    this.resolve = resolvePromise;
    this.reject = rejectPromise;
    this.promise = promise;
    this.promise?.then(
      (value) => resolvePromise(value),
      (error) => rejectPromise(error),
    );
  }
  get [Symbol.toStringTag]() { return "Promise"; }
}

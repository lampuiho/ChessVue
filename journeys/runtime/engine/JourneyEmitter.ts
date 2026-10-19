type Listener = (...args: any[]) => void;
export class JourneyEmitter {
  private readonly _listeners = new Map<string, Map<Listener, boolean>>();
  on(event: string, listener: Listener): this { return this.add(event, listener, false); }
  once(event: string, listener: Listener): this { return this.add(event, listener, true); }
  removeListener(event: string, listener: Listener): this {
    this._listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, ...args: any[]) {
    const listeners = this._listeners.get(event);
    for (const [listener, once] of [...listeners ?? []]) {
      if (once) listeners?.delete(listener);
      listener(...args);
    }
  }
  listenerCount(): number { return [...this._listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
  private add(event: string, listener: Listener, once: boolean): this {
    const listeners = this._listeners.get(event) ?? new Map<Listener, boolean>();
    listeners.set(listener, once);
    this._listeners.set(event, listeners);
    return this;
  }
}

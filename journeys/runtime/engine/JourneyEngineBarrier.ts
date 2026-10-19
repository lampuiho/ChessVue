import { JourneyEngineFault } from './JourneyEngineFault';
export type SearchKind = 'analysis' | 'player';
export interface IJourneySearch {
  id: number;
  processId: number;
  path: string;
  kind: SearchKind;
  pending: boolean;
}
interface IJourneyProcess {
  release(): void;
  emitLine(line: string): void;
  crash(): void;
  diagnostics(): { closed: boolean; pendingTimer: boolean; searching: boolean; listeners: number };
}
export class JourneyEngineBarrier extends JourneyEngineFault {
  private readonly _held = new Set<SearchKind>();
  private readonly _processes = new Map<number, { path: string; process: IJourneyProcess }>();
  private readonly _searches: IJourneySearch[] = [];
  stopHeld = false;
  hold(kind: SearchKind, held = true): void {
    if (held) this._held.add(kind);
    else this._held.delete(kind);
  }
  holdStops(held: boolean): void { this.stopHeld = held; }
  isHeld(kind: SearchKind): boolean { return this._held.has(kind); }
  attach(path: string, process: IJourneyProcess): number {
    const id = this._processes.size + 1;
    this._processes.set(id, { path, process });
    return id;
  }
  begin(processId: number, kind: SearchKind): number {
    const id = this._searches.length + 1;
    this._searches.push({ id, processId, path: this._processes.get(processId)!.path, kind, pending: true });
    return id;
  }
  settle(id?: number): void {
    const search = this._searches.find((entry) => entry.id === id);
    if (search) search.pending = false;
  }
  searchKind(id?: number): SearchKind | undefined { return this._searches.find((entry) => entry.id === id)?.kind; }
  searches(): IJourneySearch[] { return this._searches.map((search) => ({ ...search })); }
  processes() { return [...this._processes].map(([id, entry]) => ({ id, path: entry.path, ...entry.process.diagnostics() })); }
  release(id: number): void {
    const search = this.requireSearch(id);
    // A settled search cannot release into a newer search on the same process.
    if (search.pending) this._processes.get(search.processId)!.process.release();
  }
  emit(id: number, line: string): void {
    if (/[\r\n]/.test(line)) throw new Error('Emit one UCI record at a time.');
    this._processes.get(this.requireSearch(id).processId)!.process.emitLine(line);
  }
  crash(processId: number): void {
    const entry = this._processes.get(processId);
    if (!entry) throw new Error('Unknown journey process.');
    entry.process.crash();
  }
  override reset(): void {
    super.reset();
    this._held.clear();
    this.stopHeld = false;
    for (const entry of this._processes.values()) entry.process.crash();
  }
  private requireSearch(id: number): IJourneySearch {
    const search = this._searches.find((entry) => entry.id === id);
    if (!search) throw new Error('Unknown journey search.');
    return search;
  }
}

import { createInitialBoardPosition, applyMove, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';
import type { ISpawnedProcess } from '@/utility/nwjs/models';
import { smotheredMateReply } from '../../definitions/play/data/SmotheredMate';
import { JourneyEmitter } from './JourneyEmitter';
import { createVariations, parseFen } from './JourneyEngineSearch';
import type { JourneyEngineBarrier } from './JourneyEngineBarrier';
class ScriptedEngineOutput extends JourneyEmitter {
  setEncoding(_encoding: string): this { return this; }
}
export class ScriptedEngine extends JourneyEmitter implements ISpawnedProcess {
  readonly pid = 1;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  private readonly _id: number;
  private _searchId?: number;
  private _stopping = false;
  readonly stdout = new ScriptedEngineOutput() as unknown as NodeJS.ReadableStream;
  readonly stderr = new ScriptedEngineOutput() as unknown as NodeJS.ReadableStream;
  readonly stdin = { write: (chunk: string) => { this._command(chunk.trim()); return true; } } as unknown as NodeJS.WritableStream;
  private _position = createInitialBoardPosition();
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _searching = false;
  private _closed = false;
  private _multiPv = 3;
  constructor(private readonly _path: string, private readonly _control?: JourneyEngineBarrier) {
    super();
    this._id = _control?.attach(_path, this) ?? 0;
    queueMicrotask(() => {
      if (['journey://a', 'journey://b'].includes(_path) && !_control?.consumeFailure(_path)) this.emit('spawn');
      else {
        this._closed = true;
        this.emit('error', new Error(`Scripted engine unavailable: ${_path}`));
      }
    });
  }
  kill(): boolean {
    clearTimeout(this._timer);
    this._timer = undefined;
    if (!this._closed) queueMicrotask(() => { this.exitCode = 0; this.emit('exit', 0, null); });
    this._closed = true;
    this._searching = false;
    this._control?.settle(this._searchId);
    return true;
  }
  diagnostics() {
    return { closed: this._closed, pendingTimer: this._timer !== undefined, searching: this._searching, listeners: this.listenerCount() + (this.stdout as unknown as JourneyEmitter).listenerCount() + (this.stderr as unknown as JourneyEmitter).listenerCount() };
  }
  emitLine(line: string) { (this.stdout as unknown as JourneyEmitter).emit('data', `${line}\n`); }
  crash() { this.kill(); }
  release() {
    this._emitVariations();
    if (this._stopping || this._control?.searchKind(this._searchId) === 'player') this._finishSearch();
  }
  private _output(line: string) {
    if (!this._closed) this.emitLine(line);
  }
  private _command(command: string) {
    if (this._closed) return;
    if (command === 'uci') queueMicrotask(() => {
      this._output(`id name Journey ${this._path.endsWith('b') ? 'B' : 'A'}`);
      this._output('option name MultiPV type spin default 3 min 1 max 3');
      this._output('option name Hash type spin default 16 min 1 max 128');
      this._output('uciok');
    });
    else if (command === 'isready') queueMicrotask(() => this._output('readyok'));
    else if (command.startsWith('position ')) this._setPosition(command);
    else if (command.startsWith('setoption name MultiPV value ')) this._multiPv = Math.min(3, Math.max(1, Number(command.slice(command.lastIndexOf(' ') + 1))));
    else if (command.startsWith('go')) this._search(command.includes('infinite'));
    else if (command === 'stop' && this._searching) {
      this._stopping = true;
      if (!this._control?.stopHeld) this._finishSearch();
    }
    else if (command === 'quit') this.kill();
  }
  private _setPosition(command: string) {
    const tokens = command.split(/\s+/);
    this._position = tokens[1] === 'startpos' ? createInitialBoardPosition() : parseFen(tokens.slice(2, 8));
    const movesIndex = tokens.indexOf('moves');
    if (movesIndex < 0) return;
    for (const uci of tokens.slice(movesIndex + 1)) {
      const raw = genLegalMoves(this._position).find((move) => getUci(move) === uci);
      if (!raw) throw new Error(`Invalid journey engine position move: ${uci}.`);
      applyMove(this._position, toDetailedMove(this._position, raw));
    }
  }
  private _search(infinite: boolean) {
    clearTimeout(this._timer);
    this._timer = undefined;
    this._searching = true;
    this._stopping = false;
    this._searchId = this._control?.begin(this._id, infinite ? 'analysis' : 'player');
    if (this._control?.isHeld(infinite ? 'analysis' : 'player')) return;
    this._timer = setTimeout(() => {
      this._timer = undefined;
      this._emitVariations();
      if (!infinite) this._finishSearch();
    }, 150);
  }
  private _emitVariations() {
    createVariations(this._position, this._multiPv).forEach((pv, index) => {
      const score = (this._path.endsWith('b') ? 36 : 24) - index * 18;
      this._output(`info depth 12 multipv ${index + 1} score cp ${score} pv ${pv.map(getUci).join(' ')}`);
    });
  }
  private _finishSearch() {
    clearTimeout(this._timer);
    this._timer = undefined;
    this._searching = false;
    this._control?.settle(this._searchId);
    const legal = genLegalMoves(this._position);
    const scripted = smotheredMateReply(this._position);
    const move = legal.find((candidate) => getUci(candidate) === scripted) ?? legal[0];
    queueMicrotask(() => this._output(`bestmove ${move ? getUci(move) : '(none)'}`));
  }
}

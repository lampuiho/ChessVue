import { PieceKind, PlayerColour, type IBoardPosition, type IMove } from '@/contracts';
import { applyMove, createInitialBoardPosition, createSparseBoard, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';
import type { ISpawnedProcess } from '@/utility/nwjs/models';

type Listener = (...args: any[]) => void;
class JourneyEmitter {
  private readonly _listeners = new Map<string, Set<Listener>>();
  on(event: string, listener: Listener): this {
    const listeners = this._listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this._listeners.set(event, listeners);
    return this;
  }
  once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }
  removeListener(event: string, listener: Listener): this {
    this._listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, ...args: any[]): void {
    for (const listener of [...this._listeners.get(event) ?? []]) listener(...args);
  }
}
const pieceByFen: Record<string, PieceKind> = { k: PieceKind.King, q: PieceKind.Queen, r: PieceKind.Rook, b: PieceKind.Bishop, n: PieceKind.Knight, p: PieceKind.Pawn };
function parseFen(tokens: string[]): IBoardPosition {
  const position = createSparseBoard([], tokens[1] === 'w' ? PlayerColour.White : PlayerColour.Black);
  tokens[0]!.split('/').forEach((row, rowIndex) => {
    let file = 0;
    for (const character of row) {
      const kind = pieceByFen[character.toLowerCase()];
      if (kind) position.board[(7 - rowIndex) * 8 + file++] = { kind, colour: character === character.toUpperCase() ? PlayerColour.White : PlayerColour.Black };
      else file += Number(character);
    }
  });
  const castling = tokens[2]!;
  position.castlingAvailability = { whiteKingSide: castling.includes('K'), whiteQueenSide: castling.includes('Q'), blackKingSide: castling.includes('k'), blackQueenSide: castling.includes('q') };
  const enPassant = tokens[3]!;
  if (enPassant !== '-') position.enPassantTarget = (Number(enPassant[1]) - 1) * 8 + enPassant.charCodeAt(0) - 97;
  position.halfMoveClock = Number(tokens[4]);
  position.fullMoveNumber = Number(tokens[5]);
  return position;
}
export function createVariations(position: IBoardPosition, count = 3): IMove[][] {
  return genLegalMoves(position).slice(0, count).map((raw) => {
    const next = structuredClone(position);
    const moves = [toDetailedMove(next, raw)];
    applyMove(next, moves[0]!);
    for (let ply = 1; ply < 4; ply += 1) {
      const reply = genLegalMoves(next)[0];
      if (!reply) break;
      const move = toDetailedMove(next, reply);
      moves.push(move);
      applyMove(next, move);
    }
    return moves;
  });
}
export class ScriptedEngine extends JourneyEmitter implements ISpawnedProcess {
  readonly stdout = new JourneyEmitter() as unknown as NodeJS.ReadableStream;
  readonly stderr = new JourneyEmitter() as unknown as NodeJS.ReadableStream;
  readonly stdin = { write: (chunk: string) => { this.command(chunk.trim()); return true; } } as unknown as NodeJS.WritableStream;
  private _position = createInitialBoardPosition();
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _searching = false;
  private _closed = false;
  private _multiPv = 3;
  constructor(private readonly _path: string) {
    super();
    queueMicrotask(() => {
      if (['journey://a', 'journey://b'].includes(_path)) this.emit('spawn');
      else this.emit('error', new Error(`Scripted engine unavailable: ${_path}`));
    });
  }
  kill(): boolean {
    clearTimeout(this._timer);
    if (!this._closed) queueMicrotask(() => this.emit('exit', 0, null));
    this._closed = true;
    return true;
  }
  private output(line: string): void {
    if (!this._closed) (this.stdout as unknown as JourneyEmitter).emit('data', `${line}\n`);
  }
  private command(command: string): void {
    if (this._closed) return;
    if (command === 'uci') queueMicrotask(() => {
      this.output(`id name Journey ${this._path.endsWith('b') ? 'B' : 'A'}`);
      this.output('option name MultiPV type spin default 3 min 1 max 3');
      this.output('option name Hash type spin default 16 min 1 max 128');
      this.output('uciok');
    });
    else if (command === 'isready') queueMicrotask(() => this.output('readyok'));
    else if (command.startsWith('position ')) this.setPosition(command);
    else if (command.startsWith('setoption name MultiPV value ')) this._multiPv = Math.min(3, Math.max(1, Number(command.slice(command.lastIndexOf(' ') + 1))));
    else if (command.startsWith('go')) this.search(command.includes('infinite'));
    else if (command === 'stop' && this._searching) this.finishSearch();
    else if (command === 'quit') this.kill();
  }
  private setPosition(command: string): void {
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
  private search(infinite: boolean): void {
    clearTimeout(this._timer);
    this._searching = true;
    this._timer = setTimeout(() => {
      createVariations(this._position, this._multiPv).forEach((pv, index) => {
        const score = (this._path.endsWith('b') ? 36 : 24) - index * 18;
        this.output(`info depth 12 multipv ${index + 1} score cp ${score} pv ${pv.map(getUci).join(' ')}`);
      });
      if (!infinite) this.finishSearch();
    }, 150);
  }
  private finishSearch(): void {
    clearTimeout(this._timer);
    this._searching = false;
    const move = genLegalMoves(this._position)[0];
    queueMicrotask(() => this.output(`bestmove ${move ? getUci(move) : '(none)'}`));
  }
}

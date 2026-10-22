import { MoveKind, PauseReason, PieceKind, PlayerColour, PlayerType, ResultReason, ResultState, type IMove, type IPremove } from '@/contracts';
import { blackChain, blockedTail, captureSource, castlePosition, checkingReply, premove, promotionPosition, whiteChain, type IPositionFixture } from './PremoveFixture';

export interface IPremoveExpected {
  actual?: readonly string[];
  rendered?: readonly string[];
  queue?: readonly IPremove[];
  searches?: number;
  result?: ResultState;
  reason?: ResultReason;
  paused?: readonly PauseReason[];
  active?: PlayerColour;
  whiteMs?: number;
  blackMs?: number;
  running?: boolean;
  actualPieces?: Record<string, string | undefined>;
  renderedPieces?: Record<string, string | undefined>;
  unchanged?: readonly ('canonical' | 'clock' | 'queue' | 'rendered' | 'searches')[];
  selectedAttached?: boolean;
  lastMove?: Partial<IMove>;
  branches?: Array<{ path: number[]; moves: string[] }>;
}
export interface IPremoveEvent {
  action: 'append' | 'move' | 'reply' | 'lateReply' | 'analyse' | 'exit' | 'navigate' | 'pause' | 'resume' | 'undo' | 'clear' | 'takeBack' | 'reassign' | 'unassign' | 'timeout' | 'resign' | 'draw' | 'restore' | 'setup' | 'save' | 'tick' | 'remember';
  uci?: string;
  intent?: IPremove;
  path?: number[];
  reason?: PauseReason;
  colour?: PlayerColour;
  type?: PlayerType;
  name?: string;
  ms?: number;
  rejected?: boolean;
  expected?: IPremoveExpected;
}
export interface IPremoveScenario {
  id: string;
  name: string;
  local?: PlayerColour;
  seats?: 'hotseat' | 'engines';
  root?: IPositionFixture;
  played?: readonly string[];
  queue?: readonly IPremove[];
  clonePlayer?: boolean;
  allowTakeback?: boolean;
  increment?: number;
  events: readonly IPremoveEvent[];
  expected: IPremoveExpected;
}
const q = whiteChain;
export const premoveScenarios: IPremoveScenario[] = [
  { id: 'PRE-S01', name: 'appends both White intentions without committing or restarting its opponent', events: [
    { action: 'append', intent: q[0] }, { action: 'append', intent: q[1] },
  ], expected: { actual: ['e2e4'], queue: q, searches: 1, unchanged: ['canonical', 'clock', 'rendered'] } },
  { id: 'PRE-S01', name: 'appends a Black sequence before its first actual move', local: PlayerColour.Black, played: [], events: [
    { action: 'append', intent: blackChain[0] }, { action: 'append', intent: blackChain[1] },
  ], expected: { actual: [], queue: blackChain, searches: 1, unchanged: ['canonical', 'clock'] } },
  { id: 'PRE-S01', name: 'invalid new append preserves the previously accepted valid FIFO', queue: q, events: [
    { action: 'append', intent: premove('g5e4'), rejected: true },
  ], expected: { actual: ['e2e4'], queue: q, searches: 1, unchanged: ['canonical', 'clock', 'queue'] } },
  { id: 'PRE-S02', name: 'consumes only Nf3 then Undo removes Ng5 without undoing actual play', queue: q, events: [
    { action: 'reply', uci: 'e7e5', expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!], searches: 2 } }, { action: 'undo' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: undefined, actualPieces: { f3: 'white knight', g1: undefined } } },
  { id: 'PRE-S02', name: 'executes Black intentions one per actual Black turn', local: PlayerColour.Black, played: [], queue: blackChain, events: [
    { action: 'reply', uci: 'e2e4', expected: { actual: ['e2e4', 'g8f6'], queue: [blackChain[1]!], searches: 2 } },
    { action: 'reply', uci: 'd2d4' },
  ], expected: { actual: ['e2e4', 'g8f6', 'd2d4', 'f6g4'], queue: undefined, searches: 3, whiteMs: 64000, blackMs: 64000 } },
  { id: 'PRE-S03', name: 'Clear and repeated empty edits never change canonical data', queue: q, events: [
    { action: 'clear' }, { action: 'clear' }, { action: 'undo' },
  ], expected: { queue: undefined, unchanged: ['canonical', 'clock', 'rendered', 'searches'] } },
  { id: 'PRE-S03', name: 'Undo removes only the last dependency and keeps its first intention', queue: q, events: [{ action: 'undo' }],
    expected: { queue: [q[0]!], unchanged: ['canonical', 'clock', 'rendered', 'searches'] } },
  { id: 'PRE-S04', name: 'a queued castle records the actual king and rook movement', root: castlePosition, played: [],
    queue: [premove('e1g1', PieceKind.King)], events: [{ action: 'reply', uci: 'h7h6' }],
    expected: { actual: ['h7h6', 'e1g1'], queue: undefined, searches: 2, lastMove: { kind: MoveKind.Castle },
      actualPieces: { e1: undefined, h1: undefined, g1: 'white king', f1: 'white rook' } } },
  ...(['q', 'r', 'b', 'n'] as const).map((letter): IPremoveScenario => {
    const intent = premove(`a7a8${letter}`, PieceKind.Pawn);
    return { id: 'PRE-S04', name: `commits exact queued promotion ${letter}`, root: promotionPosition, played: [], queue: [intent],
      events: [{ action: 'reply', uci: 'h7h6' }], expected: { actual: ['h7h6', `a7a8${letter}`], queue: undefined, searches: 2,
        lastMove: { kind: MoveKind.Promotion, promotionPiece: intent.promotionPiece }, actualPieces: { a7: undefined, a8: `white ${intent.promotionPiece}` } } };
  }),
  { id: 'PRE-S04', name: 'a real double push creates the queued en-passant opportunity', played: ['e2e4', 'a7a6', 'e4e5'],
    queue: [premove('e5d6', PieceKind.Pawn)], events: [{ action: 'reply', uci: 'd7d5' }],
    expected: { actual: ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6'], queue: undefined, searches: 2,
      lastMove: { kind: MoveKind.EnPassant, capturePiece: PieceKind.Pawn }, actualPieces: { e5: undefined, d5: undefined, d6: 'white pawn' } } },
  { id: 'PRE-S04', name: 'queued capture details come from the actual reply rather than a speculative move', played: [],
    root: { pieces: [['e1', PlayerColour.White, PieceKind.King], ['g1', PlayerColour.White, PieceKind.Knight], ['e8', PlayerColour.Black, PieceKind.King], ['f8', PlayerColour.Black, PieceKind.Rook], ['h7', PlayerColour.Black, PieceKind.Pawn]] },
    queue: q, events: [{ action: 'reply', uci: 'f8f3' }], expected: { actual: ['f8f3', 'g1f3'], queue: [q[1]!], searches: 2,
      lastMove: { movingPiece: PieceKind.Knight, capturePiece: PieceKind.Rook }, actualPieces: { g1: undefined, f3: 'white knight' } } },
  { id: 'PRE-S05', name: 'Analyse detaches the canonical position and retains the live queue/search', queue: q,
    events: [{ action: 'analyse' }], expected: { actual: ['e2e4'], rendered: ['e2e4'], queue: q, searches: 1, renderedPieces: { g1: 'white knight', g5: undefined }, unchanged: ['clock', 'queue'] } },
  { id: 'PRE-S05', name: 'ordinary history selection preserves the queue without entering exploration', queue: q,
    events: [{ action: 'navigate', path: [] }], expected: { actual: ['e2e4'], rendered: [], queue: q, searches: 1, unchanged: ['clock', 'queue'] } },
  { id: 'PRE-S06', name: 'matching exploratory coordinates do not consume the actual FIFO', queue: q, events: [
    { action: 'analyse' }, { action: 'move', uci: 'e7e5' }, { action: 'move', uci: 'g1f3' }, { action: 'remember' },
    { action: 'reply', uci: 'e7e5' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], rendered: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!], searches: 2, selectedAttached: true, unchanged: ['rendered'] } },
  { id: 'PRE-S07', name: 'Exit before the reply never executes, replays or discards pending intentions', queue: q, events: [
    { action: 'analyse' }, { action: 'exit', expected: { actual: ['e2e4'], queue: q, searches: 1 } }, { action: 'exit' }, { action: 'reply', uci: 'e7e5' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!], searches: 2 } },
  ...(['analysis', 'review'] as const).map((mode): IPremoveScenario => ({ id: 'PRE-S08', name: `drains three local turns behind ${mode}`, queue: [...q, premove('f1c4', PieceKind.Bishop)], events: [
    mode === 'analysis' ? { action: 'analyse' } : { action: 'navigate', path: [] }, { action: 'remember' },
    { action: 'reply', uci: 'e7e5', expected: { actual: ['e2e4', 'e7e5', 'g1f3'], searches: 2 } },
    { action: 'reply', uci: 'b8c6', expected: { actual: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f3g5'], searches: 3 } },
    { action: 'reply', uci: 'g8f6', expected: { queue: undefined, searches: 4 } }, { action: 'reply', uci: 'd7d6' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f3g5', 'g8f6', 'f1c4', 'd7d6'], queue: undefined, searches: 4,
    whiteMs: 66000, blackMs: 68000, active: PlayerColour.White, running: true, unchanged: ['rendered'] } })),
  { id: 'PRE-S09', name: 'a real capture of the intended source clears every remaining intention', root: captureSource, played: [],
    queue: [premove('c3d5'), premove('d5f6')], events: [{ action: 'reply', uci: 'b4c3' }], expected: { actual: ['b4c3'], queue: undefined, active: PlayerColour.White, searches: 1 } },
  { id: 'PRE-S09', name: 'a projected knight move cannot answer actual rook check', root: checkingReply, played: [], queue: q,
    events: [{ action: 'reply', uci: 'e8e2' }], expected: { actual: ['e8e2'], queue: undefined, active: PlayerColour.White, searches: 1 } },
  { id: 'PRE-S09', name: 'wrong source provenance clears the whole accepted sequence', queue: [premove('g1f3', PieceKind.Bishop), q[1]!],
    events: [{ action: 'reply', uci: 'e7e5' }], expected: { actual: ['e2e4', 'e7e5'], queue: undefined, searches: 1 } },
  { id: 'PRE-S09', name: 'a copied player object cannot own the current local queue', queue: q, clonePlayer: true,
    events: [{ action: 'reply', uci: 'e7e5' }], expected: { actual: ['e2e4', 'e7e5'], queue: undefined, searches: 1 } },
  ...([0, 2000] as const).flatMap((increment) => [PauseReason.Manual, PauseReason.Menu].map((first): IPremoveScenario => {
    const second = first === PauseReason.Manual ? PauseReason.Menu : PauseReason.Manual;
    return { id: 'PRE-S10', name: `holds output with ${first} removed first and ${increment} increment`, increment, queue: q, events: [
      { action: 'analyse' }, { action: 'pause', reason: first }, { action: 'pause', reason: second }, { action: 'tick', ms: 15000 },
      { action: 'reply', uci: 'e7e5', expected: { actual: ['e2e4'], queue: q, searches: 1 } },
      { action: 'resume', reason: first, expected: { actual: ['e2e4'], queue: q, paused: [second] } },
      { action: 'resume', reason: second }, { action: 'resume', reason: second },
    ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], rendered: ['e2e4'], queue: [q[1]!], paused: [], searches: 2, whiteMs: 60000 + increment, blackMs: 60000 + increment } };
  })),
  { id: 'PRE-S10', name: 'allows paused exploration while preserving held actual output and queue', queue: q, events: [
    { action: 'pause', reason: PauseReason.Manual }, { action: 'analyse' }, { action: 'move', uci: 'e7e5' },
    { action: 'reply', uci: 'e7e5' }, { action: 'resume', reason: PauseReason.Manual },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], rendered: ['e2e4', 'e7e5'], queue: [q[1]!], searches: 2 } },
  { id: 'PRE-S10', name: 'a genuine pause rejects new intentions without discarding accepted ones', queue: q, events: [
    { action: 'pause', reason: PauseReason.Manual }, { action: 'remember' }, { action: 'append', intent: premove('g5h3'), rejected: true },
  ], expected: { queue: q, paused: [PauseReason.Manual], running: false, unchanged: ['canonical', 'clock', 'queue', 'searches'] } },
  { id: 'PRE-S11', name: 'review continues execution and returning live selects the current remainder', queue: q, events: [
    { action: 'navigate', path: [] }, { action: 'reply', uci: 'e7e5', expected: { rendered: [], actual: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!] } },
    { action: 'navigate', path: [0, 0, 0] },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], rendered: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!] } },
  { id: 'PRE-S11', name: 'history input cannot append to a background queue when Takeback is disabled', queue: q, allowTakeback: false, events: [
    { action: 'navigate', path: [] }, { action: 'remember' }, { action: 'move', uci: 'd2d4', rejected: true },
  ], expected: { actual: ['e2e4'], rendered: [], queue: q, unchanged: ['canonical', 'clock', 'queue', 'searches'] } },
  ...([false, true] as const).map((allowTakeback): IPremoveScenario => ({ id: 'PRE-S12', name: `explicit historical analysis bypasses rewriting with Takeback ${allowTakeback}`, allowTakeback, queue: q,
    events: [{ action: 'navigate', path: [] }, { action: 'analyse' }, { action: 'move', uci: 'd2d4' }],
    expected: { actual: ['e2e4'], rendered: ['d2d4'], queue: q, searches: 1, unchanged: ['clock', 'queue'] } })),
  { id: 'PRE-S13', name: 'confirmed historical continuation clears the queue and rejects the cancelled provider', queue: q, events: [
    { action: 'navigate', path: [] }, { action: 'move', uci: 'd2d4', expected: { queue: undefined, actual: ['d2d4'], searches: 2 } },
    { action: 'lateReply', uci: 'e7e5' },
  ], expected: { queue: undefined, actual: ['d2d4'], searches: 2 } },
  { id: 'PRE-S14', name: 'Takeback rewinds actual play and clears the queue from an analysis selection', queue: q, events: [
    { action: 'analyse' }, { action: 'move', uci: 'e7e5' }, { action: 'takeBack' },
  ], expected: { actual: [], rendered: [], queue: undefined, active: PlayerColour.White, searches: 1 } },
  { id: 'PRE-S14', name: 'disabled Takeback does not cancel an otherwise valid queue', allowTakeback: false, queue: q,
    events: [{ action: 'takeBack', rejected: true }], expected: { queue: q, unchanged: ['canonical', 'clock', 'queue', 'searches'] } },
  { id: 'PRE-S15', name: 'normal current-side input still commits once with an empty FIFO', played: [], events: [
    { action: 'move', uci: 'e2e4' },
  ], expected: { actual: ['e2e4'], queue: undefined, searches: 1, whiteMs: 62000, blackMs: 60000 } },
  { id: 'PRE-S16', name: 'actual sibling commits preserve selected analysis as historical after Exit and restore', queue: q, events: [
    { action: 'analyse' }, { action: 'move', uci: 'c7c5' }, { action: 'remember' },
    { action: 'reply', uci: 'e7e5', expected: { actual: ['e2e4', 'e7e5', 'g1f3'], selectedAttached: true, unchanged: ['rendered'] } },
    { action: 'exit' }, { action: 'restore' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: undefined, selectedAttached: true } },
  { id: 'PRE-S16', name: 'existing own-current-parent pruning remains when Exit precedes actual reply', queue: q, events: [
    { action: 'analyse' }, { action: 'move', uci: 'c7c5' }, { action: 'exit' }, { action: 'reply', uci: 'e7e5' },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!], searches: 2, branches: [{ path: [0], moves: ['e7e5'] }] } },
  { id: 'PRE-S17', name: 'hotseat rejects former White input after handing over to Black', seats: 'hotseat', played: [], events: [
    { action: 'move', uci: 'e2e4' }, { action: 'append', intent: q[0], rejected: true }, { action: 'move', uci: 'e7e5' },
  ], expected: { actual: ['e2e4', 'e7e5'], queue: undefined, searches: 0 } },
  { id: 'PRE-S17', name: 'engine-engine games reject all local premove submissions', seats: 'engines', played: [], events: [
    { action: 'append', intent: q[0], rejected: true },
  ], expected: { actual: [], queue: undefined, searches: 1 } },
  { id: 'PRE-S19', name: 'a Menu interruption retains the queue until its real Resume', queue: q, events: [
    { action: 'pause', reason: PauseReason.Menu }, { action: 'save' }, { action: 'reply', uci: 'e7e5', expected: { actual: ['e2e4'], queue: q } },
    { action: 'resume', reason: PauseReason.Menu },
  ], expected: { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [q[1]!], searches: 2 } },
  { id: 'PRE-S20', name: 'an unprojectable tail clears the legal head before it can execute', root: blockedTail, played: [],
    queue: [q[0]!, premove('f1c4', PieceKind.Bishop)], events: [{ action: 'reply', uci: 'd8d3' }],
    expected: { actual: ['d8d3'], queue: undefined, active: PlayerColour.White, searches: 1, actualPieces: { g1: 'white knight', f3: undefined } } },
  ...(['reassign', 'unassign', 'setup', 'resign', 'draw', 'timeout'] as const).map((action): IPremoveScenario => ({ id: 'PRE-S21', name: `${action} invalidates the complete live queue`, queue: q,
    events: [{ action, colour: PlayerColour.Black, type: PlayerType.Local }], expected: { queue: undefined,
      ...(action === 'timeout' ? { result: ResultState.WhiteWon, reason: ResultReason.Timeout, running: false } : {}),
      ...(action === 'resign' ? { result: ResultState.WhiteWon, reason: ResultReason.Resignation, running: false } : {}),
      ...(action === 'draw' ? { result: ResultState.Drawn, reason: ResultReason.DrawAgreement, running: false } : {}),
    } })),
  { id: 'PRE-S21', name: 'actual checkmate clears remaining intentions and starts no successor', played: ['f2f3', 'e7e5', 'g2g4'],
    queue: [premove('b1c3'), premove('f1g2', PieceKind.Bishop)], events: [{ action: 'analyse' }, { action: 'reply', uci: 'd8h4' }],
    expected: { actual: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], queue: undefined, searches: 1, result: ResultState.BlackWon, running: false } },
  { id: 'PRE-S21', name: 'exploratory checkmate preserves the ongoing actual game and queue', played: ['f2f3', 'e7e5', 'g2g4'], queue: q,
    events: [{ action: 'analyse' }, { action: 'move', uci: 'd8h4' }],
    expected: { actual: ['f2f3', 'e7e5', 'g2g4'], rendered: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], queue: q, searches: 1, result: ResultState.Ongoing, unchanged: ['clock', 'queue'] } },
  { id: 'PRE-S21', name: 'schema-equal reassignment preserves queue and original search', queue: q,
    events: [{ action: 'reassign', colour: PlayerColour.Black, type: PlayerType.Engine }], expected: { queue: q, searches: 1, unchanged: ['canonical', 'clock', 'queue'] } },
  { id: 'PRE-S21', name: 'late output cannot revive a queue after actual cancellation', queue: q, events: [
    { action: 'unassign', colour: PlayerColour.Black }, { action: 'lateReply', uci: 'e7e5' },
  ], expected: { queue: undefined, actual: [], searches: 1, running: false } },
  { id: 'PRE-S22', name: 'save/export preserves original FIFO but loaded runtime has none', queue: q,
    events: [{ action: 'save', expected: { queue: q, unchanged: ['canonical', 'clock', 'queue', 'searches'] } }, { action: 'restore' }],
    expected: { actual: ['e2e4'], rendered: ['e2e4'], queue: undefined } },
  { id: 'PRE-S23', name: 'immediate reply after equal-path analysis entry cannot move selected pieces', queue: q,
    events: [{ action: 'analyse' }, { action: 'remember' }, { action: 'reply', uci: 'e7e5' }],
    expected: { actual: ['e2e4', 'e7e5', 'g1f3'], rendered: ['e2e4'], queue: [q[1]!], searches: 2,
      renderedPieces: { g1: 'white knight', f3: undefined }, unchanged: ['rendered'] } },
  { id: 'PRE-S24', name: 'exploring on the actual local turn cannot prevent its clock expiring', local: PlayerColour.Black, played: ['e2e4'], events: [
    { action: 'analyse' }, { action: 'move', uci: 'e7e5' }, { action: 'timeout' }, { action: 'exit' }, { action: 'resume', reason: PauseReason.Manual },
  ], expected: { actual: ['e2e4'], queue: undefined, result: ResultState.WhiteWon, reason: ResultReason.Timeout, running: false } },
  { id: 'PRE-S24', name: 'exact expiry wins over a legal queued head and gives no increment', queue: q, events: [
    { action: 'tick', ms: 60000 }, { action: 'reply', uci: 'e7e5' },
  ], expected: { actual: ['e2e4'], queue: undefined, result: ResultState.WhiteWon, reason: ResultReason.Timeout, running: false, blackMs: 0 } },
  { id: 'PRE-S25', name: 'legacy paused analysis restores empty with Manual only and resumes without Exit', queue: q, events: [
    { action: 'analyse' }, { action: 'pause', reason: PauseReason.Manual }, { action: 'restore', expected: { queue: undefined, paused: [PauseReason.Manual], running: false } },
    { action: 'pause', reason: PauseReason.Menu }, { action: 'resume', reason: PauseReason.Menu, expected: { paused: [PauseReason.Manual], running: false } },
    { action: 'resume', reason: PauseReason.Manual },
  ], expected: { actual: ['e2e4'], rendered: ['e2e4'], queue: undefined, paused: [], running: true } },
];

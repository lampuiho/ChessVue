import { GameState, PieceKind, PlayerColour, ResultReason, ResultState, TimeControlPreset } from '@/contracts';
import { createSparseBoard } from '@/utility/chess';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { appendMoves } from '../../../builders/HistoryFixtureBuilder';
import { setPausedClock } from '../../../builders/ClockFixtureBuilder';
import { fixtureTimestamp } from '../../../data/FixtureTimestamp';
export const workspaceKinds = ['free', 'edit', 'nested', 'promotion', 'timed', 'finished'] as const;
export function createWorkspaceSnapshots() {
  const free = createGame('snapshot-free', 'Free study', ['d2d4', 'd7d5'], { freeAnalysis: true });
  const edit = createGame('snapshot-edit', 'Edited board', [], { freeAnalysis: true, state: GameState.BoardEdit });
  edit.rootPosition.board[8] = undefined;
  const nested = createGame('snapshot-nested', 'Nested history', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  const branch = appendMoves(nested, [0, 0], ['f1c4', 'g8f6', 'd2d3']);
  nested.renderedPath = appendMoves(nested, branch.slice(0, -1), ['b1c3']);
  const promotion = _createPromotionSnapshot();
  const timed = createGame('snapshot-timed', 'Paused timed game', ['e2e4', 'e7e5'], {
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 120000, incrementMs: 2000 },
  });
  setPausedClock(timed, 117000, Date.parse(fixtureTimestamp));
  const finished = createGame('snapshot-finished', 'Finished game', ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  finished.resultState = ResultState.BlackWon;
  finished.resultReason = ResultReason.RuleResolved;
  return [free, edit, nested, promotion, timed, finished];
}
function _createPromotionSnapshot() {
  return createGame('snapshot-promotion', 'Promoted rook', ['a7a8r'], {
    rootPosition: createSparseBoard([
      { boardId: 4, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: 60, piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: 48, piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
    ]),
  });
}

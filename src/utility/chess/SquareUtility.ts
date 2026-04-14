import { PlayerColour, type BoardId } from '@/contracts';

const _fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function isBoardId(value: unknown): value is BoardId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 63;
}
export function boardIdToCoords(boardId: BoardId): { file: number; rank: number } {
  return {
    file: boardId % 8,
    rank: Math.floor(boardId / 8),
  };
}
export function coordsToBoardId(file: number, rank: number): BoardId | undefined {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return;
  return (rank * 8) + file;
}
export function boardIdToNotation(boardId: BoardId): string {
  const { file, rank } = boardIdToCoords(boardId);
  return `${_fileNames[file]}${rank + 1}`;
}
export function getForwardDirection(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 1 : -1;
}
export function getPawnHomeRank(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 1 : 6;
}
export function getPromotionRank(colour: PlayerColour): number {
  return colour === PlayerColour.White ? 7 : 0;
}

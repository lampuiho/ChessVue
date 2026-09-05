import type { IGame } from '../Game';

export type GameRestoreOutcome =
  | { gameId: string; status: 'restored'; game: IGame }
  | { gameId: string; status: 'failed'; error: unknown };

import type { IGameSessionSnapshot } from '@/contracts';

export interface IJourneyFile {
  path: string;
  raw: string;
  modifiedAt?: number;
}
export interface IJourneySeed {
  files: IJourneyFile[];
  gameIds: string[];
  activeRoute: IGameSessionSnapshot['activeRoute'];
}
export interface IJourneyDescription {
  title: string;
  scenarios: string[];
  steps: string[];
}
export interface IJourneyApi extends IJourneyDescription {
  name: string;
  gameIds: string[];
  ready: boolean;
  listFiles(): string[];
  readFile(path: string): string | undefined;
  changeFile(path: string, raw: string | null): void;
  chooseImport(path: string | null): void;
  chooseExport(path: string | null): void;
  reset(): void;
}
declare global {
  const __CHESSVUE_JOURNEY_RUN__: { name: string; id: string };
  interface Window {
    chessVueJourney: IJourneyApi;
  }
}

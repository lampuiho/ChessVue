import { PlatformError, PlatformErrorKind, type IEngineOptionMeta, type IMove } from '@/contracts';
import type { IEngineClient } from '@/contracts/platform';

export class BrowserEngineClient implements IEngineClient {
  getOptions(): readonly IEngineOptionMeta[] {
    return this._unavailable('getOptions');
  }
  async initialiseEngine(): Promise<void> { this._unavailable('initialiseEngine'); }
  async startAnalysis(): Promise<void> { this._unavailable('startAnalysis'); }
  async stopAnalysis(): Promise<void> { this._unavailable('stopAnalysis'); }
  async startPlayerTurn(): Promise<void> { this._unavailable('startPlayerTurn'); }
  async startPondering(): Promise<void> { this._unavailable('startPondering'); }
  async awaitPlayerTurnMove(): Promise<IMove> { return this._unavailable('awaitPlayerTurnMove'); }
  async stopEngine(): Promise<void> { this._unavailable('stopEngine'); }
  async restartEngine(): Promise<void> { this._unavailable('restartEngine'); }
  private _unavailable(operation: string): never {
    throw new PlatformError({ kind: PlatformErrorKind.InvalidOperation, operation, message: 'Local UCI engines require the desktop app.' });
  }
}

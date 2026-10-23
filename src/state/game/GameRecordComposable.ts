import { ref } from 'vue';
import { SaveGameTargetKind, type IGame } from '@/contracts';
import { UserSettingService } from '@/domain';
import { RecordTimestamp } from '@/utility/date';
import { useSavedGamesStore } from '../SavedGamesStore';

export function useGameRecord() {
  const autosaveError = ref('');
  const _autosaveFailureListeners = new Set<(message: string) => void>();
  function onAutosaveFailed(listener: (message: string) => void) {
    _autosaveFailureListeners.add(listener);
    return () => { _autosaveFailureListeners.delete(listener); };
  }
  const _moveCounts = new WeakMap<IGame, number>();
  let _autosaveQueue = Promise.resolve();
  function moveCommitted(game: IGame) {
    const interval = UserSettingService.getSettings().gameSession.autosaveAfterMoveCount;
    const count = (_moveCounts.get(game) ?? 0) + 1;
    _moveCounts.set(game, interval > 0 ? count % interval : 0);
    if (interval <= 0 || count < interval) return;
    _autosaveQueue = _autosaveQueue.then(async () => {
      await useSavedGamesStore().saveGame(game, { targetKind: SaveGameTargetKind.Autosave });
      autosaveError.value = '';
    }).catch((error: unknown) => {
      autosaveError.value = error instanceof Error ? error.message : 'Automatic save failed.';
      for (const listener of _autosaveFailureListeners) listener(autosaveError.value);
    });
  }
  function timestampGame(game: IGame) {
    game.metadata.updatedAt = new RecordTimestamp();
  }
  return { autosaveError, onAutosaveFailed, moveCommitted, timestampGame };
}
export type GameRecordComposable = ReturnType<typeof useGameRecord>;

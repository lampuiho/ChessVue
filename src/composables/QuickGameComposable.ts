import { onScopeDispose, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { PlayerType, type ICreateGameRequest, type IEnginePlayer } from '@/contracts';
import { EngineRuntimeService } from '@/domain';
import { copyGameRequest, getGameCreationError } from '@/utility/GameCreationUtility';
import { useGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import { OperationOwner } from '@/utility/async/OperationOwner';
import { abortable } from '@/utility/async/Abortable';
export function useQuickGame() {
  const router = useRouter();
  const gamesStore = useGamesStore();
  const settingsStore = useSettingsStore();
  const uiStateStore = useUiStateStore();
  const work = new OperationOwner();
  const isWorking = ref(false);
  const errorMessage = ref('');
  onBeforeRouteLeave(_cancel);
  onBeforeRouteUpdate(_cancel);
  onScopeDispose(() => { void work.dispose(); });
  function _cancel() { void work.cancel(); }
  async function start() {
    const defaults = settingsStore.settings?.gameDefaults;
    if (isWorking.value || !defaults) return;
    isWorking.value = true;
    errorMessage.value = '';
    try {
      const error = getGameCreationError(defaults);
      if (error) throw new Error(error);
      const request = copyGameRequest(defaults);
      if (!request.whitePlayer || !request.blackPlayer) request.showLiveAnalysisMoves = true;
      await work.run(async (signal) => {
        await _validateRequiredEngines(request, signal);
        signal.throwIfAborted();
        const game = await abortable(gamesStore.createGame(request), signal);
        signal.throwIfAborted();
        uiStateStore.openTab(game.metadata.id);
        await router.push(`/game/${game.metadata.id}`);
      });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'The game could not be created.';
    } finally { isWorking.value = false; }
  }
  async function _validateRequiredEngines(request: ICreateGameRequest, signal: AbortSignal) {
    if (!request.whitePlayer || !request.blackPlayer) return;
    for (const player of [request.whitePlayer, request.blackPlayer]) {
      if (player.type !== PlayerType.Engine) continue;
      signal.throwIfAborted();
      const assigned = (player as IEnginePlayer).assignedEngine;
      try { await EngineRuntimeService.getOptions({ ...assigned, id: player.colour }); }
      catch { throw new Error(`${assigned.displayName} is unavailable. Edit game defaults and try again.`); }
    }
  }
  return { start, isWorking, errorMessage };
}

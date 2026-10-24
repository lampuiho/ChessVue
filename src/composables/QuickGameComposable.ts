import { onScopeDispose, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { PlayerColour, PlayerType, type ICreateGameRequest } from '@/contracts';
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
    const request: ICreateGameRequest = {
      name: defaults.quickNewGameName,
      whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
      blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
      analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: false,
      timeControl: { ...defaults.defaultTimeControl },
    };
    isWorking.value = true;
    errorMessage.value = '';
    try {
      await work.run(async (signal) => {
        const game = await abortable(gamesStore.createGame(request), signal);
        signal.throwIfAborted();
        uiStateStore.openTab(game.metadata.id);
        await router.push(`/game/${game.metadata.id}`);
      });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'The game could not be created.';
    } finally { isWorking.value = false; }
  }
  return { start, isWorking, errorMessage };
}

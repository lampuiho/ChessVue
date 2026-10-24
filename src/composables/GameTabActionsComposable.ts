import { useRouter } from 'vue-router';
import type { IGame } from '@/contracts';
import { useGamesStore, useUiStateStore } from '@/state';
export function useGameTabActions() {
  const router = useRouter();
  const gamesStore = useGamesStore();
  const uiStateStore = useUiStateStore();
  const closingIds = new Set<string>();
  function select(id: string) {
    return router.push(`/game/${id}`);
  }
  async function close(id: string) {
    if (closingIds.has(id) || !uiStateStore.gameSession?.openGameIds.includes(id)) return;
    closingIds.add(id);
    try {
      const game = gamesStore.getGame(id) as IGame | undefined;
      if (game) gamesStore.clearPremoves(game);
      uiStateStore.closeTab(id);
      const activeId = uiStateStore.gameSession?.activeGameId;
      await router.push(activeId ? `/game/${activeId}` : '/home');
    } finally { closingIds.delete(id); }
  }
  return { select, close };
}

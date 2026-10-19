import { computed, createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { prepareJourney } from './PrepareJourney';

export async function startJourney(run: { name: string; id: string }) {
  const { api, installDialogs } = await prepareJourney(run);
  const [{ default: App }, { default: router }, { usePlatformService }, stores] = await Promise.all([
    import('@/App.vue'), import('@/router'), import('@/platform'), import('@/state'),
  ]);
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  installDialogs(usePlatformService().getStorageAdapter());
  app.use(router);
  await router.isReady();
  app.mount('#app');
  const settings = stores.useSettingsStore();
  const ui = stores.useUiStateStore();
  const games = stores.useGamesStore();
  const ready = computed(() => {
    void games.workspaceRevision;
    return !!settings.settings && !!ui.layoutState && !!ui.gameSession
      && ui.gameSession.openGameIds.every((id) => !!games.getGame(id))
      && router.currentRoute.value.path === ui.gameSession.activeRoute;
  });
  Object.defineProperty(api, 'ready', { get: () => ready.value, configurable: true });
  const stopReady = () => { Object.defineProperty(api, 'ready', { value: false, writable: true, configurable: true }); };
  app.onUnmount(() => { stopReady(); disposePinia(pinia); });
  console.info(`[journey:${api.name}] ${api.title}`, { gameIds: api.gameIds, scenarios: api.scenarios, steps: api.steps });
  return { api, app, router, games, stopReady };
}

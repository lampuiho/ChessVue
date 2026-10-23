<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { ThemeMode, type IThemeProfileSnapshot } from '@/contracts';
import { getPlatformTarget, PlatformTarget } from '@/utility/nwjs/NwjsUtility';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { useGamesStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import { useModalProvider } from '@/composables/ModalComposable';

useModalProvider();
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const gamesStore = useGamesStore();
const savedGamesStore = useSavedGamesStore();
const { appearanceProjection, settings } = storeToRefs(settingsStore);
const { gameSession, layoutState } = storeToRefs(uiStateStore);
const appViewportRemCount = 50;
const startupComplete = ref(false);
const warningDismissed = ref(false);
const sessionSaveError = ref('');
const isReady = computed(() => startupComplete.value && !!settings.value && !!gameSession.value && !!layoutState.value);
const recoveryWarnings = computed(() => [settingsStore.recoveryWarning, ...uiStateStore.recoveryWarnings, sessionSaveError.value].filter(Boolean));
function _applyThemeProfile(root: HTMLElement, profile: IThemeProfileSnapshot) {
  for (const [name, value] of Object.entries(profile.cssVariables)) {
    root.style.setProperty(`--theme-${profile.colourScheme}-${name.slice(2)}`, value);
  }
}
function _applyAppearance() {
  const root = document.documentElement;
  const lightProfile = appearanceProjection.value?.lightThemeProfile ?? defaultLightThemeProfile;
  const darkProfile = appearanceProjection.value?.darkThemeProfile ?? defaultDarkThemeProfile;
  const themeMode = appearanceProjection.value?.themeMode ?? settings.value?.appearance.themeMode ?? ThemeMode.System;
  const scale = settings.value?.appearance.uiScalePercent ?? 100;
  _applyThemeProfile(root, lightProfile);
  _applyThemeProfile(root, darkProfile);
  root.style.setProperty('--root-font-size-browser', `${scale}%`);
  root.style.setProperty('--root-font-size-landscape', `${scale / appViewportRemCount}vh`);
  root.style.setProperty('--root-font-size-portrait', `${scale / appViewportRemCount}vw`);
  root.dataset.themeMode = themeMode;
  root.dataset.appMode = String(getPlatformTarget() === PlatformTarget.Nwjs);
  const colourSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colourSchemeMeta) colourSchemeMeta.content = themeMode === ThemeMode.System ? 'light dark' : themeMode;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const profile = themeMode === ThemeMode.Dark || (themeMode === ThemeMode.System && meta.media === '(prefers-color-scheme: dark)') ? darkProfile : lightProfile;
    meta.content = profile.cssVariables['--surface-app'];
  });
}
_applyAppearance();

async function _restoreWorkspace() {
  if (!gameSession.value) return;
  const requestedIds = [...gameSession.value.openGameIds];
  if (!settings.value?.gameSession.restorePreviousSession) {
    for (const id of requestedIds) uiStateStore.closeTab(id);
    uiStateStore.setActiveRoute('/home');
    return;
  }
  const outcomes = await savedGamesStore.restoreGames(requestedIds).catch(() => []);
  for (const outcome of outcomes) {
    if (outcome.status !== 'restored') continue;
    try {
      await gamesStore.insertGame(outcome.game);
    } catch {
      uiStateStore.addRecoveryWarning(`Could not restore ${outcome.gameId}. Its saved files remain available in Saved games.`);
    }
  }
  const restoredIds = new Set(gamesStore.listGames().map((game) => game.metadata.id));
  for (const gameId of requestedIds) {
    if (!restoredIds.has(gameId)) {
      uiStateStore.closeTab(gameId);
      uiStateStore.addRecoveryWarning(`Could not restore ${gameId}. Open Saved games to choose another snapshot.`);
    }
  }
}
function _isCommittedRoute(path: string): path is NonNullable<typeof gameSession.value>['activeRoute'] {
  return /^\/home$|^\/game\/.+$|^\/saved-games\/load(?:\/.+)?$|^\/saved-games\/save\/.+$|^\/settings\/(session|gameplay|appearance|engines)$/.test(path);
}
async function _saveSession() {
  try {
    await uiStateStore.saveGameSession();
    sessionSaveError.value = '';
  } catch {
    sessionSaveError.value = 'Your session could not be saved. Your open games are still available; navigate again to retry.';
    warningDismissed.value = false;
  }
}

onMounted(async () => {
  await Promise.all([settingsStore.loadSettings(), uiStateStore.loadGameSession(), uiStateStore.loadLayoutState()]);
  _applyAppearance();
  await _restoreWorkspace();
  const restoredRoute = gameSession.value?.activeRoute;
  await savedGamesStore.registerAutosaveOnClose(() => gamesStore.listGames() as never);
  const directRoute = window.location.pathname;
  if ((directRoute === '/' || directRoute === '/home') && restoredRoute && restoredRoute !== '/home' && _isCommittedRoute(restoredRoute)) await router.replace(restoredRoute);
  if (route.name === 'game' && !gamesStore.getGame(String(route.params.id))) {
    const fallbackId = gameSession.value?.openGameIds.find((id) => gamesStore.getGame(id));
    await router.replace(fallbackId ? `/game/${fallbackId}` : '/home');
  }
  if (_isCommittedRoute(route.path)) {
    if (route.name === 'game') uiStateStore.setActiveGame(String(route.params.id));
    else uiStateStore.setActiveRoute(route.path);
  }
  startupComplete.value = true;
  await _saveSession();
});
const removeRouteCheckpoint = router.afterEach((to, from, failure) => {
  const path = to.path;
  if (failure || to.path === from.path || !isReady.value || !_isCommittedRoute(path)) return;
  if (path.startsWith('/game/')) uiStateStore.setActiveGame(path.slice('/game/'.length));
  else uiStateStore.setActiveRoute(path);
  void _saveSession();
});
onScopeDispose(removeRouteCheckpoint);
</script>

<template>
  <div v-if="!isReady" class="app-loading">
    <div class="loading-mark"><span class="loading-mark__piece">♞</span><span>Preparing your board…</span></div>
  </div>
  <RouterView v-else @appearance-changed="_applyAppearance" />
  <aside v-if="isReady && recoveryWarnings.length && !warningDismissed" class="recovery-notice" role="alert"><p v-for="warning in recoveryWarnings" :key="warning">{{ warning }}</p><div><button class="text-button" @click="router.push('/saved-games/load')">Saved games</button><button class="text-button" @click="router.push('/settings/session')">Settings</button><button class="text-button" @click="warningDismissed = true">Dismiss</button></div></aside>
</template>

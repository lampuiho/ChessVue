<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { ResolvedThemeMode, ThemeMode, type IThemeProfileSnapshot } from '@/contracts';
import { getPlatformTarget, PlatformTarget } from '@/utility/nwjs/NwjsUtility';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { useGamesStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import ModalHost from '@/components/ModalHost.vue';

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
const resolvedThemeMode = computed(() => {
  if (appearanceProjection.value?.resolvedThemeMode) return appearanceProjection.value.resolvedThemeMode;
  if (settings.value?.appearance.themeMode === ThemeMode.Dark) return ResolvedThemeMode.Dark;
  if (settings.value?.appearance.themeMode === ThemeMode.Light) return ResolvedThemeMode.Light;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light;
});
function applyThemeProfile(root: HTMLElement, profile: IThemeProfileSnapshot) {
  for (const [name, value] of Object.entries(profile.cssVariables)) {
    root.style.setProperty(`--theme-${profile.colourScheme}-${name.slice(2)}`, value);
  }
}
// Output-only bridge to document chrome; appearance changes can originate from the host theme.
watch([appearanceProjection, () => settings.value?.appearance, resolvedThemeMode], () => {
  const root = document.documentElement;
  const mode = resolvedThemeMode.value;
  const lightProfile = appearanceProjection.value?.lightThemeProfile ?? defaultLightThemeProfile;
  const darkProfile = appearanceProjection.value?.darkThemeProfile ?? defaultDarkThemeProfile;
  const themeMode = appearanceProjection.value?.themeMode ?? settings.value?.appearance.themeMode ?? ThemeMode.System;
  const scale = settings.value?.appearance.uiScalePercent ?? 100;
  applyThemeProfile(root, lightProfile);
  applyThemeProfile(root, darkProfile);
  root.style.setProperty('--root-font-size-browser', `${scale}%`);
  root.style.setProperty('--root-font-size-landscape', `${scale / appViewportRemCount}vh`);
  root.style.setProperty('--root-font-size-portrait', `${scale / appViewportRemCount}vw`);
  root.dataset.theme = mode;
  root.dataset.themeMode = themeMode;
  root.dataset.appMode = String(getPlatformTarget() === PlatformTarget.Nwjs);
  const colourSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colourSchemeMeta) colourSchemeMeta.content = themeMode === ThemeMode.System ? 'light dark' : themeMode;
  const themeColourMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColourMeta) themeColourMeta.content = (mode === ResolvedThemeMode.Light ? lightProfile : darkProfile).cssVariables['--surface-app'];
}, { immediate: true });

async function restoreWorkspace() {
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
function isCommittedRoute(path: string): path is NonNullable<typeof gameSession.value>['activeRoute'] {
  return /^\/home$|^\/game\/.+$|^\/saved-games\/load(?:\/.+)?$|^\/saved-games\/save\/.+$|^\/settings\/(session|gameplay|appearance|engines)$/.test(path);
}
async function saveSession() {
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
  await restoreWorkspace();
  const restoredRoute = gameSession.value?.activeRoute;
  await savedGamesStore.registerAutosaveOnClose(() => gamesStore.listGames() as never);
  const directRoute = window.location.pathname;
  if ((directRoute === '/' || directRoute === '/home') && restoredRoute && restoredRoute !== '/home' && isCommittedRoute(restoredRoute)) await router.replace(restoredRoute);
  if (route.name === 'game' && !gamesStore.getGame(String(route.params.id))) {
    const fallbackId = gameSession.value?.openGameIds.find((id) => gamesStore.getGame(id));
    await router.replace(fallbackId ? `/game/${fallbackId}` : '/home');
  }
  if (isCommittedRoute(route.path)) {
    if (route.name === 'game') uiStateStore.setActiveGame(String(route.params.id));
    else uiStateStore.setActiveRoute(route.path);
  }
  startupComplete.value = true;
  await saveSession();
});
const removeRouteCheckpoint = router.afterEach((to, from, failure) => {
  const path = to.path;
  if (failure || to.path === from.path || !isReady.value || !isCommittedRoute(path)) return;
  if (path.startsWith('/game/')) uiStateStore.setActiveGame(path.slice('/game/'.length));
  else uiStateStore.setActiveRoute(path);
  void saveSession();
});
onScopeDispose(removeRouteCheckpoint);
</script>

<template>
  <div class="app-root">
    <div v-if="!isReady" class="app-loading">
      <div class="loading-mark"><span class="loading-mark__piece">♞</span><span>Preparing your board…</span></div>
    </div>
    <RouterView v-else />
    <aside v-if="isReady && recoveryWarnings.length && !warningDismissed" class="recovery-notice" role="alert"><p v-for="warning in recoveryWarnings" :key="warning">{{ warning }}</p><div><button class="text-button" @click="router.push('/saved-games/load')">Saved games</button><button class="text-button" @click="router.push('/settings/session')">Settings</button><button class="text-button" @click="warningDismissed = true">Dismiss</button></div></aside>
    <ModalHost v-if="isReady" />
  </div>
</template>
<style scoped>
.recovery-notice { position: fixed; z-index: 40; right: 1rem; bottom: 1rem; width: min(32rem, calc(100vw - 2rem)); padding: 1rem; border: 0.0625rem solid var(--warning); border-radius: var(--radius-md); background: var(--surface-dialog); box-shadow: var(--shadow-sm); }
.recovery-notice p { margin: 0 0 0.5rem; font-size: 0.8rem; }
.recovery-notice > div { display: flex; justify-content: flex-end; gap: 0.4rem; }
</style>

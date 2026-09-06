<script setup lang="ts">
import { computed, onMounted, watch, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { ResolvedThemeMode, ThemeMode, type IThemeProfileSnapshot } from '@/contracts';
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
const isReady = computed(() => !!settings.value && !!gameSession.value && !!layoutState.value);
const resolvedThemeMode = computed(() => {
  if (appearanceProjection.value?.resolvedThemeMode) return appearanceProjection.value.resolvedThemeMode;
  if (settings.value?.appearance.themeMode === ThemeMode.Dark) return ResolvedThemeMode.Dark;
  if (settings.value?.appearance.themeMode === ThemeMode.Light) return ResolvedThemeMode.Light;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light;
});
function applyThemeProfile(root: HTMLElement, profile: IThemeProfileSnapshot): void {
  for (const [name, value] of Object.entries(profile.cssVariables)) {
    root.style.setProperty(`--theme-${profile.colourScheme}-${name.slice(2)}`, value);
  }
}
watchEffect(() => {
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
  root.dataset.appMode = String(__CHESSVUE_PLATFORM__ === 'nwjs');
  const colourSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colourSchemeMeta) colourSchemeMeta.content = themeMode === ThemeMode.System ? 'light dark' : themeMode;
  const themeColourMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColourMeta) themeColourMeta.content = (mode === ResolvedThemeMode.Light ? lightProfile : darkProfile).cssVariables['--surface-app'];
});

async function restoreWorkspace(): Promise<void> {
  if (!settings.value?.gameSession.restorePreviousSession || !gameSession.value) return;
  const requestedIds = [...gameSession.value.openGameIds];
  const outcomes = await savedGamesStore.restoreGames(requestedIds).catch(() => []);
  for (const outcome of outcomes) {
    if (outcome.status === 'restored') await gamesStore.insertGame(outcome.game);
  }
  const restoredIds = new Set(gamesStore.listGames().map((game) => game.metadata.id));
  for (const gameId of requestedIds) {
    if (!restoredIds.has(gameId)) uiStateStore.closeTab(gameId);
  }
}
function isCommittedRoute(path: string): path is NonNullable<typeof gameSession.value>['activeRoute'] {
  return /^\/home$|^\/game\/.+$|^\/saved-games\/load(?:\/.+)?$|^\/saved-games\/save\/.+$|^\/settings\/(session|gameplay|appearance|engines)$/.test(path);
}

onMounted(async () => {
  await Promise.all([settingsStore.loadSettings(), uiStateStore.loadGameSession(), uiStateStore.loadLayoutState()]);
  const restoredRoute = gameSession.value?.activeRoute;
  await restoreWorkspace();
  await savedGamesStore.registerAutosaveOnClose(() => gamesStore.listGames() as never);
  const directRoute = window.location.pathname;
  if ((directRoute === '/' || directRoute === '/home') && restoredRoute && restoredRoute !== '/home' && isCommittedRoute(restoredRoute)) await router.replace(restoredRoute);
  else if (route.name === 'game' && !gamesStore.getGame(String(route.params.id))) await router.replace('/home');
});
watch(() => route.path, (path) => {
  if (!isReady.value || !isCommittedRoute(path)) return;
  if (path.startsWith('/game/')) uiStateStore.setActiveGame(path.slice('/game/'.length));
  else uiStateStore.setActiveRoute(path);
  void uiStateStore.saveGameSession();
});
</script>

<template>
  <div class="app-root">
    <div v-if="!isReady" class="app-loading">
      <div class="loading-mark"><span class="loading-mark__piece">♞</span><span>Preparing your board…</span></div>
    </div>
    <RouterView v-else />
    <ModalHost v-if="isReady" />
  </div>
</template>

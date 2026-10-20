<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AppModalKind, PlayerColour, PlayerType, type ICreateGameRequest, type IRecentGameEntry } from '@/contracts';
import { useGamesStore, useRecentGameStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import AppIcon from '@/components/common/AppIcon.vue';

const router = useRouter();
const gamesStore = useGamesStore();
const recentGameStore = useRecentGameStore();
const savedGamesStore = useSavedGamesStore();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const recentGames = ref<IRecentGameEntry[]>([]);
const isLoadingRecent = ref(true);
const pendingGameId = ref<string>();
const errorMessage = ref('');

onMounted(refreshRecentGames);
async function refreshRecentGames() {
  try {
    recentGames.value = await recentGameStore.getRecentGames();
  } catch {
    recentGames.value = [];
  } finally {
    isLoadingRecent.value = false;
  }
}
async function quickNewGame() {
  const defaults = settingsStore.settings?.gameDefaults;
  if (!defaults) return;
  const request: ICreateGameRequest = {
    name: defaults.quickNewGameName,
    whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
    blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
    analysisEngineProfiles: [],
    showLiveAnalysisMoves: false,
    allowTakeback: true,
    timeControl: { ...defaults.defaultTimeControl },
  };
  await run(async () => {
    const game = await gamesStore.createGame(request);
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
  });
}
async function openRecent(entry: IRecentGameEntry) {
  pendingGameId.value = entry.gameId;
  try {
    errorMessage.value = '';
    const existing = gamesStore.getGame(entry.gameId);
    const game = existing ?? await gamesStore.insertGame(await savedGamesStore.loadRecentGame(entry.gameId));
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The game could not be opened.';
    await refreshRecentGames();
  } finally {
    pendingGameId.value = undefined;
  }
}
async function run(action: () => Promise<void>) {
  errorMessage.value = '';
  try {
    await action();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The action could not be completed.';
  }
}
</script>

<template>
  <main class="home-page">
    <header class="home-header">
      <div class="app-brand">
        <span class="app-brand__mark">♞</span>
        <span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Study · Play · Analyse</span></span>
      </div>
      <span class="home-header__note">A quiet place for serious chess</span>
    </header>
    <section class="home-hero" :class="{ 'home-hero--compact': recentGames.length > 0 }">
      <div class="home-intro">
        <p class="page-kicker">Your next move</p>
        <h1 class="home-title">Play the position.<br><em>See the whole game.</em></h1>
        <p class="page-description">Open a fresh board, continue a saved game, or settle in for analysis.</p>
      </div>
      <div class="home-actions" aria-label="Start actions">
        <button class="home-action home-action--primary" @click="quickNewGame"><span class="home-action__icon"><AppIcon name="sparkles" /></span><strong>Quick game</strong><small>Start with your defaults</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="uiStateStore.showModal({ kind: AppModalKind.NewGame })"><span class="home-action__icon"><AppIcon name="sliders" /></span><strong>Custom game</strong><small>Players, clock & engines</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="router.push('/saved-games/load')"><span class="home-action__icon"><AppIcon name="folder" /></span><strong>Load game</strong><small>Return to a saved board</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="router.push('/settings/session')"><span class="home-action__icon"><AppIcon name="settings" /></span><strong>Settings</strong><small>Make the board yours</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
      </div>
      <p v-if="errorMessage" class="inline-message inline-message--error home-error">{{ errorMessage }}</p>
      <section v-if="recentGames.length" class="recent-section">
        <div class="recent-section__heading"><div><p class="page-kicker">Continue</p><h2>Recent games</h2></div><button class="text-button text-button--ghost" @click="router.push('/saved-games/load')">View all <AppIcon name="arrow-right" /></button></div>
        <div class="recent-grid">
          <button v-for="entry in recentGames.slice(0, 3)" :key="entry.gameId" class="recent-card" :disabled="pendingGameId === entry.gameId" @click="openRecent(entry)">
            <span class="recent-card__piece">♟</span>
            <span class="recent-card__copy"><strong>{{ entry.displayName }}</strong><small>{{ entry.sourceKind === 'autosave' ? 'Autosaved' : 'Saved' }} · {{ entry.lastSavedAtUtc.toLocaleDateString() }}</small></span>
            <AppIcon name="arrow-right" />
          </button>
        </div>
      </section>
      <p v-else-if="isLoadingRecent" class="home-loading">Looking for recent games…</p>
    </section>
    <footer class="home-footer"><span>ChessVue</span><span>Local-first desktop chess</span></footer>
  </main>
</template>

<style scoped>
.home-page { display: flex; height: 100%; min-height: 0; flex-direction: column; background: var(--surface-app); }
.home-header { display: flex; min-height: 4rem; padding: 0.5rem 1.5rem; flex-shrink: 0; align-items: center; justify-content: space-between; }
.app-brand__text { display: grid; }
.home-header__note { color: var(--text-muted); font-size: 0.75rem; }
.home-hero { display: flex; width: min(65rem, 100%); min-height: 0; margin: auto; padding: 1rem 1.5rem; flex-direction: column; gap: 1.5rem; overflow: auto; }
.home-intro { text-align: center; }
.home-title { margin: 0; font-family: var(--font-display); font-size: clamp(2rem, 4.5vw, 4rem); font-weight: 500; letter-spacing: -0.04em; line-height: 1; }
.home-title em { color: var(--accent-strong); font-weight: 500; }
.home-intro .page-description { margin: 0.75rem auto 0; font-size: 0.85rem; }
.home-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }
.home-action { position: relative; display: flex; min-width: 0; min-height: 9rem; padding: 1rem; flex-direction: column; align-items: flex-start; gap: 0.5rem; color: var(--text-primary); border-radius: 0.25rem; background: var(--surface-panel); text-align: left; }
.home-action:hover { background: var(--accent-soft); }
.home-action--primary { color: var(--text-on-accent); background: var(--accent-strong); }
.home-action--primary:hover { background: var(--accent); }
.home-action__icon { font-size: 1.3rem; }
.home-action strong { margin-top: auto; font-size: 1rem; }
.home-action small { color: var(--text-muted); font-size: 0.65rem; }
.home-action--primary small { color: var(--text-on-accent-muted); }
.home-action__arrow { position: absolute; right: 0.65rem; top: 0.65rem; opacity: 0; }
.home-action:hover .home-action__arrow { opacity: 1; }
.home-error { margin: 0; }
.recent-section { display: grid; gap: 0.5rem; }
.recent-section__heading { display: flex; align-items: end; justify-content: space-between; }
.recent-section__heading h2 { margin: 0; font-family: var(--font-display); font-size: 1.25rem; }
.recent-section__heading .page-kicker { margin-bottom: 0; }
.recent-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.recent-card { display: flex; min-width: 0; padding: 0.5rem; align-items: center; gap: 0.5rem; color: var(--text-primary); background: transparent; text-align: left; }
.recent-card:hover { background: var(--accent-soft); }
.recent-card__piece { color: var(--accent-strong); font-size: 1.5rem; }
.recent-card__copy { min-width: 0; flex: 1; }
.recent-card strong, .recent-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-card strong { font-size: 0.75rem; }
.recent-card small { color: var(--text-muted); font-size: 0.6rem; }
.home-loading { margin: 0; color: var(--text-muted); font-size: 0.75rem; text-align: center; }
.home-footer { display: flex; padding: 0.75rem 1.5rem; flex-shrink: 0; justify-content: space-between; color: var(--text-muted); font-size: 0.6rem; }
@media (max-width: 760px) {
  .home-header { min-height: 3rem; padding: 0.5rem 1rem; }
  .home-header__note { display: none; }
  .home-hero { padding: 0.75rem 1rem; gap: 1rem; }
  .home-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-action { min-height: 6rem; padding: 0.75rem; gap: 0.25rem; }
  .recent-grid { grid-template-columns: 1fr; gap: 0.15rem; }
  .home-footer { padding: 0.5rem 1rem; }
}
</style>

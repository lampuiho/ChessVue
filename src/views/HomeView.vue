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
.home-page { position: relative; display: flex; min-height: 100vh; flex-direction: column; overflow: hidden; background: radial-gradient(circle at 75% 15%, var(--accent-ambient), transparent 29rem), var(--surface-app); }
.home-page::after { position: absolute; z-index: 0; right: -7rem; bottom: -14rem; color: var(--accent-watermark); font-family: var(--font-display); font-size: 34rem; line-height: 1; content: '♞'; transform: rotate(-8deg); pointer-events: none; }
.home-header { position: relative; z-index: 1; display: flex; min-height: 5rem; padding: 0 2.5rem; align-items: center; justify-content: space-between; }
.app-brand__text { display: grid; }
.home-header__note { color: var(--text-muted); font-family: var(--font-display); font-size: 0.78rem; font-style: italic; }
.home-hero { position: relative; z-index: 1; display: grid; width: min(70rem, calc(100% - 4rem)); margin: auto; padding: 3rem 0; align-content: center; gap: 2.5rem; }
.home-hero--compact { padding-top: 1rem; }
.home-intro { text-align: center; }
.home-title { margin: 0; font-family: var(--font-display); font-size: clamp(2.6rem, 5.4vw, 5rem); font-weight: 500; letter-spacing: -0.055em; line-height: 0.98; }
.home-title em { color: var(--accent-strong); font-weight: 500; }
.home-intro .page-description { margin-right: auto; margin-left: auto; }
.home-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
.home-action { position: relative; display: grid; min-width: 0; aspect-ratio: 1.04; padding: 1.15rem; align-content: space-between; justify-items: start; color: var(--text-primary); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-lg); background: var(--surface-panel); box-shadow: var(--shadow-sm); text-align: left; transition: 170ms ease; }
.home-action:hover { border-color: var(--accent); box-shadow: var(--shadow-md); transform: translateY(-0.25rem); }
.home-action--primary { color: var(--text-on-accent); border-color: transparent; background: var(--accent-strong); }
.home-action--primary small { color: var(--text-on-accent-muted); }
.home-action__icon { display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border-radius: 50%; background: var(--accent-soft); font-size: 1.2rem; }
.home-action--primary .home-action__icon { background: var(--surface-overlay); }
.home-action strong { margin-top: auto; font-family: var(--font-display); font-size: 1.15rem; }
.home-action small { color: var(--text-muted); font-size: 0.7rem; }
.home-action--primary small { color: var(--text-on-accent-muted); }
.home-action__arrow { position: absolute; right: 1rem; bottom: 1rem; opacity: 0; transform: translateX(-0.3rem); transition: 140ms ease; }
.home-action:hover .home-action__arrow { opacity: 1; transform: none; }
.home-error { margin: -1.3rem auto 0; }
.recent-section { display: grid; gap: 0.75rem; }
.recent-section__heading { display: flex; align-items: end; justify-content: space-between; }
.recent-section__heading h2 { margin: 0; font-family: var(--font-display); font-size: 1.45rem; }
.recent-section__heading .page-kicker { margin-bottom: 0.15rem; }
.recent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.recent-card { display: grid; grid-template-columns: auto 1fr auto; min-width: 0; padding: 0.8rem 0.9rem; align-items: center; gap: 0.75rem; color: var(--text-primary); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-panel); text-align: left; }
.recent-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.recent-card__piece { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; color: var(--surface-panel); border-radius: 50%; background: var(--text-primary); font-family: var(--font-display); font-size: 1.4rem; }
.recent-card__copy { min-width: 0; }
.recent-card strong, .recent-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-card strong { font-size: 0.8rem; }
.recent-card small { color: var(--text-muted); font-size: 0.68rem; }
.home-loading { color: var(--text-muted); font-size: 0.75rem; text-align: center; }
.home-footer { position: relative; z-index: 1; display: flex; padding: 1.25rem 2.5rem; justify-content: space-between; color: var(--text-muted); font-size: 0.65rem; letter-spacing: 0.06em; text-transform: uppercase; }
@media (max-width: 53.75rem) { .home-actions { grid-template-columns: repeat(2, 1fr); } .home-action { aspect-ratio: auto; min-height: 11rem; } .recent-grid { grid-template-columns: 1fr; } }
@media (max-width: 32.5rem) { .home-header { padding: 0 1rem; } .home-header__note { display: none; } .home-hero { width: calc(100% - 2rem); gap: 1.5rem; } .home-actions { grid-template-columns: 1fr 1fr; gap: 0.55rem; } .home-action { min-height: 9.5rem; padding: 0.85rem; } .home-footer { padding: 1rem; } }
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PlayerColour, PlayerType, type ICreateGameRequest, type IRecentGameEntry } from '@/contracts';
import { useGamesStore, useRecentGameStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import GameCreationModal from '@/components/modals/GameCreationModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const modal = useModal();
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

onMounted(_refreshRecentGames);
function _openCustomGame() { modal.open(GameCreationModal, {}); }
async function _refreshRecentGames() {
  try {
    recentGames.value = await recentGameStore.getRecentGames();
  } catch {
    recentGames.value = [];
  } finally {
    isLoadingRecent.value = false;
  }
}
async function _quickNewGame() {
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
  await _run(async () => {
    const game = await gamesStore.createGame(request);
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
  });
}
async function _openRecent(entry: IRecentGameEntry) {
  pendingGameId.value = entry.gameId;
  try {
    errorMessage.value = '';
    const existing = gamesStore.getGame(entry.gameId);
    const game = existing ?? await gamesStore.insertGame(await savedGamesStore.loadRecentGame(entry.gameId));
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The game could not be opened.';
    await _refreshRecentGames();
  } finally {
    pendingGameId.value = undefined;
  }
}
async function _run(action: () => Promise<void>) {
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
      <div class="app-brand app-brand--home">
        <span class="app-brand__mark">♞</span>
        <span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Study · Play · Analyse</span></span>
      </div>
      <span class="home-header__note">A quiet place for serious chess</span>
    </header>
    <section class="home-hero" :class="{ 'home-hero--compact': recentGames.length > 0 }">
      <div class="home-intro">
        <p class="page-kicker">Your next move</p>
        <h1 class="home-title">Play the position.<br><em>See the whole game.</em></h1>
        <p class="page-description page-description--home">Open a fresh board, continue a saved game, or settle in for analysis.</p>
      </div>
      <div class="home-actions" aria-label="Start actions">
        <button class="home-action home-action--primary" @click="_quickNewGame"><span class="home-action__icon"><AppIcon name="sparkles" /></span><strong>Quick game</strong><small>Start with your defaults</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="_openCustomGame()"><span class="home-action__icon"><AppIcon name="sliders" /></span><strong>Custom game</strong><small>Players, clock & engines</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="router.push('/saved-games/load')"><span class="home-action__icon"><AppIcon name="folder" /></span><strong>Load game</strong><small>Return to a saved board</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
        <button class="home-action" @click="router.push('/settings/session')"><span class="home-action__icon"><AppIcon name="settings" /></span><strong>Settings</strong><small>Make the board yours</small><AppIcon class="home-action__arrow" name="arrow-right" /></button>
      </div>
      <p v-if="errorMessage" class="inline-message inline-message--error home-error">{{ errorMessage }}</p>
      <section v-if="recentGames.length" class="recent-section">
        <div class="recent-section__heading"><div><p class="page-kicker page-kicker--flush">Continue</p><h2>Recent games</h2></div><button class="text-button text-button--ghost" @click="router.push('/saved-games/load')">View all <AppIcon name="arrow-right" /></button></div>
        <div class="recent-grid">
          <button v-for="entry in recentGames.slice(0, 3)" :key="entry.gameId" class="recent-card" :disabled="pendingGameId === entry.gameId" @click="_openRecent(entry)">
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


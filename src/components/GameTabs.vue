<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useGamesStore, useUiStateStore } from '@/state';
import { useGameTabActions } from '@/composables/GameTabActionsComposable';
import AppIcon from './common/AppIcon.vue';
const route = useRoute();
const gamesStore = useGamesStore();
const uiStateStore = useUiStateStore();
const actions = useGameTabActions();
const tabs = computed(() => gamesStore.listGames().filter((game) => uiStateStore.gameSession?.openGameIds.includes(game.metadata.id)));
const activeId = computed(() => String(route.params.id ?? ''));
const errorMessage = ref('');
let _disposed = false;
onScopeDispose(() => { _disposed = true; });
async function _run(action: () => Promise<unknown>) {
  errorMessage.value = '';
  try { await action(); } catch (error) {
    if (!_disposed) errorMessage.value = error instanceof Error ? error.message : 'The tab could not be changed.';
  }
}
</script>

<template>
  <nav v-if="tabs.length > 1" class="tab-strip" aria-label="Open games">
    <button v-for="tab in tabs" :key="tab.metadata.id" class="tab-button" :class="{ 'tab-button--active': tab.metadata.id === activeId }" @click="_run(() => actions.select(tab.metadata.id))">
      <span class="tab-button__label" :title="tab.metadata.name">{{ tab.metadata.name }}</span>
      <span class="tab-button__close" role="button" :aria-label="`Close ${tab.metadata.name}`" tabindex="0" @click.stop="_run(() => actions.close(tab.metadata.id))" @keydown.enter.stop="_run(() => actions.close(tab.metadata.id))"><AppIcon name="x" /></span>
    </button>
  </nav>
  <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
</template>

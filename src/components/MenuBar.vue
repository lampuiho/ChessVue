<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGamesStore } from '@/state';
import { useQuickGame } from '@/composables/QuickGameComposable';
import { useGameTabActions } from '@/composables/GameTabActionsComposable';
import NavigationFrame from './NavigationFrame.vue';
import AppIcon from './common/AppIcon.vue';

const props = defineProps<{ gameId: string }>();
const emit = defineEmits<{
  homeRequested: [];
  customNewGameRequested: [];
  loadGameRequested: [];
  saveGameRequested: [];
  settingsRequested: [];
}>();
const gamesStore = useGamesStore();
const router = useRouter();
const canSave = computed(() => !!gamesStore.getGame(props.gameId));
const { start, isWorking, errorMessage: quickError } = useQuickGame();
const tabs = useGameTabActions();
const errorMessage = ref('');
let _disposed = false;
onScopeDispose(() => { _disposed = true; });
async function _closeGame() {
  errorMessage.value = '';
  try { await tabs.close(props.gameId); } catch (error) {
    if (!_disposed) errorMessage.value = error instanceof Error ? error.message : 'The game could not be closed.';
  }
}
</script>

<template>
  <NavigationFrame>
    <template #brand>
      <button class="app-brand" aria-label="ChessVue home" title="ChessVue home" @click="emit('homeRequested')">
        <span class="app-brand__mark">♞</span>
        <span class="app-brand__text">
          <span class="app-brand__name">ChessVue</span>
          <span class="app-brand__sub">Study · Play · Analyse</span>
        </span>
      </button>
    </template>
    <nav class="navigation-group" aria-label="Game actions">
      <button class="menu-button menu-button--accent" aria-label="Quick game" title="Quick game" :disabled="isWorking" @click="start"><AppIcon name="plus" /><span>Quick game</span></button>
      <button class="menu-button" aria-label="Custom" title="Custom" @click="emit('customNewGameRequested')"><AppIcon name="sliders" /><span>Custom</span></button>
      <button class="menu-button" aria-label="Load" title="Load" @click="emit('loadGameRequested')"><AppIcon name="folder" /><span>Load</span></button>
      <button class="menu-button" :disabled="!canSave" aria-label="Save" title="Save" @click="emit('saveGameRequested')"><AppIcon name="save" /><span>Save</span></button>
      <button v-if="canSave" class="menu-button" aria-label="Close game" title="Close game" @click="_closeGame"><AppIcon name="x" /><span>Close game</span></button>
    </nav>
    <nav class="navigation-group navigation-group--secondary" aria-label="Application actions">
      <button class="menu-button" aria-label="Settings" title="Settings" @click="emit('settingsRequested')"><AppIcon name="settings" /><span>Settings</span></button>
    </nav>
    <template #footer><p v-if="errorMessage || quickError" class="inline-message inline-message--error" role="alert">{{ errorMessage || quickError }} <button v-if="quickError" class="text-button" @click="router.push('/settings/gameplay')">Edit game defaults</button></p></template>
  </NavigationFrame>
</template>


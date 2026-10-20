<script setup lang="ts">
import NavigationFrame from './NavigationFrame.vue';
import AppIcon from './common/AppIcon.vue';

withDefaults(defineProps<{ canSave?: boolean; canDelete?: boolean; canClose?: boolean }>(), { canSave: false, canDelete: false, canClose: false });
const emit = defineEmits<{
  homeRequested: [];
  quickNewGameRequested: [];
  customNewGameRequested: [];
  loadGameRequested: [];
  saveGameRequested: [];
  settingsRequested: [];
  deleteGameRequested: [];
  closeGameRequested: [];
}>();
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
    <nav class="header-actions" aria-label="Game actions">
      <button class="menu-button menu-button--accent" aria-label="Quick game" title="Quick game" @click="emit('quickNewGameRequested')"><AppIcon name="plus" /><span>Quick game</span></button>
      <button class="menu-button" aria-label="Custom" title="Custom" @click="emit('customNewGameRequested')"><AppIcon name="sliders" /><span>Custom</span></button>
      <button class="menu-button" aria-label="Load" title="Load" @click="emit('loadGameRequested')"><AppIcon name="folder" /><span>Load</span></button>
      <button class="menu-button" :disabled="!canSave" aria-label="Save" title="Save" @click="emit('saveGameRequested')"><AppIcon name="save" /><span>Save</span></button>
      <button v-if="canClose" class="menu-button" aria-label="Close game" title="Close game" @click="emit('closeGameRequested')"><AppIcon name="x" /><span>Close game</span></button>
    </nav>
    <nav class="header-actions header-actions--end" aria-label="Application actions">
      <button class="menu-button" aria-label="Settings" title="Settings" @click="emit('settingsRequested')"><AppIcon name="settings" /><span>Settings</span></button>
      <button v-if="canDelete" class="menu-button menu-button--danger" aria-label="Delete" title="Delete" @click="emit('deleteGameRequested')"><AppIcon name="trash" /><span>Delete</span></button>
    </nav>
  </NavigationFrame>
</template>

<style scoped>
.app-brand { padding: 0; border: 0; background: transparent; text-align: left; }
.app-brand__text { display: grid; }
</style>

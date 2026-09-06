<script setup lang="ts">
import AppIcon from './common/AppIcon.vue';

withDefaults(defineProps<{ canSave?: boolean; canDelete?: boolean }>(), { canSave: false, canDelete: false });
const emit = defineEmits<{
  homeRequested: [];
  quickNewGameRequested: [];
  customNewGameRequested: [];
  loadGameRequested: [];
  saveGameRequested: [];
  settingsRequested: [];
  deleteGameRequested: [];
}>();
</script>

<template>
  <header class="app-header">
    <button class="app-brand" aria-label="ChessVue home" @click="emit('homeRequested')">
      <span class="app-brand__mark">♞</span>
      <span class="app-brand__text">
        <span class="app-brand__name">ChessVue</span>
        <span class="app-brand__sub">Study · Play · Analyse</span>
      </span>
    </button>
    <nav class="header-actions" aria-label="Game actions">
      <button class="menu-button menu-button--accent" @click="emit('quickNewGameRequested')"><AppIcon name="plus" /><span>Quick game</span></button>
      <button class="menu-button" @click="emit('customNewGameRequested')"><AppIcon name="sliders" /><span>Custom</span></button>
      <button class="menu-button" @click="emit('loadGameRequested')"><AppIcon name="folder" /><span>Load</span></button>
      <button class="menu-button" :disabled="!canSave" @click="emit('saveGameRequested')"><AppIcon name="save" /><span>Save</span></button>
    </nav>
    <nav class="header-actions header-actions--end" aria-label="Application actions">
      <button class="menu-button" @click="emit('settingsRequested')"><AppIcon name="settings" /><span>Settings</span></button>
      <button v-if="canDelete" class="menu-button menu-button--danger" @click="emit('deleteGameRequested')"><AppIcon name="trash" /><span>Delete</span></button>
    </nav>
  </header>
</template>

<style scoped>
.app-brand { padding: 0; border: 0; background: transparent; text-align: left; }
.app-brand__text { display: grid; }
</style>

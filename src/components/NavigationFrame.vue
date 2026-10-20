<script setup lang="ts">
import { ref } from 'vue';
import { useUiStateStore } from '@/state';
import AppIcon from './common/AppIcon.vue';
import { vFocusScope } from './common/FocusScope';
const uiStateStore = useUiStateStore();
const drawerOpen = ref(false);
</script>

<template>
  <header class="app-header navigation-frame" :class="{ 'navigation-frame--expanded': uiStateStore.navigationExpanded }">
    <button class="menu-button navigation-toggle navigation-toggle--desktop"
      :aria-label="uiStateStore.navigationExpanded ? 'Collapse navigation' : 'Expand navigation'"
      :aria-expanded="uiStateStore.navigationExpanded" @click="uiStateStore.toggleNavigationExpanded()">
        <AppIcon name="menu" />
    </button>
    <button class="menu-button navigation-toggle navigation-toggle--mobile"
      aria-label="Open navigation menu"
      :aria-expanded="drawerOpen"
      @click="drawerOpen = true">
      <AppIcon name="menu" />
    </button>
    <div class="navigation-brand"><slot name="brand" /></div>
    <div class="navigation-actions"><slot /></div>
    <div class="navigation-footer"><slot name="footer" /></div>
  </header>
  <Teleport to="body">
    <div v-if="drawerOpen" class="navigation-overlay" @mousedown.self.prevent="drawerOpen = false">
      <aside v-focus-scope class="navigation-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu" tabindex="-1" @keydown.esc.stop.prevent="drawerOpen = false">
        <button class="icon-button navigation-drawer__close" aria-label="Close navigation menu" @click="drawerOpen = false"><AppIcon name="x" /></button>
        <div class="navigation-brand" @click="drawerOpen = false"><slot name="brand" /></div>
        <div class="navigation-actions" @click="drawerOpen = false"><slot /></div>
        <div class="navigation-footer" @click="drawerOpen = false"><slot name="footer" /></div>
      </aside>
    </div>
  </Teleport>
</template>


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
    <button class="icon-button navigation-toggle navigation-toggle--desktop" :aria-label="uiStateStore.navigationExpanded ? 'Collapse navigation' : 'Expand navigation'" :aria-expanded="uiStateStore.navigationExpanded" @click="uiStateStore.toggleNavigationExpanded()"><AppIcon :name="uiStateStore.navigationExpanded ? 'chevron-left' : 'chevron-right'" /></button>
    <button class="icon-button navigation-toggle navigation-toggle--mobile" aria-label="Open navigation menu" :aria-expanded="drawerOpen" @click="drawerOpen = true"><AppIcon name="menu" /></button>
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

<style scoped>
.navigation-frame { z-index: 20; display: flex; width: 3.5rem; min-width: 0; min-height: 0; padding: 0.5rem 0.35rem; flex: 0 0 auto; flex-direction: column; align-items: stretch; gap: 0.5rem; background: var(--surface-panel); }
.navigation-frame--expanded { width: 11.5rem; }
.navigation-toggle { align-self: flex-start; width: 2.8rem; }
.navigation-toggle--mobile { display: none; }
.navigation-brand { min-width: 0; }
.navigation-actions, .navigation-footer { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: 0.25rem; }
.navigation-actions { overflow: auto; }
.navigation-footer { margin-top: auto; flex-shrink: 0; }
:deep(.header-actions), :deep(.library-tabs), :deep(.category-list) { display: flex; min-width: 0; margin: 0; flex-direction: column; align-items: stretch; gap: 0.25rem; }
:deep(.header-actions--end) { margin-top: 0.5rem; }
:deep(.app-brand) { min-width: 0; padding: 0.3rem; border: 0; background: transparent; text-align: left; }
:deep(.app-brand__text) { display: grid; min-width: 0; }
:deep(.app-brand__sub) { font-size: 0.5rem; letter-spacing: 0.04em; }
:deep(.menu-button) { min-width: 0; min-height: 2.6rem; padding: 0.55rem 0.65rem; flex-shrink: 0; text-align: left; }
:deep(.menu-button.active) { color: var(--accent-strong); background: var(--accent-soft); }
.navigation-frame:not(.navigation-frame--expanded) :deep(.menu-button > span), .navigation-frame:not(.navigation-frame--expanded) :deep(.app-brand__text) { display: none; }
.navigation-frame:not(.navigation-frame--expanded) :deep(.menu-button) { justify-content: center; }
.navigation-overlay { position: fixed; z-index: 90; inset: 0; display: flex; background: rgb(0 0 0 / 65%); }
.navigation-drawer { display: flex; width: min(18rem, 85vw); min-height: 0; padding: 0.75rem; flex-direction: column; gap: 0.75rem; overflow: auto; background: var(--surface-panel); }
.navigation-drawer__close { align-self: flex-end; flex-shrink: 0; }
.navigation-drawer :deep(.app-brand__text), .navigation-drawer :deep(.menu-button > span) { display: grid; }
@media (max-width: 760px) {
  .navigation-frame { width: 100%; height: 3rem; padding: 0.25rem; flex-direction: row; align-items: center; gap: 0.125rem; }
  .navigation-toggle--desktop, .navigation-frame > .navigation-brand { display: none; }
  .navigation-toggle--mobile { display: inline-grid; }
  .navigation-frame .navigation-toggle, .navigation-frame :deep(.menu-button) { width: min(2.5rem, 9vw); min-height: 2.5rem; height: 2.5rem; padding: 0; justify-content: center; }
  .navigation-frame .navigation-actions, .navigation-frame .navigation-footer, .navigation-frame :deep(.header-actions), .navigation-frame :deep(.library-tabs), .navigation-frame :deep(.category-list) { flex-direction: row; align-items: center; gap: 0.125rem; overflow: visible; }
  .navigation-frame .navigation-footer { margin: 0 0 0 auto; }
  .navigation-frame :deep(.header-actions--end) { margin: 0; }
  .navigation-frame :deep(.menu-button > span), .navigation-frame :deep(.app-brand__text) { display: none; }
}
</style>

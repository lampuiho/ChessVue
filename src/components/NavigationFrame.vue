<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useSlots } from 'vue';
import { useUiStateStore } from '@/state';
import AppIcon from './common/AppIcon.vue';
import { useModal, type IModalHandle } from '@/composables/ModalComposable';
import NavigationMenuModal from './modals/NavigationMenuModal.vue';
const uiStateStore = useUiStateStore();
const modal = useModal();
const content = useSlots();
const drawer = shallowRef<IModalHandle>();
onBeforeUnmount(() => { void drawer.value?.close(); });
function _openDrawer() {
  const current = modal.open(NavigationMenuModal, { content }, () => {
    if (drawer.value === current) drawer.value = undefined;
  });
  drawer.value = current;
}
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
      :aria-expanded="!!drawer && !drawer.signal.aborted"
      @click="_openDrawer">
      <AppIcon name="menu" />
    </button>
    <div class="navigation-brand"><slot name="brand" /></div>
    <div class="navigation-actions"><slot /></div>
    <div class="navigation-footer"><slot name="footer" /></div>
  </header>
</template>


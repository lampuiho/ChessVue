<script setup lang="ts">
import type { Slots } from 'vue';
import { vFocusScope } from '@/directives/FocusScope';
import AppIcon from '../common/AppIcon.vue';
const props = defineProps<{ content: Slots; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const _brand = () => props.content.brand?.();
const _actions = () => props.content.default?.();
const _footer = () => props.content.footer?.();
</script>
<template>
  <div class="navigation-overlay" @mousedown.self.prevent="emit('dismissed')">
    <aside v-focus-scope class="navigation-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu" tabindex="-1" @keydown.esc.stop.prevent="emit('dismissed')">
      <button class="icon-button navigation-drawer__close" aria-label="Close navigation menu" @click="emit('dismissed')"><AppIcon name="x" /></button>
      <div class="navigation-brand" @click="emit('dismissed')"><component :is="_brand" /></div>
      <div class="navigation-actions" @click="emit('dismissed')"><component :is="_actions" /></div>
      <div class="navigation-footer" @click="emit('dismissed')"><component :is="_footer" /></div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { vFocusScope } from './FocusScope';

withDefaults(defineProps<{ title: string; subtitle?: string; wide?: boolean; dismissible?: boolean }>(), { dismissible: true });
const emit = defineEmits<{ dismissed: [] }>();
</script>

<template>
  <div class="modal-backdrop" role="presentation" @mousedown.self.prevent="dismissible && emit('dismissed')">
    <section v-focus-scope class="modal-card" :class="{ 'modal-card--wide': wide }" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @keydown.esc.stop.prevent="dismissible && emit('dismissed')">
      <header class="modal-card__header">
        <div>
          <h2 class="modal-card__title">{{ title }}</h2>
          <p v-if="subtitle" class="modal-card__subtitle">{{ subtitle }}</p>
        </div>
        <button v-if="dismissible" class="icon-button modal-card__close" aria-label="Close dialog" @click="emit('dismissed')"><AppIcon name="x" /></button>
      </header>
      <div class="modal-card__body"><slot /></div>
      <footer v-if="$slots.actions" class="modal-card__actions"><slot name="actions" /></footer>
    </section>
  </div>
</template>

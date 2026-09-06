<script setup lang="ts">
import AppIcon from './common/AppIcon.vue';

defineProps<{ tabs: readonly { id: string; name: string }[]; activeId?: string }>();
const emit = defineEmits<{ tabSelected: [id: string]; tabClosed: [id: string] }>();
</script>

<template>
  <nav class="tab-strip" aria-label="Open games">
    <button v-for="tab in tabs" :key="tab.id" class="tab-button" :class="{ 'tab-button--active': tab.id === activeId }" @click="emit('tabSelected', tab.id)">
      <span class="tab-button__label">{{ tab.name }}</span>
      <span class="tab-button__close" role="button" :aria-label="`Close ${tab.name}`" tabindex="0" @click.stop="emit('tabClosed', tab.id)" @keydown.enter.stop="emit('tabClosed', tab.id)"><AppIcon name="x" /></span>
    </button>
  </nav>
</template>

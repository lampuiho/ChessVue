<script setup lang="ts">
import { computed } from 'vue';
import { resolveIconShapes, type IconName } from '@/config/IconConfig';
const props = defineProps<{ name: IconName }>();
const shapes = computed(() => resolveIconShapes(props.name));
</script>

<template>
  <svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <component :is="shape.tag" v-for="(shape, index) in shapes" :key="index" v-bind="shape.attrs" />
  </svg>
</template>

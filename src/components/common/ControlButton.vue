<script setup lang="ts">
import type { IconName } from '@/config/IconConfig';
import AppIcon from './AppIcon.vue';
withDefaults(defineProps<{ icon: IconName; label: string; disabled?: boolean; variant?: 'primary' | 'danger' }>(), { disabled: false });
</script>
<template>
  <button class="control-button" :class="variant && `control-button--${variant}`" :data-tooltip="label" :aria-label="label" :disabled="disabled"><AppIcon :name="icon" /><slot /></button>
</template>

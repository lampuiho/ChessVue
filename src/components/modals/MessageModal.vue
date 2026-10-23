<script setup lang="ts">
import ModalDialog from './ModalDialog.vue';
withDefaults(defineProps<{ title: string; subtitle?: string; message: string; closeLabel?: string; error?: boolean; signal: AbortSignal }>(), { closeLabel: 'Close', error: false });
const emit = defineEmits<{ dismissed: [] }>();
</script>
<template>
  <ModalDialog :title="title" :subtitle="subtitle" @dismissed="emit('dismissed')">
    <p :class="error ? 'inline-message inline-message--error inline-message--spaced' : 'modal-copy'">{{ message }}</p>
    <template #actions><button class="text-button text-button--primary" @click="emit('dismissed')">{{ closeLabel }}</button></template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ModalDialog from './ModalDialog.vue';
const props = withDefaults(defineProps<{
  title: string; subtitle?: string; message?: string; confirmLabel: string; cancelLabel?: string;
  danger?: boolean; dismissibleWhileWorking?: boolean; signal: AbortSignal; confirm: (signal: AbortSignal) => Promise<void>;
}>(), { cancelLabel: 'Cancel', danger: false, dismissibleWhileWorking: true });
const emit = defineEmits<{ dismissed: [] }>();
const isWorking = ref(false);
const errorMessage = ref('');
const canDismiss = computed(() => props.dismissibleWhileWorking || !isWorking.value);
function _dismiss() {
  if (canDismiss.value && !props.signal.aborted) emit('dismissed');
}
async function _confirm() {
  if (isWorking.value || props.signal.aborted) return;
  isWorking.value = true;
  errorMessage.value = '';
  try {
    await props.confirm(props.signal);
    if (!props.signal.aborted) emit('dismissed');
  } catch (error) {
    if (!props.signal.aborted) errorMessage.value = error instanceof Error ? error.message : 'The action could not be completed.';
  } finally { isWorking.value = false; }
}
</script>
<template>
  <ModalDialog :title="title" :subtitle="subtitle" :dismissible="canDismiss" @dismissed="_dismiss">
    <p v-if="message" class="modal-copy">{{ message }}</p>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced" role="alert">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" :disabled="!canDismiss" @click="_dismiss">{{ cancelLabel }}</button><button class="text-button" :class="danger ? 'text-button--danger' : 'text-button--primary'" :disabled="isWorking" @click="_confirm">{{ confirmLabel }}</button></template>
  </ModalDialog>
</template>

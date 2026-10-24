<script setup lang="ts">
import { computed } from 'vue';
import { useModalAction } from '@/composables/ModalActionComposable';
import ModalDialog from './ModalDialog.vue';
const props = withDefaults(defineProps<{
  title: string; subtitle?: string; message?: string; confirmLabel: string; cancelLabel?: string;
  danger?: boolean; dismissibleWhileWorking?: boolean; signal: AbortSignal; confirm: (signal: AbortSignal) => Promise<void>;
}>(), { cancelLabel: 'Cancel', danger: false, dismissibleWhileWorking: true });
const emit = defineEmits<{ dismissed: [] }>();
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const canDismiss = computed(() => props.dismissibleWhileWorking || !isWorking.value);
function _dismiss() {
  if (canDismiss.value && !props.signal.aborted) emit('dismissed');
}
async function _confirm() {
  if (await run(() => props.confirm(props.signal))) emit('dismissed');
}
</script>
<template>
  <ModalDialog :title="title" :subtitle="subtitle" :dismissible="canDismiss" @dismissed="_dismiss">
    <p v-if="message" class="modal-copy">{{ message }}</p>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced" role="alert">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" :disabled="!canDismiss" @click="_dismiss">{{ cancelLabel }}</button><button class="text-button" :class="danger ? 'text-button--danger' : 'text-button--primary'" :disabled="isWorking" @click="_confirm">{{ confirmLabel }}</button></template>
  </ModalDialog>
</template>

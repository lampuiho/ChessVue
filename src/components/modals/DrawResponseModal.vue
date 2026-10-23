<script setup lang="ts">
import { reactive } from 'vue';
import { PlayerColour, type IGame } from '@/contracts';
import { useGamesStore } from '@/state';
import ModalDialog from './ModalDialog.vue';
const props = defineProps<{ gameId: string; respondingColour: PlayerColour; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const gamesStore = useGamesStore();
const form = reactive({ isWorking: false, errorMessage: '' });
function _acceptDraw() {
  const game = gamesStore.getGame(props.gameId) as unknown as IGame | undefined;
  if (game) return _run(() => gamesStore.acceptDrawOffer(game));
}
function _declineDraw() {
  const game = gamesStore.getGame(props.gameId) as unknown as IGame | undefined;
  if (game) return _run(() => gamesStore.declineDrawOffer(game));
}
async function _run(action: () => Promise<void>) {
  if (form.isWorking || props.signal.aborted) return;
  form.isWorking = true;
  form.errorMessage = '';
  try {
    await action();
    if (!props.signal.aborted) emit('dismissed');
  } catch (error) {
    if (!props.signal.aborted) form.errorMessage = error instanceof Error ? error.message : 'The action could not be completed.';
  } finally { form.isWorking = false; }
}
</script>
<template>
  <ModalDialog title="Draw offered" :subtitle="`${respondingColour} to respond.`" :dismissible="false">
    <p class="modal-copy">Accept the draw and finish the game?</p>
    <p v-if="form.errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ form.errorMessage }}</p>
    <template #actions><button class="text-button" :disabled="form.isWorking" @click="_declineDraw">Decline</button><button class="text-button text-button--primary" :disabled="form.isWorking" @click="_acceptDraw">Accept</button></template>
  </ModalDialog>
</template>

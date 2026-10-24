<script setup lang="ts">
import { computed, onMounted, onUpdated } from 'vue';
import type { IGame } from '@/contracts';
import { useGamesStore } from '@/state';
import { useModalAction } from '@/composables/ModalActionComposable';
import ModalDialog from './ModalDialog.vue';
const props = defineProps<{ gameId: string; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const gamesStore = useGamesStore();
const game = gamesStore.getGame(props.gameId) as IGame | undefined;
const offer = game?.drawOfferState;
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const canRespond = computed(() => !!offer && gamesStore.getGame(props.gameId) === game && game?.drawOfferState === offer);
onMounted(_dismissObsolete);
onUpdated(_dismissObsolete);
function _dismissObsolete() {
  if (!canRespond.value && !props.signal.aborted) emit('dismissed');
}
async function _respond(accept: boolean) {
  if (!canRespond.value || !game) { _dismissObsolete(); return; }
  if (await run(() => accept ? gamesStore.acceptDrawOffer(game) : gamesStore.declineDrawOffer(game))) emit('dismissed');
}
</script>
<template>
  <ModalDialog v-if="canRespond" title="Draw offered" :subtitle="`${offer?.respondingColour} to respond.`" :dismissible="false">
    <p class="modal-copy">Accept the draw and finish the game?</p>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ errorMessage }}</p>
    <template #actions><button class="text-button" :disabled="isWorking || !canRespond" @click="_respond(false)">Decline</button><button class="text-button text-button--primary" :disabled="isWorking || !canRespond" @click="_respond(true)">Accept</button></template>
  </ModalDialog>
</template>

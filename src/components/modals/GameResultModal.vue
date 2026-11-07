<script setup lang="ts">
import { computed } from 'vue';
import { ResultReason, ResultState, type IGame } from '@/contracts';
import { useGamesStore } from '@/state';
import { useGameTabActions } from '@/composables/GameTabActionsComposable';
import { useModal } from '@/composables/ModalComposable';
import { useModalAction } from '@/composables/ModalActionComposable';
import { useRouter } from 'vue-router';
import AnalysisEngineSelectionModal from './AnalysisEngineSelectionModal.vue';
import ModalDialog from './ModalDialog.vue';
import AppIcon from '../common/AppIcon.vue';
const props = defineProps<{ gameId: string; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const router = useRouter();
const modal = useModal();
const gamesStore = useGamesStore();
const tabActions = useGameTabActions();
const game = gamesStore.getGame(props.gameId) as IGame | undefined;
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const sentence = computed(() => {
  const detail = _getDetail();
  return detail ? `${_getHeadline()} ${detail}.` : `${_getHeadline()}.`;
});
function _getHeadline() {
  switch (game?.resultState) {
    case ResultState.WhiteWon: return 'White wins';
    case ResultState.BlackWon: return 'Black wins';
    case ResultState.Abandoned: return 'Game abandoned';
    default: return 'Draw';
  }
}
function _getDetail() {
  switch (game?.resultReason) {
    case ResultReason.Checkmate: return 'by checkmate';
    case ResultReason.Stalemate: return 'by stalemate';
    case ResultReason.InsufficientMaterial: return 'by insufficient material';
    case ResultReason.Timeout: return 'on time';
    case ResultReason.Resignation: return 'by resignation';
    case ResultReason.DrawAgreement: return 'by agreement';
    default: return '';
  }
}
async function _exit() {
  emit('dismissed');
  await tabActions.close(props.gameId);
}
async function _save() {
  emit('dismissed');
  await router.push(`/saved-games/save/${props.gameId}`);
}
async function _analyse() {
  if (!game) { emit('dismissed'); return; }
  if (!game.analysis.seats.length) { modal.open(AnalysisEngineSelectionModal, { gameId: props.gameId }); return; }
  if (await run(() => gamesStore.refreshAnalysis(game))) emit('dismissed');
}
</script>
<template>
  <ModalDialog v-if="game" title="Game over" subtitle="The result is recorded. The position remains available for review." @dismissed="emit('dismissed')">
    <p class="modal-copy modal-copy--result">{{ sentence }}</p>
    <div class="result-actions">
      <button class="action-card" :disabled="isWorking" @click="_exit"><span class="action-card__icon"><AppIcon name="home" /></span><strong>Exit</strong><small>Close this game</small><AppIcon class="action-card__arrow" name="arrow-right" /></button>
      <button class="action-card action-card--primary" :disabled="isWorking" @click="_analyse"><span class="action-card__icon"><AppIcon name="activity" /></span><strong>Start analysis</strong><small>Run the engines on this game</small><AppIcon class="action-card__arrow" name="arrow-right" /></button>
      <button class="action-card" :disabled="isWorking" @click="_save"><span class="action-card__icon"><AppIcon name="save" /></span><strong>Save for analysis</strong><small>Store it to revisit later</small><AppIcon class="action-card__arrow" name="arrow-right" /></button>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced" role="alert">{{ errorMessage }}</p>
  </ModalDialog>
</template>

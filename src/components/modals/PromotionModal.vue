<script setup lang="ts">
import type { IMoveRaw, PlayerColour } from '@/contracts';
import ModalDialog from './ModalDialog.vue';
import ChessPiece from '../common/ChessPiece.vue';
const props = defineProps<{ moves: readonly IMoveRaw[]; colour: PlayerColour; signal: AbortSignal }>();
const emit = defineEmits<{ selected: [move: IMoveRaw]; dismissed: [] }>();
function _choosePromotion(move: IMoveRaw) {
  if (props.signal.aborted || !props.moves.includes(move)) return;
  emit('selected', move);
  if (!props.signal.aborted) emit('dismissed');
}
</script>
<template>
  <ModalDialog title="Choose promotion" subtitle="Select the piece your pawn should become." @dismissed="emit('dismissed')">
    <div class="promotion-row"><button v-for="move in moves" :key="move.promotionPiece" :aria-label="`Promote to ${colour} ${move.promotionPiece}`" @click="_choosePromotion(move)"><ChessPiece :kind="move.promotionPiece!" :colour="colour" /></button></div>
    <template #actions><button class="text-button text-button--ghost" @click="emit('dismissed')">Cancel</button></template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EngineAvailability, GameState, PieceKind, PlayerColour, PlayerType, type ICapturedPieceGroup, type IEnginePlayer } from '@/contracts';
import { useGamesStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import PlayerSelectionModal from './modals/PlayerSelectionModal.vue';
import AppIcon from './common/AppIcon.vue';
import ChessPiece from './common/ChessPiece.vue';

const props = defineProps<{
  colour: PlayerColour;
  gameId: string;
  remainingMs?: number;
  active?: boolean;
  selectionDisabled?: boolean;
  capturedPieces?: readonly ICapturedPieceGroup[];
}>();
const gamesStore = useGamesStore();
const modal = useModal();
const game = computed(() => gamesStore.getGame(props.gameId));
const player = computed(() => props.colour === PlayerColour.White ? game.value?.whitePlayer : game.value?.blackPlayer);
const canSelect = computed(() => !!game.value && !props.selectionDisabled && game.value.gameState !== GameState.BoardEdit);
function _selectPlayer() {
  if (canSelect.value) modal.open(PlayerSelectionModal, { gameId: props.gameId, colour: props.colour });
}
const capturedColour = computed(() => props.colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White);
const clockText = computed(() => {
  if (props.remainingMs === undefined) return '—';
  const remaining = Math.max(0, props.remainingMs);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const tenths = Math.floor((remaining % 1000) / 100);
  return remaining < 10000 ? `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
});
const engineStatus = computed(() => {
  if (player.value?.type !== PlayerType.Engine) return;
  return (player.value as IEnginePlayer).assignedEngine.$?.availability ?? EngineAvailability.Ready;
});
const engineError = computed(() => {
  if (player.value?.type === PlayerType.Engine) return (player.value as IEnginePlayer).assignedEngine.$?.lastError;
  return;
});
</script>

<template>
  <section class="player-panel" :class="{ 'player-panel--active': active }">
    <span class="player-avatar"><ChessPiece :kind="PieceKind.Pawn" :colour="colour" /><i v-if="active"></i></span>
    <div class="player-identity">
      <button class="player-name" :title="player?.displayName ?? 'Unassigned'" :disabled="!canSelect" @click="_selectPlayer"><span>{{ player?.displayName ?? 'Unassigned' }}</span><AppIcon v-if="canSelect" name="chevron-down" /></button>
      <div v-if="!engineError" class="player-meta">
        <span>{{ colour === PlayerColour.White ? 'White' : 'Black' }}</span>
        <span v-if="player?.type === PlayerType.Engine" class="engine-state"><i :class="`engine-state--${engineStatus}`"></i>{{ engineStatus }}</span>
        <span v-else>{{ player ? 'Local player' : 'Analysis seat' }}</span>
      </div>
      <p v-if="engineError" class="engine-error engine-error--player" role="alert" :title="engineError">{{ engineError }}</p>
    </div>
    <div v-if="capturedPieces?.length" class="captured-pieces" aria-label="Captured material">
      <template v-for="group in capturedPieces" :key="group.pieceKind"><span v-for="count in group.count" :key="count" class="captured-piece" :class="{ 'captured-piece--overlapped': count > 1 }" role="img" :aria-label="`${capturedColour} ${group.pieceKind}`"><ChessPiece :kind="group.pieceKind" :colour="capturedColour" /></span></template>
    </div>
    <div class="player-clock" :class="{ 'player-clock--running': active && remainingMs !== undefined, 'player-clock--untimed': remainingMs === undefined }"><AppIcon v-if="remainingMs === undefined" name="clock" /><span>{{ clockText }}</span></div>
  </section>
</template>


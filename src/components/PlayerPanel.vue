<script setup lang="ts">
import { computed } from 'vue';
import { EngineAvailability, PlayerColour, PlayerType, type ICapturedPieceGroup, type IEnginePlayer, type IPlayer } from '@/contracts';
import AppIcon from './common/AppIcon.vue';

const props = defineProps<{
  colour: PlayerColour;
  player?: IPlayer;
  remainingMs?: number;
  active?: boolean;
  selectionDisabled?: boolean;
  capturedPieces?: readonly ICapturedPieceGroup[];
}>();
const emit = defineEmits<{ playerSelectionRequested: [colour: PlayerColour] }>();
const pieceGlyphs = {
  white: { queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙', king: '♔' },
  black: { queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟', king: '♚' },
} as const;
const clockText = computed(() => {
  if (props.remainingMs === undefined) return '—';
  const remaining = Math.max(0, props.remainingMs);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const tenths = Math.floor((remaining % 1000) / 100);
  return remaining < 10000 ? `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
});
const engineStatus = computed(() => {
  if (props.player?.type !== PlayerType.Engine) return;
  return (props.player as IEnginePlayer).assignedEngine.$?.availability ?? EngineAvailability.Ready;
});
const engineError = computed(() => {
  if (props.player?.type === PlayerType.Engine) return (props.player as IEnginePlayer).assignedEngine.$?.lastError;
  return;
});
function glyph(kind: keyof typeof pieceGlyphs.white): string {
  const capturedColour = props.colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
  return pieceGlyphs[capturedColour][kind];
}
</script>

<template>
  <section class="player-panel" :class="{ 'player-panel--active': active }">
    <span class="player-avatar" :class="`player-avatar--${colour}`">{{ colour === PlayerColour.White ? '♙' : '♟' }}<i v-if="active"></i></span>
    <div class="player-identity">
      <button class="player-name" :title="player?.displayName ?? 'Unassigned'" :disabled="selectionDisabled" @click="emit('playerSelectionRequested', colour)"><span>{{ player?.displayName ?? 'Unassigned' }}</span><AppIcon v-if="!selectionDisabled" name="chevron-down" /></button>
      <div v-if="!engineError" class="player-meta">
        <span>{{ colour === PlayerColour.White ? 'White' : 'Black' }}</span>
        <span v-if="player?.type === PlayerType.Engine" class="engine-state"><i :class="`engine-state--${engineStatus}`"></i>{{ engineStatus }}</span>
        <span v-else>{{ player ? 'Local player' : 'Analysis seat' }}</span>
      </div>
      <p v-if="engineError" class="engine-error engine-error--player" role="alert" :title="engineError">{{ engineError }}</p>
    </div>
    <div v-if="capturedPieces?.length" class="captured-pieces" aria-label="Captured material">
      <template v-for="group in capturedPieces" :key="group.pieceKind"><span v-for="count in group.count" :key="count" :class="{ 'captured-piece--overlapped': count > 1 }">{{ glyph(group.pieceKind) }}</span></template>
    </div>
    <div class="player-clock" :class="{ 'player-clock--running': active && remainingMs !== undefined, 'player-clock--untimed': remainingMs === undefined }"><AppIcon v-if="remainingMs === undefined" name="clock" /><span>{{ clockText }}</span></div>
  </section>
</template>


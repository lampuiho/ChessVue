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
      <p v-if="engineError" class="engine-error" role="alert" :title="engineError">{{ engineError }}</p>
    </div>
    <div v-if="capturedPieces?.length" class="captured-pieces" aria-label="Captured material">
      <template v-for="group in capturedPieces" :key="group.pieceKind"><span v-for="count in group.count" :key="count" :style="{ marginLeft: count === 1 ? '0' : '-0.42em' }">{{ glyph(group.pieceKind) }}</span></template>
    </div>
    <div class="player-clock" :class="{ 'player-clock--running': active && remainingMs !== undefined, 'player-clock--untimed': remainingMs === undefined }"><AppIcon v-if="remainingMs === undefined" name="clock" /><span>{{ clockText }}</span></div>
  </section>
</template>

<style scoped>
.player-panel { display: flex; height: 2.5rem; min-width: 0; padding: 0; align-items: center; gap: 0.5rem; background: transparent; }
.player-avatar { position: relative; display: grid; width: 2.25rem; height: 2.25rem; flex: 0 0 auto; place-items: center; border-radius: 0.2rem; background: var(--surface-raised); font-family: "Segoe UI Symbol", serif; font-size: 1.65rem; }
.player-avatar--white { color: #d8c79e; text-shadow: 0 0.0625rem 0.0625rem #4a3c2d; }
.player-avatar--black { color: #312b26; }
.player-avatar i { position: absolute; right: 0; bottom: 0; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--accent-strong); }
.player-identity { min-width: 0; flex: 1; }
.player-name { display: flex; max-width: 100%; padding: 0; align-items: center; gap: 0.25rem; overflow: hidden; background: transparent; font-size: 0.8rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.player-name:hover { color: var(--accent); }
.player-name > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.player-name .app-icon { font-size: 0.65rem; }
.player-meta { display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.6rem; text-transform: capitalize; }
.player-meta > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-meta > span:first-child { flex-shrink: 0; }
.engine-state i { display: inline-block; width: 0.35rem; height: 0.35rem; margin-right: 0.25rem; border-radius: 50%; background: var(--text-muted); }
.engine-state i.engine-state--running { background: var(--success); }
.engine-state i.engine-state--failed, .engine-state i.engine-state--unavailable { background: var(--danger); }
.engine-error { margin: 0; overflow: hidden; color: var(--danger); font-size: 0.6rem; text-overflow: ellipsis; white-space: nowrap; }
.captured-pieces { display: flex; min-width: 0; align-items: center; overflow: hidden; color: var(--text-muted); font-family: "Segoe UI Symbol", serif; font-size: 1.1rem; white-space: nowrap; }
.player-clock { display: flex; min-width: 3rem; padding: 0.2rem 0.45rem; flex-shrink: 0; align-items: center; justify-content: flex-end; gap: 0.3rem; color: var(--text-muted); border-radius: 0.2rem; font-size: 1.1rem; font-variant-numeric: tabular-nums; font-weight: 750; }
.player-clock--running { color: var(--text-on-accent); background: var(--accent-strong); }
@media (max-width: 760px) { .captured-pieces { display: none; } }
</style>

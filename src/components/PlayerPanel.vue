<script setup lang="ts">
import { computed } from 'vue';
import { EngineAvailability, PlayerColour, PlayerType, type ICapturedPieceGroup, type IEnginePlayer, type IPlayer } from '@/contracts';
import AppIcon from './common/AppIcon.vue';

const props = defineProps<{
  colour: PlayerColour;
  player?: IPlayer;
  remainingMs?: number;
  active?: boolean;
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
function glyph(kind: keyof typeof pieceGlyphs.white): string {
  const capturedColour = props.colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
  return pieceGlyphs[capturedColour][kind];
}
</script>

<template>
  <section class="player-panel" :class="{ 'player-panel--active': active }">
    <span class="player-avatar" :class="`player-avatar--${colour}`">{{ colour === PlayerColour.White ? '♙' : '♟' }}<i v-if="active"></i></span>
    <div class="player-identity">
      <button class="player-name" @click="emit('playerSelectionRequested', colour)">{{ player?.displayName ?? 'Unassigned' }}<AppIcon name="chevron-down" /></button>
      <div class="player-meta">
        <span>{{ colour === PlayerColour.White ? 'White' : 'Black' }}</span>
        <span v-if="player?.type === PlayerType.Engine" class="engine-state"><i :class="`engine-state--${engineStatus}`"></i>{{ engineStatus }}</span>
        <span v-else>{{ player ? 'Local player' : 'Analysis seat' }}</span>
      </div>
    </div>
    <div v-if="capturedPieces?.length" class="captured-pieces" aria-label="Captured material">
      <template v-for="group in capturedPieces" :key="group.pieceKind"><span v-for="count in group.count" :key="count" :style="{ marginLeft: count === 1 ? '0' : '-0.42em' }">{{ glyph(group.pieceKind) }}</span></template>
    </div>
    <div class="player-clock" :class="{ 'player-clock--running': active && remainingMs !== undefined, 'player-clock--untimed': remainingMs === undefined }"><AppIcon v-if="remainingMs === undefined" name="clock" /><span>{{ clockText }}</span></div>
  </section>
</template>

<style scoped>
.player-panel { display: grid; min-height: 4.35rem; padding: 0.65rem 0.75rem; grid-template-columns: auto minmax(7rem, auto) 1fr auto; align-items: center; gap: 0.7rem; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-panel); box-shadow: var(--shadow-sm); transition: 150ms ease; }
.player-panel--active { border-color: var(--accent); }
.player-avatar { position: relative; display: grid; width: 2.7rem; height: 2.7rem; place-items: center; border: 0.0625rem solid var(--border-subtle); border-radius: 50%; background: var(--surface-app); font-family: "Segoe UI Symbol", serif; font-size: 1.65rem; }
.player-avatar--white { color: #d8c79e; text-shadow: 0 0.0625rem 0.0625rem #4a3c2d; }
.player-avatar--black { color: #312b26; }
.player-avatar i { position: absolute; right: -0.05rem; bottom: 0.05rem; width: 0.55rem; height: 0.55rem; border: 0.125rem solid var(--surface-panel); border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0.125rem var(--accent-soft); }
.player-identity { min-width: 0; }
.player-name { display: flex; max-width: 14rem; padding: 0; align-items: center; gap: 0.25rem; overflow: hidden; background: transparent; font-family: var(--font-display); font-size: 0.93rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.player-name:hover { color: var(--accent); }
.player-name .app-icon { font-size: 0.7rem; }
.player-meta { display: flex; margin-top: 0.15rem; align-items: center; gap: 0.45rem; color: var(--text-muted); font-size: 0.63rem; text-transform: capitalize; }
.player-meta span + span::before { margin-right: 0.45rem; content: '·'; }
.engine-state i { display: inline-block; width: 0.4rem; height: 0.4rem; margin-right: 0.3rem; border-radius: 50%; background: var(--text-muted); }
.engine-state i.engine-state--running { background: var(--success); box-shadow: 0 0 0 0.18rem var(--success-soft); }
.engine-state i.engine-state--failed, .engine-state i.engine-state--unavailable { background: var(--danger); }
.captured-pieces { display: flex; align-items: center; justify-content: flex-end; overflow: hidden; color: var(--text-muted); font-family: "Segoe UI Symbol", serif; font-size: 1.25rem; white-space: nowrap; }
.player-clock { display: flex; min-width: 6.5rem; padding: 0.35rem 0.65rem; align-items: center; justify-content: flex-end; gap: 0.35rem; color: var(--text-muted); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-app); font-size: 1.25rem; font-variant-numeric: tabular-nums; font-weight: 750; letter-spacing: -0.04em; }
.player-clock--running { color: var(--text-on-accent); border-color: var(--accent-strong); background: var(--accent-strong); box-shadow: 0 0.1875rem 0.625rem var(--accent-shadow); }
.player-clock--untimed { min-width: 4.4rem; }
@media (max-width: 37.5rem) { .player-panel { grid-template-columns: auto 1fr auto; } .captured-pieces { display: none; } }
</style>

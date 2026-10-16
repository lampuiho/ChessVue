<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './common/AppIcon.vue';

const props = withDefaults(defineProps<{
  mode: 'live' | 'paused' | 'inGameAnalysis' | 'freeAnalysis' | 'boardEdit' | 'finished';
  canTakeBack?: boolean;
  canPause?: boolean;
  drawPending?: boolean;
}>(), { canTakeBack: false, canPause: false, drawPending: false });
const emit = defineEmits<{
  takeBackRequested: [];
  pauseRequested: [];
  resumeRequested: [];
  analysisRequested: [];
  exitAnalysisRequested: [];
  boardEditRequested: [];
  startGameRequested: [];
  resignRequested: [];
  drawRequested: [];
}>();
const title = computed(() => ({ live: 'Game controls', paused: 'Game paused', inGameAnalysis: 'Analysis mode', freeAnalysis: 'Study controls', boardEdit: 'Position editor', finished: 'Game review' })[props.mode]);
</script>

<template>
  <section class="control-panel">
    <div class="control-panel__heading"><div><span class="control-panel__eyebrow">{{ mode === 'live' ? 'Your move' : 'Workspace' }}</span><h2>{{ title }}</h2></div><span v-if="mode === 'live'" class="turn-indicator"><i></i>Live</span><span v-else-if="mode === 'paused'" class="turn-indicator turn-indicator--paused"><i></i>Paused</span></div>
    <div class="control-grid">
      <button v-if="mode === 'paused'" class="control-button control-button--primary control-button--wide" @click="emit('resumeRequested')"><AppIcon name="play" /><span><strong>Resume game</strong><small>Restart the clock</small></span></button>
      <template v-else-if="mode === 'boardEdit'">
        <button class="control-button control-button--primary control-button--wide" @click="emit('boardEditRequested')"><AppIcon name="check" /><span><strong>Finish editing</strong><small>Return to analysis</small></span></button>
      </template>
      <template v-else>
        <button class="control-button" :disabled="!canTakeBack" @click="emit('takeBackRequested')"><AppIcon name="undo" /><span><strong>Takeback</strong><small>Rewind one move</small></span></button>
        <button v-if="(mode === 'live' || mode === 'inGameAnalysis') && canPause" class="control-button" @click="emit('pauseRequested')"><AppIcon name="pause" /><span><strong>Pause</strong><small>Stop the clock</small></span></button>
        <button v-if="mode === 'live'" class="control-button" @click="emit('analysisRequested')"><AppIcon name="activity" /><span><strong>Analyse</strong><small>Explore from here</small></span></button>
        <button v-if="mode === 'inGameAnalysis'" class="control-button control-button--primary" @click="emit('exitAnalysisRequested')"><AppIcon name="play" /><span><strong>Exit analysis</strong><small>Return to live play</small></span></button>
        <button v-if="mode === 'freeAnalysis'" class="control-button" @click="emit('boardEditRequested')"><AppIcon name="edit" /><span><strong>Edit board</strong><small>Build a position</small></span></button>
        <button v-if="mode === 'freeAnalysis'" class="control-button control-button--primary" @click="emit('startGameRequested')"><AppIcon name="play" /><span><strong>Start game</strong><small>Play this position</small></span></button>
      </template>
    </div>
    <div v-if="mode === 'live'" class="control-panel__secondary">
      <button class="quiet-action" @click="emit('drawRequested')"><i :class="{ active: drawPending }"></i><AppIcon name="handshake" />{{ drawPending ? 'Resolve draw' : 'Offer draw' }}</button>
      <button class="quiet-action quiet-action--danger" @click="emit('resignRequested')"><AppIcon name="flag" />Resign</button>
    </div>
    <p v-if="mode === 'finished'" class="control-note">The result is recorded. You can review the history or rewind where takebacks are allowed.</p>
  </section>
</template>

<style scoped>
.control-panel { padding: 0.8rem; background: var(--surface-app); }
.control-panel__heading { display: flex; margin-bottom: 0.65rem; align-items: center; justify-content: space-between; }
.control-panel__eyebrow { display: block; color: var(--accent); font-size: 0.54rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
.control-panel h2 { margin: 0.06rem 0 0; font-family: var(--font-display); font-size: 0.92rem; font-weight: 700; }
.turn-indicator { display: flex; padding: 0.2rem 0.48rem; align-items: center; gap: 0.3rem; color: var(--success-strong); border-radius: 999rem; background: var(--success-soft); font-size: 0.58rem; font-weight: 800; text-transform: uppercase; }
.turn-indicator i { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--success); }
.turn-indicator--paused { color: var(--text-muted); background: var(--surface-sunken); }
.turn-indicator--paused i { background: var(--text-muted); }
.control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.control-button { display: flex; min-height: 3.35rem; padding: 0.52rem 0.6rem; align-items: center; gap: 0.55rem; color: var(--text-primary); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-panel); text-align: left; transition: 120ms ease; }
.control-button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-0.0625rem); }
.control-button > .app-icon { color: var(--accent); font-size: 1.05rem; }
.control-button span { min-width: 0; }
.control-button strong, .control-button small { display: block; }
.control-button strong { font-size: 0.68rem; }
.control-button small { color: var(--text-muted); font-size: 0.56rem; }
.control-button--primary { color: var(--text-on-accent); border-color: var(--accent-strong); background: var(--accent-strong); }
.control-button--primary > .app-icon, .control-button--primary small { color: var(--text-on-accent-muted); }
.control-button--primary:hover:not(:disabled) { background: var(--accent); }
.control-button--wide { grid-column: 1 / -1; }
.control-panel__secondary { display: flex; margin-top: 0.55rem; padding-top: 0.55rem; justify-content: flex-end; gap: 0.25rem; border-top: 0.0625rem solid var(--border-subtle); }
.quiet-action { display: flex; min-height: 1.9rem; padding: 0.3rem 0.5rem; align-items: center; gap: 0.35rem; color: var(--text-muted); border-radius: var(--radius-sm); background: transparent; font-size: 0.6rem; font-weight: 700; }
.quiet-action:hover { color: var(--text-primary); background: var(--accent-soft); }
.quiet-action--danger:hover { color: var(--danger); background: var(--danger-soft); }
.quiet-action > i { width: 0.38rem; height: 0.38rem; border-radius: 50%; background: transparent; box-shadow: 0 0 0 0.0625rem var(--text-muted); }
.quiet-action > i.active { background: var(--accent); box-shadow: 0 0 0 0.18rem var(--accent-soft); }
.control-note { margin: 0; padding: 0.55rem; color: var(--text-muted); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-panel); font-size: 0.62rem; }
</style>

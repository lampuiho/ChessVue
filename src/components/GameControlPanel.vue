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
        <button class="control-button" :disabled="!canTakeBack" @click="emit('takeBackRequested')"><AppIcon name="undo" /><span><strong>Takeback</strong><small>Undo your last move</small></span></button>
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


<script setup lang="ts">
import { EngineAvailability, type IAnalysisLine, type ReadonlyAnalysisSeat, type IMove } from '@/contracts';
import { getSan } from '@/utility/chess';
import AppIcon from './common/AppIcon.vue';

defineProps<{ seats: readonly ReadonlyAnalysisSeat[]; collapsed?: boolean; expandedByIndex?: readonly boolean[]; showMoves?: boolean; disabled?: boolean; startDisabled?: boolean; canAdd?: boolean }>();
const emit = defineEmits<{
  collapseToggled: [];
  engineExpandedToggled: [index: number];
  refreshRequested: [];
  retryRequested: [index: number];
  stopRequested: [index: number];
  engineAddRequested: [];
  engineRemoveRequested: [index: number];
  moveSelected: [moves: readonly IMove[]];
}>();
function _score(line?: IAnalysisLine): string {
  if (line?.scoreMate !== undefined) return line.scoreMate > 0 ? `M${line.scoreMate}` : `−M${Math.abs(line.scoreMate)}`;
  if (line?.scoreCp !== undefined) {
    const value = line.scoreCp / 100;
    return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
  }
  return '—';
}
function _availability(seat: ReadonlyAnalysisSeat): EngineAvailability {
  return seat.assignedEngine.$?.availability ?? EngineAvailability.Unavailable;
}
function _summary(seat: ReadonlyAnalysisSeat): string {
  switch (_availability(seat)) {
    case EngineAvailability.Running: return 'Evaluating position';
    case EngineAvailability.Starting: return 'Waiting for engine';
    case EngineAvailability.Failed: return 'Analysis failed';
    case EngineAvailability.Unavailable: return 'Engine unavailable';
    default: return seat.isComplete ? 'Analysis complete' : 'Analysis stopped';
  }
}
</script>

<template>
  <section class="side-panel analysis-panel" :class="{ 'analysis-panel--evaluations': !showMoves }">
    <header class="side-panel__header">
      <button v-if="showMoves" class="side-panel__collapse" :aria-label="collapsed ? 'Expand analysis' : 'Collapse analysis'" @click="emit('collapseToggled')"><AppIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" /></button>
      <div class="side-panel__heading"><h2 class="side-panel__title">{{ showMoves ? 'Analysis' : 'Evaluations' }}</h2><span v-if="!showMoves || !collapsed" class="side-panel__meta">{{ seats.length ? `${seats.length} engine${seats.length === 1 ? '' : 's'}` : 'engine lines' }}</span></div>
      <div v-if="!showMoves || !collapsed" class="panel-actions"><button class="icon-button icon-button--panel" title="Refresh analysis" :disabled="startDisabled || !seats.length" @click="emit('refreshRequested')"><AppIcon name="rotate" /></button><button class="icon-button icon-button--panel" title="Add engine" :disabled="!canAdd" @click="emit('engineAddRequested')"><AppIcon name="plus" /></button></div>
    </header>
    <div v-if="!showMoves || !collapsed" class="side-panel__body analysis-list">
      <div v-if="seats.length === 0" class="panel-empty panel-empty--analysis"><AppIcon name="activity" /><strong>No engine assigned</strong><span>Add an engine to evaluate this position.</span><button class="text-button text-button--panel" :disabled="!canAdd" @click="emit('engineAddRequested')"><AppIcon name="plus" />Add engine</button></div>
      <article v-for="(seat, index) in seats" v-else :key="`${seat.assignedEngine.displayName}-${index}`" class="engine-section">
        <header class="engine-section__header" :class="{ 'engine-section__header--evaluation': !showMoves }">
          <button v-if="showMoves" class="engine-section__fold" @click="emit('engineExpandedToggled', index)"><AppIcon :name="expandedByIndex?.[index] === false ? 'chevron-right' : 'chevron-down'" /><span class="engine-section__status" :class="`engine-section__status--${_availability(seat)}`"></span><strong class="engine-section__name">{{ seat.assignedEngine.displayName }}</strong></button>
          <strong v-else class="engine-section__name" :title="_summary(seat)">{{ seat.assignedEngine.displayName }}</strong>
          <span v-if="showMoves" class="engine-section__score">{{ _score(seat.lines[0]) }}</span>
          <div class="engine-section__actions">
            <button v-if="_availability(seat) === EngineAvailability.Failed" class="icon-button icon-button--engine" title="Retry engine" :disabled="startDisabled" @click="emit('retryRequested', index)"><AppIcon name="rotate" /></button>
            <button v-else-if="_availability(seat) === EngineAvailability.Running || _availability(seat) === EngineAvailability.Starting" class="icon-button icon-button--engine" title="Stop engine" @click="emit('stopRequested', index)"><AppIcon name="x" /></button>
            <button class="icon-button icon-button--danger icon-button--engine" title="Remove engine" @click="emit('engineRemoveRequested', index)"><AppIcon name="trash" /></button>
          </div>
          <span v-if="!showMoves" class="engine-section__score">{{ _score(seat.lines[0]) }}</span>
        </header>
        <p v-if="!showMoves && seat.assignedEngine.$?.lastError" class="engine-error engine-error--analysis">{{ seat.assignedEngine.$.lastError }}</p>
        <template v-if="showMoves && expandedByIndex?.[index] !== false">
          <p v-if="seat.assignedEngine.$?.lastError" class="engine-error engine-error--analysis">{{ seat.assignedEngine.$.lastError }}</p>
          <div class="engine-summary"><span>{{ _summary(seat) }}</span><small>{{ seat.lines[0] ? `Depth ${seat.lines[0].depth}` : 'No principal variation yet' }}</small></div>
          <div v-if="seat.lines.length" class="analysis-lines">
            <div v-for="(line, lineIndex) in seat.lines" :key="lineIndex" class="analysis-line">
              <span>{{ lineIndex + 1 }}</span><strong class="analysis-line__score">{{ _score(line) }}</strong>
              <div class="analysis-line__moves"><button v-for="(move, moveIndex) in line.pv" :key="moveIndex" class="analysis-line__move" :disabled="disabled" :aria-label="`Play through ${getSan(move)}`" @click="emit('moveSelected', line.pv.slice(0, moveIndex + 1))">{{ getSan(move) }}</button></div>
              <small>d{{ line.depth }}</small>
            </div>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>


<script setup lang="ts">
import { EngineAvailability, type ReadonlyAnalysisSeat, type IMove } from '@/contracts';
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
function score(seat: ReadonlyAnalysisSeat): string {
  const line = seat.lines[0];
  if (line?.scoreMate !== undefined) return line.scoreMate > 0 ? `M${line.scoreMate}` : `−M${Math.abs(line.scoreMate)}`;
  if (line?.scoreCp !== undefined) {
    const value = line.scoreCp / 100;
    return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
  }
  return '—';
}
function availability(seat: ReadonlyAnalysisSeat): EngineAvailability {
  return seat.assignedEngine.$?.availability ?? EngineAvailability.Unavailable;
}
function summary(seat: ReadonlyAnalysisSeat): string {
  switch (availability(seat)) {
    case EngineAvailability.Running: return 'Evaluating position';
    case EngineAvailability.Starting: return 'Waiting for engine';
    case EngineAvailability.Failed: return 'Analysis failed';
    case EngineAvailability.Unavailable: return 'Engine unavailable';
    default: return seat.isComplete ? 'Analysis complete' : 'Analysis stopped';
  }
}
</script>

<template>
  <section class="side-panel analysis-panel">
    <header class="side-panel__header">
      <button class="side-panel__collapse" :aria-label="collapsed ? 'Expand analysis' : 'Collapse analysis'" @click="emit('collapseToggled')"><AppIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" /></button>
      <div><h2>Analysis</h2><span v-if="!collapsed">{{ seats.length ? `${seats.length} engine${seats.length === 1 ? '' : 's'}` : 'engine lines' }}</span></div>
      <div v-if="!collapsed" class="panel-actions"><button class="icon-button" title="Refresh analysis" :disabled="startDisabled || !seats.length" @click="emit('refreshRequested')"><AppIcon name="rotate" /></button><button class="icon-button" title="Add engine" :disabled="!canAdd" @click="emit('engineAddRequested')"><AppIcon name="plus" /></button></div>
    </header>
    <div v-if="!collapsed" class="side-panel__body analysis-list">
      <div v-if="seats.length === 0" class="panel-empty"><AppIcon name="activity" /><strong>No engine assigned</strong><span>Add an engine to evaluate this position.</span><button class="text-button" :disabled="!canAdd" @click="emit('engineAddRequested')"><AppIcon name="plus" />Add engine</button></div>
      <article v-for="(seat, index) in seats" v-else :key="`${seat.assignedEngine.displayName}-${index}`" class="engine-section">
        <header class="engine-section__header">
          <button class="engine-section__fold" @click="emit('engineExpandedToggled', index)"><AppIcon :name="expandedByIndex?.[index] === false ? 'chevron-right' : 'chevron-down'" /><span class="engine-section__status" :class="`engine-section__status--${availability(seat)}`"></span><strong>{{ seat.assignedEngine.displayName }}</strong></button>
          <span class="engine-section__score">{{ score(seat) }}</span>
          <button v-if="availability(seat) === EngineAvailability.Failed" class="icon-button" title="Retry engine" :disabled="startDisabled" @click="emit('retryRequested', index)"><AppIcon name="rotate" /></button>
          <button v-else-if="availability(seat) === EngineAvailability.Running || availability(seat) === EngineAvailability.Starting" class="icon-button" title="Stop engine" @click="emit('stopRequested', index)"><AppIcon name="x" /></button>
          <button class="icon-button icon-button--danger" title="Remove engine" @click="emit('engineRemoveRequested', index)"><AppIcon name="trash" /></button>
        </header>
        <template v-if="expandedByIndex?.[index] !== false">
          <p v-if="seat.assignedEngine.$?.lastError" class="engine-error">{{ seat.assignedEngine.$.lastError }}</p>
          <div v-if="showMoves && seat.lines.length" class="analysis-lines">
            <div v-for="(line, lineIndex) in seat.lines" :key="lineIndex" class="analysis-line"><span>{{ lineIndex + 1 }}</span><div class="analysis-line__moves"><button v-for="(move, moveIndex) in line.pv" :key="moveIndex" :disabled="disabled" :aria-label="`Play through ${getSan(move)}`" @click="emit('moveSelected', line.pv.slice(0, moveIndex + 1))">{{ getSan(move) }}</button></div><small>d{{ line.depth }}</small></div>
          </div>
          <div v-else class="engine-summary"><span>{{ summary(seat) }}</span><small>{{ seat.lines[0] ? `Depth ${seat.lines[0].depth}` : 'No principal variation yet' }}</small></div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.side-panel { min-height: 0; border-bottom: 0.0625rem solid var(--border-subtle); background: var(--surface-panel); }
.side-panel__header { display: flex; min-height: 2.85rem; padding: 0.45rem 0.6rem; align-items: center; gap: 0.35rem; }
.side-panel__header > div:not(.panel-actions) { display: flex; align-items: baseline; gap: 0.5rem; }
.side-panel__header h2 { margin: 0; font-family: var(--font-display); font-size: 0.9rem; font-weight: 700; }
.side-panel__header span { color: var(--text-muted); font-size: 0.62rem; }
.side-panel__collapse { display: grid; width: 1.7rem; height: 1.7rem; padding: 0; place-items: center; color: var(--text-muted); border-radius: var(--radius-sm); background: transparent; }
.side-panel__collapse:hover { color: var(--accent); background: var(--accent-soft); }
.panel-actions { display: flex; margin-left: auto; }
.panel-actions .icon-button { width: 1.75rem; height: 1.75rem; }
.side-panel__body { min-height: 0; border-top: 0.0625rem solid var(--border-subtle); }
.analysis-list { max-height: min(30vh, 18rem); overflow: auto; }
.panel-empty { display: grid; min-height: 8rem; padding: 1rem; place-items: center; align-content: center; gap: 0.35rem; color: var(--text-muted); font-size: 0.68rem; text-align: center; }
.panel-empty > .app-icon { font-size: 1.3rem; opacity: 0.6; }
.panel-empty strong { color: var(--text-primary); font-family: var(--font-display); font-size: 0.86rem; }
.panel-empty .text-button { min-height: 2rem; margin-top: 0.25rem; padding: 0.35rem 0.6rem; font-size: 0.66rem; }
.engine-section + .engine-section { border-top: 0.0625rem solid var(--border-subtle); }
.engine-section__header { display: grid; min-height: 2.5rem; padding: 0.35rem 0.45rem 0.35rem 0.6rem; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 0.25rem; }
.engine-section__fold { display: flex; min-width: 0; padding: 0; align-items: center; gap: 0.35rem; background: transparent; }
.engine-section__fold .app-icon { color: var(--text-muted); font-size: 0.78rem; }
.engine-section__fold strong { overflow: hidden; font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
.engine-section__status { width: 0.4rem; height: 0.4rem; flex: 0 0 auto; border-radius: 50%; background: var(--text-muted); }
.engine-section__status--running { background: var(--success); box-shadow: 0 0 0 0.2rem var(--success-soft); }
.engine-section__status--starting { background: var(--warning); }
.engine-section__status--failed, .engine-section__status--unavailable { background: var(--danger); }
.engine-section__score { min-width: 3.25rem; padding: 0.2rem 0.35rem; border-radius: 0.3rem; background: var(--surface-app); font-size: 0.72rem; font-variant-numeric: tabular-nums; font-weight: 800; text-align: right; }
.engine-section__header .icon-button { width: 1.65rem; height: 1.65rem; font-size: 0.8rem; }
.analysis-lines { display: grid; padding: 0 0.5rem 0.5rem; gap: 0.18rem; }
.analysis-line { display: grid; min-height: 1.9rem; padding: 0.2rem 0.45rem; grid-template-columns: 1rem minmax(0, 1fr) auto; align-items: baseline; gap: 0.35rem; border-radius: 0.3rem; background: var(--surface-app); }
.analysis-line__moves { display: flex; flex-wrap: wrap; gap: 0.1rem; }
.analysis-lines button { min-height: 1.7rem; padding: 0.2rem; color: var(--text-primary); border-radius: 0.2rem; background: transparent; font-size: 0.65rem; font-weight: 650; }
.analysis-lines button:hover:not(:disabled) { background: var(--accent-soft); }
.analysis-lines span, .analysis-lines small { color: var(--text-muted); font-size: 0.58rem; }
.analysis-lines strong { overflow: hidden; font-size: 0.65rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.engine-summary { display: flex; padding: 0 0.75rem 0.65rem 1.85rem; justify-content: space-between; color: var(--text-muted); font-size: 0.64rem; }
.engine-summary small { font-size: 0.58rem; }
.engine-error { margin: 0; padding: 0 0.75rem 0.65rem 1.85rem; color: var(--danger); font-size: 0.62rem; }
</style>

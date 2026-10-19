<script setup lang="ts">
import { computed } from 'vue';
import { MoveNodeKind, type IMoveNode, type MovePath } from '@/contracts';
import { getSan } from '@/utility/chess';
import AppIcon from './common/AppIcon.vue';

const props = defineProps<{ root: IMoveNode; renderedPath: MovePath; livePath?: MovePath; collapsed?: boolean; disabled?: boolean; revision?: number }>();
const emit = defineEmits<{ collapseToggled: []; nodeSelected: [node: IMoveNode]; returnToLiveRequested: [] }>();
interface IHistoryRow { node: IMoveNode; path: MovePath; depth: number; isVariation: boolean }
const rows = computed<IHistoryRow[]>(() => {
  void props.revision;
  const result: IHistoryRow[] = [];
  function walk(node: IMoveNode, path: MovePath, depth: number, isVariation: boolean) {
    if (node.move) result.push({ node, path, depth, isVariation });
    const mainlineIndex = node.mainlineChildIndex;
    if (mainlineIndex !== undefined && node.children[mainlineIndex]) walk(node.children[mainlineIndex]!, [...path, mainlineIndex], depth, false);
    node.children.forEach((child, index) => {
      if (index !== mainlineIndex) walk(child, [...path, index], depth + 1, true);
    });
  }
  walk(props.root, [], 0, false);
  return result;
});
const isAtLive = computed(() => pathsEqual(props.renderedPath, props.livePath));
function pathsEqual(left?: MovePath, right?: MovePath): boolean {
  return !!left && !!right && left.length === right.length && left.every((part, index) => part === right[index]);
}
function movePrefix(node: IMoveNode): string {
  const moveNumber = Math.ceil(node.plyIndex / 2);
  return node.plyIndex % 2 === 1 ? `${moveNumber}.` : `${moveNumber}…`;
}
</script>

<template>
  <section class="side-panel history-panel">
    <header class="side-panel__header">
      <button class="side-panel__collapse" :aria-label="collapsed ? 'Expand history' : 'Collapse history'" @click="emit('collapseToggled')"><AppIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" /></button>
      <div><h2>History</h2><span v-if="!collapsed">{{ rows.length }} {{ rows.length === 1 ? 'move' : 'moves' }}</span></div>
      <button v-if="livePath && !isAtLive && !collapsed" class="panel-chip" :disabled="disabled" @click="emit('returnToLiveRequested')"><span></span>Live position</button>
    </header>
    <div v-if="!collapsed" class="side-panel__body history-list">
      <button class="history-start" :class="{ 'history-row--selected': renderedPath.length === 0 }" :disabled="disabled" aria-label="Start position" @click="emit('nodeSelected', root)">Start position</button>
      <div v-if="rows.length === 0" class="panel-empty"><AppIcon name="history" /><span>Moves will appear here as the game unfolds.</span></div>
      <button
        v-for="row in rows"
        v-else
        :key="row.path.join('-')"
        class="history-row"
        :class="{ 'history-row--selected': pathsEqual(row.path, renderedPath), 'history-row--variation': row.node.kind === MoveNodeKind.Analysis || row.isVariation }"
        :style="{ paddingLeft: `${0.65 + Math.min(row.depth, 4) * 0.8}rem` }"
        :disabled="disabled"
        @click="emit('nodeSelected', row.node)"
      >
        <span class="history-row__number">{{ movePrefix(row.node) }}</span><strong>{{ row.node.move ? getSan(row.node.move) : 'Start' }}</strong><span v-if="row.node.kind === MoveNodeKind.Analysis" class="history-row__tag">analysis</span><span v-if="pathsEqual(row.path, livePath)" class="history-row__live"></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.side-panel { min-height: 0; border-bottom: 0.0625rem solid var(--border-subtle); background: var(--surface-panel); }
.side-panel__header { display: flex; min-height: 2.85rem; padding: 0.45rem 0.6rem; align-items: center; gap: 0.35rem; }
.side-panel__header > div { display: flex; align-items: baseline; gap: 0.5rem; }
.side-panel__header h2 { margin: 0; font-family: var(--font-display); font-size: 0.9rem; font-weight: 700; }
.side-panel__header span { color: var(--text-muted); font-size: 0.62rem; }
.side-panel__collapse { display: grid; width: 1.7rem; height: 1.7rem; padding: 0; place-items: center; color: var(--text-muted); border-radius: var(--radius-sm); background: transparent; }
.side-panel__collapse:hover { color: var(--accent); background: var(--accent-soft); }
.panel-chip { display: flex; min-height: 1.8rem; margin-left: auto; padding: 0.25rem 0.5rem; align-items: center; gap: 0.35rem; color: var(--accent-strong); border-radius: 999rem; background: var(--accent-soft); font-size: 0.62rem; font-weight: 700; }
.panel-chip > span { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); }
.side-panel__body { min-height: 0; border-top: 0.0625rem solid var(--border-subtle); }
.history-list { height: min(25vh, 14rem); overflow: auto; }
.panel-empty { display: grid; min-height: 7rem; padding: 1rem; place-items: center; align-content: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.7rem; text-align: center; }
.panel-empty .app-icon { font-size: 1.25rem; opacity: 0.6; }
.history-row { display: grid; width: 100%; min-height: 2.15rem; padding: 0.36rem 0.65rem; grid-template-columns: 2.5rem auto 1fr auto; align-items: center; gap: 0.4rem; color: var(--text-primary); border-bottom: 0.0625rem solid var(--border-subtle); background: transparent; text-align: left; }
.history-row:hover:not(:disabled) { background: var(--accent-soft); }
.history-start { width: 100%; min-height: 2rem; padding: 0.36rem 0.65rem; color: var(--text-muted); background: transparent; text-align: left; font-size: 0.65rem; }
.history-row--selected { background: var(--accent-soft); box-shadow: inset 0.18rem 0 0 var(--accent); }
.history-row--variation { color: var(--text-muted); }
.history-row__number { color: var(--text-muted); font-size: 0.65rem; font-variant-numeric: tabular-nums; }
.history-row strong { font-size: 0.74rem; font-weight: 700; }
.history-row__tag { justify-self: end; font-size: 0.56rem; font-style: italic; }
.history-row__live { width: 0.42rem; height: 0.42rem; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 0.18rem var(--success-soft); }
</style>

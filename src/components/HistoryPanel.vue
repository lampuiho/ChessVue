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
      <div class="side-panel__heading"><h2 class="side-panel__title">History</h2><span v-if="!collapsed" class="side-panel__meta">{{ rows.length }} {{ rows.length === 1 ? 'move' : 'moves' }}</span></div>
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
        :style="{ '--history-depth': Math.min(row.depth, 4) }"
        :disabled="disabled"
        @click="emit('nodeSelected', row.node)"
      >
        <span class="history-row__number">{{ movePrefix(row.node) }}</span><strong>{{ row.node.move ? getSan(row.node.move) : 'Start' }}</strong><span v-if="row.node.kind === MoveNodeKind.Analysis" class="history-row__tag">analysis</span><span v-if="pathsEqual(row.path, livePath)" class="history-row__live"></span>
      </button>
    </div>
  </section>
</template>


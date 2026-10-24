<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { useGamesStore, useUiStateStore } from '@/state';
import { MoveNodeKind, type IGame, type IMoveNode, type MovePath } from '@/contracts';
import { getSan } from '@/utility/chess';
import AppIcon from './common/AppIcon.vue';

const props = defineProps<{ gameId: string; disabled?: boolean }>();
const emit = defineEmits<{ nodeSelected: [node: IMoveNode] }>();
const gamesStore = useGamesStore();
const uiStateStore = useUiStateStore();
const game = computed(() => gamesStore.getGame(props.gameId) as IGame | undefined);
const root = computed(() => game.value?.moveTree.root);
const renderedPath = computed(() => game.value?.renderedPath ?? []);
const livePath = computed(() => game.value?.livePath);
const collapsed = computed(() => uiStateStore.layoutState?.historyCollapsed ?? false);
const errorMessage = ref('');
let _disposed = false;
onScopeDispose(() => { _disposed = true; });
async function _toggleSection() {
  uiStateStore.setSectionCollapsed('history');
  errorMessage.value = '';
  try { await uiStateStore.saveLayoutState(); } catch (error) {
    if (!_disposed) errorMessage.value = error instanceof Error ? error.message : 'The layout could not be saved.';
  }
}
function _selectLive() {
  let node = root.value;
  if (!node || !livePath.value) return;
  for (const index of livePath.value) node = node.children[index]!;
  emit('nodeSelected', node);
}
interface IHistoryRow { node: IMoveNode; path: MovePath; depth: number; isVariation: boolean }
const rows = computed<IHistoryRow[]>(() => {
  const result: IHistoryRow[] = [];
  function _walk(node: IMoveNode, path: MovePath, depth: number, isVariation: boolean) {
    if (node.move) result.push({ node, path, depth, isVariation });
    const mainlineIndex = node.mainlineChildIndex;
    if (mainlineIndex !== undefined && node.children[mainlineIndex]) _walk(node.children[mainlineIndex]!, [...path, mainlineIndex], depth, false);
    node.children.forEach((child, index) => {
      if (index !== mainlineIndex) _walk(child, [...path, index], depth + 1, true);
    });
  }
  if (root.value) _walk(root.value, [], 0, false);
  return result;
});
const isAtLive = computed(() => _pathsEqual(renderedPath.value, livePath.value));
function _pathsEqual(left?: MovePath, right?: MovePath): boolean {
  return !!left && !!right && left.length === right.length && left.every((part, index) => part === right[index]);
}
function _movePrefix(node: IMoveNode): string {
  const moveNumber = Math.ceil(node.plyIndex / 2);
  return node.plyIndex % 2 === 1 ? `${moveNumber}.` : `${moveNumber}…`;
}
</script>

<template>
  <section v-if="game" class="side-panel history-panel">
    <header class="side-panel__header">
      <button class="side-panel__collapse" :aria-label="collapsed ? 'Expand history' : 'Collapse history'" @click="_toggleSection()"><AppIcon :name="collapsed ? 'chevron-right' : 'chevron-down'" /></button>
      <div class="side-panel__heading"><h2 class="side-panel__title">History</h2><span v-if="!collapsed" class="side-panel__meta">{{ rows.length }} {{ rows.length === 1 ? 'move' : 'moves' }}</span></div>
      <button v-if="livePath && !isAtLive && !collapsed" class="panel-chip" :disabled="disabled" @click="_selectLive()"><span></span>Live position</button>
    </header>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
    <div v-if="!collapsed" class="side-panel__body history-list">
      <button class="history-start" :class="{ 'history-row--selected': renderedPath.length === 0 }" :disabled="disabled" aria-label="Start position" @click="emit('nodeSelected', root!)">Start position</button>
      <div v-if="rows.length === 0" class="panel-empty"><AppIcon name="history" /><span>Moves will appear here as the game unfolds.</span></div>
      <button
        v-for="row in rows"
        v-else
        :key="row.path.join('-')"
        class="history-row"
        :class="{ 'history-row--selected': _pathsEqual(row.path, renderedPath), 'history-row--variation': row.node.kind === MoveNodeKind.Analysis || row.isVariation }"
        :style="{ '--history-depth': Math.min(row.depth, 4) }"
        :disabled="disabled"
        @click="emit('nodeSelected', row.node)"
      >
        <span class="history-row__number">{{ _movePrefix(row.node) }}</span><strong>{{ row.node.move ? getSan(row.node.move) : 'Start' }}</strong><span v-if="row.node.kind === MoveNodeKind.Analysis" class="history-row__tag">analysis</span><span v-if="_pathsEqual(row.path, livePath)" class="history-row__live"></span>
      </button>
    </div>
  </section>
</template>


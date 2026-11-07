<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { DrawOfferDirection, PauseReason, PlayerType, type IGame, type IMoveNode, type MovePath } from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import { useGamesStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import ConfirmationModal from './modals/ConfirmationModal.vue';
import DrawResponseModal from './modals/DrawResponseModal.vue';
import GameCreationModal from './modals/GameCreationModal.vue';
import MessageModal from './modals/MessageModal.vue';
import ControlButton from './common/ControlButton.vue';
const props = withDefaults(defineProps<{
  gameId: string;
  mode: 'live' | 'paused' | 'inGameAnalysis' | 'freeAnalysis' | 'boardEdit' | 'finished';
  canTakeBack?: boolean;
  navigationDisabled?: boolean;
}>(), { canTakeBack: false, navigationDisabled: false });
const emit = defineEmits<{ takeBackRequested: []; analysisRequested: []; exitAnalysisRequested: []; nodeSelected: [node: IMoveNode] }>();
const gamesStore = useGamesStore();
const modal = useModal();
const game = computed(() => gamesStore.getGame(props.gameId) as IGame | undefined);
const canPause = computed(() => game.value?.timeControl.initialMs !== undefined && game.value.timeControl.preset !== 'untimed');
const drawPending = computed(() => !!game.value?.drawOfferState);
const title = computed(() => ({ live: 'Game controls', paused: 'Game paused', inGameAnalysis: 'Analysis mode', freeAnalysis: 'Study controls', boardEdit: 'Position editor', finished: 'Game review' })[props.mode]);
const errorMessage = ref('');
let _disposed = false;
onScopeDispose(() => { _disposed = true; });
async function _run(action: (currentGame: IGame) => unknown) {
  const currentGame = game.value;
  if (!currentGame) return;
  errorMessage.value = '';
  try { await action(currentGame); } catch (error) {
    if (!_disposed && game.value === currentGame) errorMessage.value = error instanceof Error ? error.message : 'The action could not be completed.';
  }
}
function _nodeAtPath(currentGame: IGame, path: MovePath) {
  let node = currentGame.moveTree.root;
  for (const index of path) node = node.children[index]!;
  return node;
}
function _mainlineChild(node: IMoveNode) {
  return node.children[node.mainlineChildIndex ?? 0];
}
const renderedNode = computed(() => game.value ? _nodeAtPath(game.value, game.value.renderedPath) : undefined);
const isAnalysisMode = computed(() => props.mode === 'inGameAnalysis' || props.mode === 'freeAnalysis' || props.mode === 'finished');
const canRewind = computed(() => !props.navigationDisabled && !!game.value?.renderedPath.length);
const canAdvance = computed(() => !props.navigationDisabled && !!renderedNode.value && !!_mainlineChild(renderedNode.value));
function _lastNode(from: IMoveNode) {
  let node = from;
  for (let next = _mainlineChild(node); next; next = _mainlineChild(node)) node = next;
  return node;
}
function _navigate(target: 'first' | 'previous' | 'next' | 'last') {
  const currentGame = game.value;
  const current = renderedNode.value;
  if (!currentGame || !current) return;
  if (target === 'first') return emit('nodeSelected', currentGame.moveTree.root);
  if (target === 'previous') return emit('nodeSelected', _nodeAtPath(currentGame, currentGame.renderedPath.slice(0, -1)));
  const next = _mainlineChild(current);
  if (next) emit('nodeSelected', target === 'next' ? next : _lastNode(next));
}
function _setPaused(paused: boolean) {
  return _run((currentGame) => paused ? gamesStore.pauseGame(currentGame, PauseReason.Manual) : gamesStore.resumeGame(currentGame, PauseReason.Manual));
}
function _toggleBoardEdit() {
  const currentGame = game.value;
  if (!currentGame) return;
  if (currentGame.gameState.includes('AnalysisFrom')) {
    modal.open(MessageModal, { title: 'Board editing is unavailable', subtitle: 'Finish in-game analysis before changing the position.', message: 'Board editing is only available in a free analysis workspace.', closeLabel: 'Understood' });
    return;
  }
  return _run(() => gamesStore.enterBoardEdit(currentGame));
}
function _requestSetupStart() {
  if (game.value) modal.open(GameCreationModal, { gameId: props.gameId });
}
function _turnColour(currentGame: IGame) {
  return MoveApplicationService.genPosition(currentGame.rootPosition, MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.livePath ?? currentGame.renderedPath)).sideToMove;
}
function _requestResignation() {
  const currentGame = game.value;
  if (!currentGame) return;
  const colour = _turnColour(currentGame);
  modal.open(ConfirmationModal, {
    title: 'Resign this game?', subtitle: 'This records the game as finished. You can still review the position afterwards.',
    message: `Confirm that ${colour} resigns.`, confirmLabel: 'Resign', danger: true,
    confirm: () => gamesStore.resignGame(currentGame, colour),
  });
}
function _handleDraw() {
  const currentGame = game.value;
  if (!currentGame) return;
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Incoming) return _run(() => gamesStore.acceptDrawOffer(currentGame));
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Outgoing) return _run(() => gamesStore.withdrawDrawOffer(currentGame));
  if (currentGame.whitePlayer?.type === PlayerType.Local && currentGame.blackPlayer?.type === PlayerType.Local) {
    const offeringColour = _turnColour(currentGame);
    modal.open(ConfirmationModal, {
      title: 'Offer a draw?', subtitle: 'The other side will be asked to accept or decline.',
      message: `Offer a draw from the ${offeringColour} side.`, confirmLabel: 'Offer draw',
      confirm: (signal) => _offerDraw(currentGame, signal),
    });
  } else return _run(() => gamesStore.offerDraw(currentGame));
}
async function _offerDraw(currentGame: IGame, signal: AbortSignal) {
  await gamesStore.offerDraw(currentGame);
  signal.throwIfAborted();
  modal.open(DrawResponseModal, { gameId: currentGame.metadata.id });
}
</script>
<template>
  <section v-if="game" class="control-panel">
    <div class="control-panel__heading"><div class="heading-stack"><span class="control-panel__eyebrow">{{ mode === 'live' ? 'Your move' : 'Workspace' }}</span><h2>{{ title }}</h2></div><span v-if="mode === 'live'" class="turn-indicator"><i></i>Live</span><span v-else-if="mode === 'paused'" class="turn-indicator turn-indicator--paused"><i></i>Paused</span></div>
    <div class="control-grid">
      <template v-if="isAnalysisMode">
        <ControlButton icon="skip-back" label="First move" :disabled="!canRewind" @click="_navigate('first')" />
        <ControlButton icon="chevron-left" label="Previous move" :disabled="!canRewind" @click="_navigate('previous')" />
        <ControlButton icon="chevron-right" label="Next move" :disabled="!canAdvance" @click="_navigate('next')" />
        <ControlButton icon="skip-forward" label="Last move" :disabled="!canAdvance" @click="_navigate('last')" />
      </template>
      <ControlButton v-if="mode === 'paused'" icon="play" label="Resume game" variant="primary" @click="_setPaused(false)" />
      <ControlButton v-else-if="mode === 'boardEdit'" icon="check" label="Finish editing" variant="primary" @click="_toggleBoardEdit()" />
      <template v-else>
        <ControlButton v-if="mode !== 'finished'" icon="undo" label="Takeback" :disabled="!canTakeBack" @click="emit('takeBackRequested')" />
        <ControlButton v-if="(mode === 'live' || mode === 'inGameAnalysis') && canPause" icon="pause" label="Pause" @click="_setPaused(true)" />
        <ControlButton v-if="mode === 'live'" icon="activity" label="Analyse" @click="emit('analysisRequested')" />
        <ControlButton v-if="mode === 'inGameAnalysis'" icon="play" label="Exit analysis" variant="primary" @click="emit('exitAnalysisRequested')" />
        <ControlButton v-if="mode === 'freeAnalysis'" icon="edit" label="Edit board" @click="_toggleBoardEdit()" />
        <ControlButton v-if="mode === 'freeAnalysis'" icon="play" label="Start game" variant="primary" @click="_requestSetupStart()" />
        <ControlButton v-if="mode === 'live'" icon="handshake" :label="drawPending ? 'Resolve draw' : 'Offer draw'" @click="_handleDraw()"><i class="control-button__indicator" :class="{ active: drawPending }"></i></ControlButton>
        <ControlButton v-if="mode === 'live'" icon="flag" label="Resign" variant="danger" @click="_requestResignation()" />
      </template>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
    <p v-if="mode === 'finished'" class="control-note">The result is recorded. Step through the moves to review how the game went.</p>
  </section>
</template>


<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { DrawOfferDirection, PauseReason, PlayerType, type IGame } from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import { useGamesStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import ConfirmationModal from './modals/ConfirmationModal.vue';
import DrawResponseModal from './modals/DrawResponseModal.vue';
import GameCreationModal from './modals/GameCreationModal.vue';
import MessageModal from './modals/MessageModal.vue';
import AppIcon from './common/AppIcon.vue';
const props = withDefaults(defineProps<{
  gameId: string;
  mode: 'live' | 'paused' | 'inGameAnalysis' | 'freeAnalysis' | 'boardEdit' | 'finished';
  canTakeBack?: boolean;
}>(), { canTakeBack: false });
const emit = defineEmits<{ takeBackRequested: []; analysisRequested: []; exitAnalysisRequested: [] }>();
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
    <div class="control-panel__heading"><div><span class="control-panel__eyebrow">{{ mode === 'live' ? 'Your move' : 'Workspace' }}</span><h2>{{ title }}</h2></div><span v-if="mode === 'live'" class="turn-indicator"><i></i>Live</span><span v-else-if="mode === 'paused'" class="turn-indicator turn-indicator--paused"><i></i>Paused</span></div>
    <div class="control-grid">
      <button v-if="mode === 'paused'" class="control-button control-button--primary control-button--wide" @click="_setPaused(false)"><AppIcon name="play" /><span><strong>Resume game</strong><small>Restart the clock</small></span></button>
      <template v-else-if="mode === 'boardEdit'">
        <button class="control-button control-button--primary control-button--wide" @click="_toggleBoardEdit()"><AppIcon name="check" /><span><strong>Finish editing</strong><small>Return to analysis</small></span></button>
      </template>
      <template v-else>
        <button class="control-button" :disabled="!canTakeBack" @click="emit('takeBackRequested')"><AppIcon name="undo" /><span><strong>Takeback</strong><small>Undo your last move</small></span></button>
        <button v-if="(mode === 'live' || mode === 'inGameAnalysis') && canPause" class="control-button" @click="_setPaused(true)"><AppIcon name="pause" /><span><strong>Pause</strong><small>Stop the clock</small></span></button>
        <button v-if="mode === 'live'" class="control-button" @click="emit('analysisRequested')"><AppIcon name="activity" /><span><strong>Analyse</strong><small>Explore from here</small></span></button>
        <button v-if="mode === 'inGameAnalysis'" class="control-button control-button--primary" @click="emit('exitAnalysisRequested')"><AppIcon name="play" /><span><strong>Exit analysis</strong><small>Return to live play</small></span></button>
        <button v-if="mode === 'freeAnalysis'" class="control-button" @click="_toggleBoardEdit()"><AppIcon name="edit" /><span><strong>Edit board</strong><small>Build a position</small></span></button>
        <button v-if="mode === 'freeAnalysis'" class="control-button control-button--primary" @click="_requestSetupStart()"><AppIcon name="play" /><span><strong>Start game</strong><small>Play this position</small></span></button>
      </template>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
    <div v-if="mode === 'live'" class="control-grid control-panel__secondary">
      <button class="control-button" @click="_handleDraw()"><AppIcon name="handshake" /><span><strong>{{ drawPending ? 'Resolve draw' : 'Offer draw' }}</strong></span><i class="control-button__indicator" :class="{ active: drawPending }"></i></button>
      <button class="control-button" @click="_requestResignation()"><AppIcon name="flag" /><span><strong>Resign</strong></span></button>
    </div>
    <p v-if="mode === 'finished'" class="control-note">The result is recorded. You can review the history or rewind where takebacks are allowed.</p>
  </section>
</template>


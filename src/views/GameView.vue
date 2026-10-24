<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  BoardOrientation,
  GameState,
  PauseReason,
  PieceKind,
  PlayerColour,
  PlayerType,
  ResultReason,
  ResultState,
  type BoardId,
  type IBoardPosition,
  type ICapturedPieceGroup,
  type IGame,
  type IMoveRaw,
  type IMoveNode,
  type IPremoveQueue,
} from '@/contracts';
import { MoveApplicationService, MoveHistoryService, TimeControlService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { buildFen, genCandidateMovesForPiece, getOpponentColour, isMoveLegal, toDetailedMove } from '@/utility/chess';
import { useGamePosition } from '@/state/game/GamePositionComposable';
import { OperationOwner } from '@/utility/async/OperationOwner';
import { abortableDelay } from '@/utility/async/Abortable';
import { useGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import { useModal, type IModalHandle } from '@/composables/ModalComposable';
import GameCreationModal from '@/components/modals/GameCreationModal.vue';
import ConfirmationModal from '@/components/modals/ConfirmationModal.vue';
import MessageModal from '@/components/modals/MessageModal.vue';
import MenuBar from '@/components/MenuBar.vue';
import GameTabs from '@/components/GameTabs.vue';
import Chessboard from '@/components/Chessboard.vue';
import PlayerPanel from '@/components/PlayerPanel.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';
import AnalysisPanel from '@/components/AnalysisPanel.vue';
import GameControlPanel from '@/components/GameControlPanel.vue';
import AppIcon from '@/components/common/AppIcon.vue';

interface IRenderedBoard {
  game: IGame; node: IMoveNode; position: IBoardPosition; analysis: boolean; inputAllowed: boolean; ongoing: boolean; boardEdit: boolean;
  queue?: IPremoveQueue; head?: IMoveRaw; tail?: IMoveRaw; heldLocalMove?: IMoveRaw;
  premoveColour?: PlayerColour; displayPosition?: IBoardPosition; premoveSquares?: ReadonlySet<BoardId>;
}
const gamePosition = useGamePosition();
const modal = useModal();
const route = useRoute();
const router = useRouter();
const gamesStore = useGamesStore();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const now = ref(Date.now());
const notice = ref('');
const isPlayingLine = ref(false);
interface IContinuation { game: IGame; node: IMoveNode; moves: readonly IMoveRaw[]; }
let continuation: IModalHandle | undefined;
const playback = new OperationOwner();
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const gameId = computed(() => String(route.params.id));
const game = toRef(() => {
  return gamesStore.getGame(gameId.value) as unknown as IGame | undefined;
});
const settings = computed(() => settingsStore.settings);
const layout = computed(() => uiStateStore.layoutState);
const renderedNode = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return;
  let node = currentGame.moveTree.root;
  for (const childIndex of currentGame.renderedPath) node = node.children[childIndex]!;
  return node;
});
const livePosition = computed(() => {
  const currentGame = game.value;
  if (!currentGame?.livePath) return;
  return MoveApplicationService.genPosition(currentGame.rootPosition, MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.livePath));
});
const isInGameAnalysis = computed(() => !!game.value?.gameState.includes('AnalysisFrom'));
const localPlayer = computed(() => {
  const currentGame = game.value;
  return currentGame?.whitePlayer?.type === PlayerType.Local && currentGame.blackPlayer?.type === PlayerType.Engine ? currentGame.whitePlayer
    : currentGame?.blackPlayer?.type === PlayerType.Local && currentGame.whitePlayer?.type === PlayerType.Engine ? currentGame.blackPlayer : undefined;
});
const premoveColour = computed(() => {
  const currentGame = game.value;
  if (!currentGame || !localPlayer.value || isInGameAnalysis.value || currentGame.gameState.startsWith('paused')
    || currentGame.gameState === GameState.BoardEdit || currentGame.resultState !== ResultState.Ongoing
    || !currentGame.livePath || currentGame.renderedPath !== currentGame.livePath) return;
  if (livePosition.value?.sideToMove !== localPlayer.value.colour) return localPlayer.value.colour;
});
const canInput = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return false;
  if (isInGameAnalysis.value) return true;
  if (currentGame.gameState.startsWith('paused')) return false;
  if (!currentGame.livePath || currentGame.resultState !== ResultState.Ongoing || currentGame.gameState === GameState.BoardEdit) return true;
  if (currentGame.renderedPath !== currentGame.livePath) return !!currentGame.gameplayOptions.allowTakeback
    && currentGame.renderedPath.length < currentGame.livePath.length && currentGame.renderedPath.every((part, index) => part === currentGame.livePath![index]);
  const player = livePosition.value?.sideToMove === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  return player?.type === PlayerType.Local || premoveColour.value !== undefined;
});
const renderedBoard = computed<IRenderedBoard | undefined>((previous) => {
  const currentGame = game.value;
  const node = renderedNode.value;
  if (!currentGame || !node) return;
  const next = MoveApplicationService.genPosition(currentGame.rootPosition, MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.renderedPath));
  const analysis = isInGameAnalysis.value;
  const inputAllowed = canInput.value;
  const ongoing = currentGame.resultState === ResultState.Ongoing;
  const boardEdit = currentGame.gameState === GameState.BoardEdit;
  const visible = ongoing && !analysis && !boardEdit && !!localPlayer.value && !!currentGame.livePath && currentGame.renderedPath === currentGame.livePath;
  // A shifted head reaches canonical play through the existing asynchronous turn handler.
  const resolvingLocal = !!currentGame.$?.pendingPlayerTurnPromise && livePosition.value?.sideToMove === localPlayer.value?.colour;
  const queue = visible && !resolvingLocal ? currentGame.$?.premoveQueue : undefined;
  const held = currentGame.$?.deferredPlayerMove;
  const heldLocalMove = visible && held?.movingColour === localPlayer.value?.colour ? held : undefined;
  const head = queue?.moves[0];
  const tail = queue?.moves[queue.moves.length - 1];
  const colour = premoveColour.value;
  const samePosition = previous?.game === currentGame && previous.node === node && buildFen(previous.position) === buildFen(next);
  const sameContext = samePosition && previous.analysis === analysis && previous.inputAllowed === inputAllowed
    && previous.ongoing === ongoing && previous.boardEdit === boardEdit;
  // Publications retain input only while the selected board and its permissions share the same owner.
  if (sameContext && previous.queue === queue && previous.head === head && previous.tail === tail
    && previous.heldLocalMove === heldLocalMove && previous.premoveColour === colour) return previous;
  const canonical = sameContext ? previous.position : next;
  const projection = queue || heldLocalMove ? gamePosition.getPremoveProjection(canonical, queue, heldLocalMove) : undefined;
  return { game: currentGame, node, position: canonical, analysis, inputAllowed, ongoing, boardEdit, queue, head, tail, heldLocalMove,
    premoveColour: colour, displayPosition: projection?.position, premoveSquares: projection?.redSquares };
});
const inputActions = computed(() => {
  const owner = renderedBoard.value;
  return {
    move: (move: IMoveRaw) => renderedBoard.value === owner ? _makeMove(move) : undefined,
    line: (moves: readonly IMoveRaw[]) => renderedBoard.value === owner ? _playAnalysisLine(moves) : undefined,
    analyse: () => _runInputAction(owner, (currentGame) => gamesStore.enterInGameAnalysis(currentGame)),
    exit: () => _runInputAction(owner, (currentGame) => gamesStore.exitInGameAnalysis(currentGame)),
    takeBack: () => _runInputAction(owner, (currentGame) => gamesStore.takeBack(currentGame)),
    cancelPremoves: () => _runInputAction(owner, (currentGame) => gamesStore.clearPremoves(currentGame)),
  };
});
const position = computed(() => renderedBoard.value?.position);
const lastMove = computed(() => renderedNode.value?.move);
const remainingTime = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return { white: undefined, black: undefined };
  return TimeControlService.getRemainingTime(currentGame.clockSnapshot, new ClockTimestamp(now.value));
});
const controlMode = computed<'live' | 'paused' | 'inGameAnalysis' | 'freeAnalysis' | 'boardEdit' | 'finished'>(() => {
  const currentGame = game.value;
  if (!currentGame) return 'finished';
  if (currentGame.gameState === GameState.BoardEdit) return 'boardEdit';
  if (currentGame.gameState.startsWith('paused')) return 'paused';
  if (currentGame.resultState !== ResultState.Ongoing) return 'finished';
  if (currentGame.gameState.includes('AnalysisFrom')) return 'inGameAnalysis';
  if (!currentGame.livePath) return 'freeAnalysis';
  return 'live';
});
const isBoardInputDisabled = computed(() => {
  return !canInput.value || isPlayingLine.value;
});
const isHistoryInputDisabled = computed(() => controlMode.value === 'boardEdit' || (controlMode.value === 'paused' && !isInGameAnalysis.value) || isPlayingLine.value);
const actualTurnColour = computed(() => game.value?.resultState === ResultState.Ongoing && !game.value.gameState.startsWith('paused') ? livePosition.value?.sideToMove : undefined);
const canTakeBack = computed(() => {
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'boardEdit' || controlMode.value === 'paused' || isPlayingLine.value) return false;
  const hasMove = gamesStore.getTakeBackMoveCount(currentGame) > 0;
  return hasMove && (!currentGame.livePath || !!currentGame.gameplayOptions.allowTakeback);
});
const showAnalysisMoves = computed(() => !game.value?.livePath || !!game.value.gameplayOptions.showLiveAnalysisMoves);
const topColour = computed(() => settings.value?.appearance.boardOrientation === BoardOrientation.Black ? PlayerColour.White : PlayerColour.Black);
const bottomColour = computed(() => topColour.value === PlayerColour.White ? PlayerColour.Black : PlayerColour.White);
const capturedByColour = computed(() => {
  const result: Record<PlayerColour, ICapturedPieceGroup[]> = { white: [], black: [] };
  const currentGame = game.value;
  if (!currentGame) return result;
  const countByColour: Record<PlayerColour, Map<PieceKind, number>> = { white: new Map(), black: new Map() };
  for (const move of MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.renderedPath)) {
    if (!move.capturePiece) continue;
    const counts = countByColour[move.movingColour];
    counts.set(move.capturePiece, (counts.get(move.capturePiece) ?? 0) + 1);
  }
  for (const colour of [PlayerColour.White, PlayerColour.Black]) result[colour] = [...countByColour[colour]].map(([pieceKind, count]) => ({ pieceKind, count }));
  return result;
});

onMounted(() => {
  void _run(async () => {
    const fallback = await _activateGame(gameId.value);
    if (fallback) await router.replace(fallback);
  });
  clockTimer = setInterval(() => {
    now.value = Date.now();
    void _reconcileTimeout();
  }, 250);
});
onBeforeRouteUpdate((to) => _activateGame(String(to.params.id)));
onBeforeRouteLeave(() => { _closeContinuation(); return playback.cancel(); });
const disposeAutosaveNotice = gamesStore.onAutosaveFailed((message) => _showNotice(`Automatic save failed: ${message}`));
onBeforeUnmount(() => {
  _closeContinuation();
  void playback.dispose();
  disposeAutosaveNotice();
  if (clockTimer) clearInterval(clockTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
});
async function _activateGame(id: string) {
  await playback.cancel();
  _closeContinuation();
  now.value = Date.now();
  const selected = gamesStore.getGame(id) as IGame | undefined;
  if (selected) return _handleMenuInterruptionCompleted(selected);
  const fallbackId = uiStateStore.gameSession?.openGameIds.find((id) => gamesStore.getGame(id));
  return fallbackId ? `/game/${fallbackId}` : '/home';
}
async function _reconcileTimeout() {
  const currentGame = game.value;
  const runtime = currentGame?.$;
  if (!currentGame || !runtime) return;
  if (runtime.timeoutNotificationShown && currentGame.resultState !== ResultState.Ongoing) return;
  if (currentGame.resultReason !== ResultReason.Timeout && currentGame.resultState !== ResultState.Ongoing) return;
  if ((remainingTime.value.white ?? 1) > 0 && (remainingTime.value.black ?? 1) > 0) return;
  if (currentGame.resultState === ResultState.Ongoing) await gamesStore.syncClock(currentGame, new ClockTimestamp());
  if (game.value !== currentGame || runtime.timeoutNotificationShown) return;
  if (currentGame.resultReason !== ResultReason.Timeout) return;
  runtime.timeoutNotificationShown = true;
  modal.open(MessageModal, { title: 'Time has expired', subtitle: 'The game is finished, but the position remains available for review.', message: `${currentGame.resultState === ResultState.WhiteWon ? 'White wins' : 'Black wins'} on time.`, closeLabel: 'Review game' });
}
async function _handleMenuInterruptionRequested(action: () => Promise<unknown> | unknown) {
  await playback.cancel();
  const currentGame = game.value;
  if (!currentGame) return;
  if (settings.value?.gameSession.autoPauseOnMenu) await gamesStore.pauseGame(currentGame, PauseReason.Menu);
  await action();
}
async function _handleMenuInterruptionCompleted(currentGame = game.value) {
  if (!currentGame?.$?.pauseReasons?.includes(PauseReason.Menu)) return;
  await gamesStore.resumeGame(currentGame, PauseReason.Menu);
}
function _openCustomGame() {
  const interrupted = game.value;
  return _handleMenuInterruptionRequested(() => modal.open(GameCreationModal, {}, () => {
    if (game.value === interrupted) return _handleMenuInterruptionCompleted(interrupted);
  }));
}
async function _makeMove(move: IMoveRaw) {
  await _requestMoves([move]);
}
async function _runInputAction(owner: IRenderedBoard | undefined, action: (currentGame: IGame) => Promise<void> | void) {
  if (!owner || renderedBoard.value !== owner) return;
  await playback.cancel();
  if (renderedBoard.value !== owner) return;
  _closeContinuation();
  await _run(() => action(owner.game));
}
async function _navigateToNode(node: IMoveNode) {
  const currentGame = game.value;
  if (!currentGame) return;
  await playback.cancel();
  if (game.value !== currentGame) return;
  _closeContinuation();
  await _run(() => gamesStore.navigateToNode(currentGame, node));
}
async function _playAnalysisLine(moves: readonly IMoveRaw[]) {
  const currentGame = game.value;
  if (!currentGame || !showAnalysisMoves.value || isPlayingLine.value) return;
  const explore = !currentGame.livePath || currentGame.resultState !== ResultState.Ongoing || isInGameAnalysis.value;
  if (!explore && premoveColour.value) {
    const move = moves[moves.length - 1];
    const mover = moves.length % 2 ? position.value!.sideToMove : getOpponentColour(position.value!.sideToMove);
    const preview = renderedBoard.value!.displayPosition ?? position.value!;
    if (!move || mover !== premoveColour.value || preview.board[move.from]?.colour !== mover
      || !genCandidateMovesForPiece(preview, move.from).some((candidate) => candidate.to === move.to && candidate.promotionPiece === move.promotionPiece)) return;
    await _requestMoves([move]);
    return;
  }
  await _requestMoves(explore ? moves : moves.slice(0, 1));
}
async function _requestMoves(moves: readonly IMoveRaw[]) {
  const currentGame = game.value;
  if (!currentGame || !moves.length || !canInput.value || isPlayingLine.value || currentGame.gameState === GameState.BoardEdit) return;
  if (premoveColour.value) {
    await _run(() => gamesStore.makeMove(currentGame, moves[0]!));
    return;
  }
  const livePath = currentGame.livePath;
  const historical = livePath && currentGame.renderedPath.length < livePath.length && currentGame.renderedPath.every((part, index) => part === livePath[index]);
  if (historical && !isInGameAnalysis.value && currentGame.resultState === ResultState.Ongoing && currentGame.gameplayOptions.allowTakeback) {
    const pending = { game: currentGame, node: renderedNode.value!, moves };
    continuation = modal.open(ConfirmationModal, {
      title: 'Continue from this position?', subtitle: 'This changes the played line. The previous continuation will remain as a variation.',
      confirmLabel: 'Continue game', confirm: (signal) => _confirmContinuation(pending, signal),
    });
    return;
  }
  await _run(() => _applyMoves(currentGame, moves));
}
function _closeContinuation() {
  const current = continuation;
  continuation = undefined;
  void current?.close();
}
async function _confirmContinuation(pending: IContinuation, signal: AbortSignal) {
  if (signal.aborted) return;
  if (!pending || game.value !== pending.game || renderedNode.value !== pending.node || isInGameAnalysis.value
    || pending.game.resultState !== ResultState.Ongoing || pending.game.gameState.startsWith('paused') || !pending.game.gameplayOptions.allowTakeback) return;
  await _run(() => _applyMoves(pending.game, pending.moves));
}
async function _applyMoves(currentGame: IGame, moves: readonly IMoveRaw[]) {
  const preview = MoveApplicationService.genPosition(position.value!, []);
  for (const move of moves) {
    if (!isMoveLegal(preview, move)) throw new Error('This suggested move is stale. Refresh analysis and try again.');
    const detailed = toDetailedMove(preview, move);
    MoveApplicationService.applyMove(preview, detailed);
  }
  const tree = currentGame.moveTree;
  const analysis = isInGameAnalysis.value;
  const ongoing = currentGame.resultState === ResultState.Ongoing;
  await playback.run(async (signal) => {
    isPlayingLine.value = moves.length > 1;
    let expectedPath = [...currentGame.renderedPath];
    try {
      for (const [index, move] of moves.entries()) {
        if (index > 0) await abortableDelay(350, signal);
        signal.throwIfAborted();
        if (game.value !== currentGame || currentGame.moveTree !== tree || analysis !== isInGameAnalysis.value
          || ongoing !== (currentGame.resultState === ResultState.Ongoing) || !canInput.value || currentGame.gameState === GameState.BoardEdit
          || JSON.stringify(expectedPath) !== JSON.stringify(currentGame.renderedPath)) return;
        await gamesStore.makeMove(currentGame, move);
        expectedPath = [...currentGame.renderedPath];
      }
    } finally {
      isPlayingLine.value = false;
    }
  });
}
function _showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.value = '', 3600);
}
async function _run(action: () => Promise<void> | void) {
  try {
    await action();
  } catch (error) {
    _showNotice(error instanceof Error ? error.message : 'The action could not be completed.');
  }
}
</script>

<template>
  <main v-if="game && position" class="game-page app-page">
    <MenuBar :game-id="game.metadata.id"
      @home-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/home')))"
      @custom-new-game-requested="_run(_openCustomGame)"
      @load-game-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/saved-games/load')))"
      @save-game-requested="_run(() => _handleMenuInterruptionRequested(() => router.push(`/saved-games/save/${game!.metadata.id}`)))"
      @settings-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/settings/session')))" />
    <div class="game-content">
      <GameTabs />
      <div class="game-stage">
        <section class="board-column" :class="{ 'board-column--editing': controlMode === 'boardEdit' }">
          <PlayerPanel :colour="topColour" :game-id="game.metadata.id" :selection-disabled="isPlayingLine" :remaining-ms="remainingTime[topColour]" :active="actualTurnColour === topColour" :captured-pieces="capturedByColour[topColour]" />
          <Chessboard
            :position="position"
            :display-position="renderedBoard?.displayPosition"
            :premove-squares="renderedBoard?.premoveSquares"
            :premove-colour="renderedBoard?.premoveColour"
            :orientation="settings?.appearance.boardOrientation"
            :show-coordinates="settings?.appearance.showCoordinates"
            :highlight-last-move="settings?.appearance.highlightLastMove"
            :last-move="lastMove"
            :input-disabled="isBoardInputDisabled"
            :board-edit="controlMode === 'boardEdit'"
            @move-attempted="inputActions.move"
            @premoves-cancelled="inputActions.cancelPremoves"
            @chess-piece-toggled="(boardId, piece) => gamesStore.toggleChessPiece(game!, boardId, piece)"
            @chess-piece-deleted="(boardId) => gamesStore.deleteChessPiece(game!, boardId)"
            @chess-piece-moved="(from, to) => gamesStore.moveChessPiece(game!, from, to)"
            @board-cleared="gamesStore.clearBoard(game!)"
            @board-reset="gamesStore.resetBoardToStartPosition(game!)"
          />
          <PlayerPanel :colour="bottomColour" :game-id="game.metadata.id" :selection-disabled="isPlayingLine" :remaining-ms="remainingTime[bottomColour]" :active="actualTurnColour === bottomColour" :captured-pieces="capturedByColour[bottomColour]" />
        </section>
        <aside class="game-sidebar surface">
          <div class="game-sidebar__title"><div><p>{{ game.livePath ? 'Game workspace' : 'Analysis study' }}</p><h1 :title="game.metadata.name">{{ game.metadata.name }}</h1></div><span class="result-badge" :class="{ 'result-badge--finished': game.resultState !== ResultState.Ongoing }">{{ game.resultState === ResultState.Ongoing ? (livePosition?.sideToMove ?? position.sideToMove) + ' to move' : game.resultState.replace('Won', ' won') }}</span></div>
          <HistoryPanel v-if="layout?.showHistoryPanel" :game-id="game.metadata.id" :disabled="isHistoryInputDisabled" @node-selected="_navigateToNode" />
          <AnalysisPanel v-if="layout?.showAnalysisPanel" :game-id="game.metadata.id" :disabled="isBoardInputDisabled || controlMode === 'boardEdit'" @move-selected="inputActions.line" />
          <button v-if="controlMode === 'paused'" class="control-button" @click="isInGameAnalysis ? inputActions.exit() : inputActions.analyse()"><AppIcon name="activity" /><span><strong>{{ isInGameAnalysis ? 'Exit analysis' : 'Analyse' }}</strong><small>The game stays paused</small></span></button>
          <GameControlPanel class="game-sidebar__controls" :game-id="game.metadata.id" :mode="controlMode" :can-take-back="canTakeBack"
            @take-back-requested="inputActions.takeBack" @analysis-requested="inputActions.analyse" @exit-analysis-requested="inputActions.exit" />
        </aside>
      </div>
    </div>
    <div v-if="notice" class="toast"><AppIcon name="info" />{{ notice }}</div>
  </main>
</template>


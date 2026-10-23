<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  BoardOrientation,
  DrawOfferDirection,
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
  type ICreateGameRequest,
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
import PlayerSelectionModal from '@/components/modals/PlayerSelectionModal.vue';
import AnalysisEngineSelectionModal from '@/components/modals/AnalysisEngineSelectionModal.vue';
import DrawResponseModal from '@/components/modals/DrawResponseModal.vue';
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
const tabs = computed(() => {
  return gamesStore.listGames().filter((candidate) => uiStateStore.gameSession?.openGameIds.includes(candidate.metadata.id)).map((candidate) => ({ id: candidate.metadata.id, name: candidate.metadata.name }));
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
const canPause = computed(() => game.value?.timeControl.initialMs !== undefined && game.value.timeControl.preset !== 'untimed');
const canAddEngine = computed(() => !!game.value && game.value.analysis.seats.length < 4 && (settings.value?.analysis.engineInventory.length ?? 0) > game.value.analysis.seats.length);
const showAnalysisMoves = computed(() => !game.value?.livePath || !!game.value.gameplayOptions.showLiveAnalysisMoves);
const analysisSeats = computed(() => {
  return game.value ? gamesStore.getVisibleAnalysis(game.value)?.engineSeats ?? [] : [];
});
const topColour = computed(() => settings.value?.appearance.boardOrientation === BoardOrientation.Black ? PlayerColour.White : PlayerColour.Black);
const bottomColour = computed(() => topColour.value === PlayerColour.White ? PlayerColour.Black : PlayerColour.White);
const topPlayer = computed(() => topColour.value === PlayerColour.White ? game.value?.whitePlayer : game.value?.blackPlayer);
const bottomPlayer = computed(() => bottomColour.value === PlayerColour.White ? game.value?.whitePlayer : game.value?.blackPlayer);
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
async function _quickNewGame() {
  const defaults = settings.value?.gameDefaults;
  if (!defaults) return;
  const request: ICreateGameRequest = {
    name: defaults.quickNewGameName,
    whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
    blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
    analysisEngineProfiles: [],
    allowTakeback: true,
    showLiveAnalysisMoves: false,
    timeControl: { ...defaults.defaultTimeControl },
  };
  await _run(async () => {
    const createdGame = await gamesStore.createGame(request);
    uiStateStore.openTab(createdGame.metadata.id);
    await router.push(`/game/${createdGame.metadata.id}`);
  });
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
async function _selectTab(id: string) {
  uiStateStore.setActiveGame(id);
  await router.push(`/game/${id}`);
}
async function _closeTab(id: string) {
  const closing = gamesStore.getGame(id) as IGame | undefined;
  if (closing) gamesStore.clearPremoves(closing);
  uiStateStore.closeTab(id);
  const activeId = uiStateStore.gameSession?.activeGameId;
  await router.push(activeId ? `/game/${activeId}` : '/home');
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
async function _returnToLivePosition() {
  const currentGame = game.value;
  if (!currentGame?.livePath) return;
  let node = currentGame.moveTree.root;
  for (const index of currentGame.livePath) node = node.children[index]!;
  await _navigateToNode(node);
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
async function _toggleBoardEdit() {
  const currentGame = game.value;
  if (!currentGame) return;
  if (isInGameAnalysis.value) {
    modal.open(MessageModal, { title: 'Board editing is unavailable', subtitle: 'Finish in-game analysis before changing the position.', message: 'Board editing is only available in a free analysis workspace.', closeLabel: 'Understood' });
    return;
  }
  await _run(async () => gamesStore.enterBoardEdit(currentGame));
}
async function _handleDraw() {
  const currentGame = game.value;
  if (!currentGame || !position.value) return;
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Incoming) return _run(() => gamesStore.acceptDrawOffer(currentGame));
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Outgoing) return _run(() => gamesStore.withdrawDrawOffer(currentGame));
  const isLocalGame = currentGame.whitePlayer?.type === PlayerType.Local && currentGame.blackPlayer?.type === PlayerType.Local;
  if (isLocalGame) {
    const offeringColour = livePosition.value?.sideToMove ?? position.value.sideToMove;
    modal.open(ConfirmationModal, {
      title: 'Offer a draw?', subtitle: 'The other side will be asked to accept or decline.',
      message: `Offer a draw from the ${offeringColour} side.`, confirmLabel: 'Offer draw',
      confirm: (signal) => _offerDraw(currentGame, offeringColour, signal),
    });
  } else await _run(() => gamesStore.offerDraw(currentGame));
}
async function _offerDraw(currentGame: IGame, offeringColour: PlayerColour, signal: AbortSignal) {
  await gamesStore.offerDraw(currentGame);
  signal.throwIfAborted();
  modal.open(DrawResponseModal, { gameId: currentGame.metadata.id, respondingColour: offeringColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White });
}
function _requestSetupStart() {
  if (game.value) modal.open(GameCreationModal, { gameId: game.value.metadata.id });
}
function _requestResignation() {
  const currentGame = game.value;
  const colour = livePosition.value?.sideToMove ?? position.value?.sideToMove;
  if (!currentGame || !colour) return;
  modal.open(ConfirmationModal, {
    title: 'Resign this game?', subtitle: 'This records the game as finished. You can still review the position afterwards.',
    message: `Confirm that ${colour} resigns.`, confirmLabel: 'Resign', danger: true,
    confirm: () => gamesStore.resignGame(currentGame, colour),
  });
}
function _requestPlayerSelection(colour: PlayerColour) {
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'boardEdit') return;
  const player = colour === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  modal.open(PlayerSelectionModal, { gameId: currentGame.metadata.id, colour, currentPlayer: player });
}
function _requestAnalysisEngine() {
  const currentGame = game.value;
  if (!currentGame) return;
  modal.open(AnalysisEngineSelectionModal, { gameId: currentGame.metadata.id, currentAnalysisEngines: currentGame.analysis.seats.map((seat) => seat.assignedEngine) });
}
function _toggleSection(section: 'history' | 'analysis') {
  uiStateStore.setSectionCollapsed(section);
  void _run(() => uiStateStore.saveLayoutState());
}
function _toggleAnalysisEngine(index: number) {
  uiStateStore.setAnalysisEngineExpanded(index);
  void _run(() => uiStateStore.saveLayoutState());
}
async function _removeAnalysisEngine(index: number) {
  const currentGame = game.value;
  if (!currentGame?.analysis.seats[index]) return;
  const cleanup = gamesStore.removeAnalysisEngine(currentGame, index);
  let saving = Promise.resolve();
  if (layout.value) {
    const expanded = [...layout.value.analysisEngineExpandedByIndex];
    expanded.splice(index, 1);
    uiStateStore.setLayoutState({ ...layout.value, analysisEngineExpandedByIndex: expanded });
    saving = uiStateStore.saveLayoutState();
  }
  await Promise.all([cleanup, saving]);
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
    <MenuBar
      can-save
      can-close
      @close-game-requested="_run(() => _closeTab(game!.metadata.id))"
      @home-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/home')))"
      @quick-new-game-requested="_quickNewGame"
      @custom-new-game-requested="_run(_openCustomGame)"
      @load-game-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/saved-games/load')))"
      @save-game-requested="_run(() => _handleMenuInterruptionRequested(() => router.push(`/saved-games/save/${game!.metadata.id}`)))"
      @settings-requested="_run(() => _handleMenuInterruptionRequested(() => router.push('/settings/session')))" />
    <div class="game-content">
      <GameTabs v-if="tabs.length > 1" :tabs="tabs" :active-id="game.metadata.id" @tab-selected="_selectTab" @tab-closed="_closeTab" />
      <div class="game-stage">
        <section class="board-column" :class="{ 'board-column--editing': controlMode === 'boardEdit' }">
          <PlayerPanel :colour="topColour" :player="topPlayer" :selection-disabled="controlMode === 'boardEdit' || isPlayingLine" :remaining-ms="remainingTime[topColour]" :active="actualTurnColour === topColour" :captured-pieces="capturedByColour[topColour]" @player-selection-requested="_requestPlayerSelection" />
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
          <PlayerPanel :colour="bottomColour" :player="bottomPlayer" :selection-disabled="controlMode === 'boardEdit' || isPlayingLine" :remaining-ms="remainingTime[bottomColour]" :active="actualTurnColour === bottomColour" :captured-pieces="capturedByColour[bottomColour]" @player-selection-requested="_requestPlayerSelection" />
        </section>
        <aside class="game-sidebar surface">
          <div class="game-sidebar__title"><div><p>{{ game.livePath ? 'Game workspace' : 'Analysis study' }}</p><h1 :title="game.metadata.name">{{ game.metadata.name }}</h1></div><span class="result-badge" :class="{ 'result-badge--finished': game.resultState !== ResultState.Ongoing }">{{ game.resultState === ResultState.Ongoing ? (livePosition?.sideToMove ?? position.sideToMove) + ' to move' : game.resultState.replace('Won', ' won') }}</span></div>
          <HistoryPanel v-if="layout?.showHistoryPanel" :root="game.moveTree.root" :rendered-path="game.renderedPath" :live-path="game.livePath" :collapsed="layout.historyCollapsed" :disabled="isHistoryInputDisabled" @collapse-toggled="_toggleSection('history')" @node-selected="_navigateToNode" @return-to-live-requested="_returnToLivePosition" />
          <AnalysisPanel v-if="layout?.showAnalysisPanel"
            :seats="analysisSeats"
            :collapsed="layout.analysisCollapsed"
            :expanded-by-index="layout.analysisEngineExpandedByIndex"
            :show-moves="showAnalysisMoves"
            :disabled="isBoardInputDisabled || controlMode === 'boardEdit'"
            :start-disabled="controlMode === 'boardEdit'"
            :can-add="canAddEngine"
            @collapse-toggled="_toggleSection('analysis')"
            @engine-expanded-toggled="_toggleAnalysisEngine"
            @refresh-requested="_run(() => gamesStore.refreshAnalysis(game!))"
            @retry-requested="(index) => _run(() => gamesStore.retryAnalysis(game!, index))"
            @stop-requested="(index) => _run(() => gamesStore.stopAnalysis(game!, index))"
            @engine-add-requested="_requestAnalysisEngine"
            @engine-remove-requested="(index) => _run(() => _removeAnalysisEngine(index))"
            @move-selected="inputActions.line"
          />
          <button v-if="controlMode === 'paused'" class="control-button" @click="isInGameAnalysis ? inputActions.exit() : inputActions.analyse()"><AppIcon name="activity" /><span><strong>{{ isInGameAnalysis ? 'Exit analysis' : 'Analyse' }}</strong><small>The game stays paused</small></span></button>
          <GameControlPanel
            class="game-sidebar__controls"
            :mode="controlMode"
            :can-take-back="canTakeBack"
            :can-pause="canPause"
            :draw-pending="!!game.drawOfferState"
            @take-back-requested="inputActions.takeBack"
            @pause-requested="_run(() => gamesStore.pauseGame(game!, PauseReason.Manual))"
            @resume-requested="_run(() => gamesStore.resumeGame(game!, PauseReason.Manual))"
            @analysis-requested="inputActions.analyse"
            @exit-analysis-requested="inputActions.exit"
            @board-edit-requested="_toggleBoardEdit"
            @start-game-requested="_requestSetupStart()"
            @resign-requested="_requestResignation()"
            @draw-requested="_handleDraw"
          />
        </aside>
      </div>
    </div>
    <div v-if="notice" class="toast"><AppIcon name="info" />{{ notice }}</div>
  </main>
</template>


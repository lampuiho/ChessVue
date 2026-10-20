<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRef } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  AppModalKind,
  BoardEditBlockedReason,
  BoardOrientation,
  DrawOfferDirection,
  GameState,
  PauseReason,
  PieceKind,
  PlayerColour,
  PlayerType,
  ResultReason,
  ResultState,
  type IBoardPosition,
  type ICapturedPieceGroup,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IGame,
  type IMove,
  type IMoveNode,
} from '@/contracts';
import { MoveApplicationService, MoveHistoryService, TimeControlService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { buildFen, isMoveLegal, toDetailedMove } from '@/utility/chess';
import { OperationOwner } from '@/utility/async/OperationOwner';
import { abortableDelay } from '@/utility/async/Abortable';
import { useGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import MenuBar from '@/components/MenuBar.vue';
import GameTabs from '@/components/GameTabs.vue';
import Chessboard from '@/components/Chessboard.vue';
import PlayerPanel from '@/components/PlayerPanel.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';
import AnalysisPanel from '@/components/AnalysisPanel.vue';
import RecordedAnalysisPanel from '@/components/RecordedAnalysisPanel.vue';
import GameControlPanel from '@/components/GameControlPanel.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ModalDialog from '@/components/common/ModalDialog.vue';

interface IRenderedBoard { game: IGame; node: IMoveNode; position: IBoardPosition; }
const route = useRoute();
const router = useRouter();
const gamesStore = useGamesStore();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const now = ref(Date.now());
const notice = ref('');
const isPlayingLine = ref(false);
const pendingContinuation = shallowRef<{ game: IGame; node: IMoveNode; moves: readonly IMove[] }>();
const playback = new OperationOwner();
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const gameId = computed(() => String(route.params.id));
const game = toRef(() => {
  void gamesStore.workspaceRevision;
  return gamesStore.getGame(gameId.value) as unknown as IGame | undefined;
});
const tabs = computed(() => {
  void gamesStore.workspaceRevision;
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
const renderedBoard = computed<IRenderedBoard | undefined>((previous) => {
  const currentGame = game.value;
  const node = renderedNode.value;
  if (!currentGame || !node) return;
  const next = MoveApplicationService.genPosition(currentGame.rootPosition, MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.renderedPath));
  // Keep input during analysis publications; game, node or board changes replace its owner.
  if (previous?.game === currentGame && previous.node === node && buildFen(previous.position) === buildFen(next)) return previous;
  return { game: currentGame, node, position: next };
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
  const reasons = currentGame.$?.pauseReasons;
  if (currentGame.gameState.includes('AnalysisFrom') && reasons?.includes(PauseReason.Analysis) && reasons.every((reason) => reason === PauseReason.Analysis)) return 'inGameAnalysis';
  if (currentGame.gameState.startsWith('paused')) return 'paused';
  if (currentGame.resultState !== ResultState.Ongoing) return 'finished';
  if (currentGame.gameState.includes('AnalysisFrom')) return 'inGameAnalysis';
  if (!currentGame.livePath) return 'freeAnalysis';
  return 'live';
});
const isBoardInputDisabled = computed(() => {
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'paused' || isPlayingLine.value) return true;
  const currentPosition = position.value;
  if (!currentPosition || controlMode.value !== 'live') return false;
  const player = currentPosition.sideToMove === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  return player?.type === PlayerType.Engine;
});
const canTakeBack = computed(() => {
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'boardEdit' || controlMode.value === 'paused' || isPlayingLine.value) return false;
  const hasMove = (currentGame.livePath ?? currentGame.renderedPath).length > 0;
  return hasMove && (!currentGame.livePath || !!currentGame.gameplayOptions.allowTakeback);
});
const canPause = computed(() => game.value?.timeControl.initialMs !== undefined && game.value.timeControl.preset !== 'untimed');
const canAddEngine = computed(() => !!game.value && game.value.analysis.seats.length < 4 && (settings.value?.analysis.engineInventory.length ?? 0) > game.value.analysis.seats.length);
const showAnalysisMoves = computed(() => !game.value?.livePath || !!game.value.gameplayOptions.showLiveAnalysisMoves);
const analysisSeats = computed(() => {
  void gamesStore.workspaceRevision;
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
  void run(async () => {
    const fallback = await activateGame(gameId.value);
    if (fallback) await router.replace(fallback);
  });
  clockTimer = setInterval(() => {
    now.value = Date.now();
    void reconcileTimeout();
  }, 250);
});
onBeforeRouteUpdate((to) => activateGame(String(to.params.id)));
onBeforeRouteLeave(() => playback.cancel());
const disposeAutosaveNotice = gamesStore.onAutosaveFailed((message) => showNotice(`Automatic save failed: ${message}`));
onBeforeUnmount(() => {
  void playback.dispose();
  disposeAutosaveNotice();
  if (clockTimer) clearInterval(clockTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
});
async function activateGame(id: string) {
  await playback.cancel();
  pendingContinuation.value = undefined;
  now.value = Date.now();
  const selected = gamesStore.getGame(id) as IGame | undefined;
  if (selected) return handleMenuInterruptionCompleted(selected);
  const fallbackId = uiStateStore.gameSession?.openGameIds.find((id) => gamesStore.getGame(id));
  return fallbackId ? `/game/${fallbackId}` : '/home';
}
async function reconcileTimeout() {
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
  uiStateStore.showModal({ kind: AppModalKind.Timeout, payload: { gameId: currentGame.metadata.id, resultState: currentGame.resultState as Exclude<ResultState, ResultState.Ongoing>, resultReason: ResultReason.Timeout } });
}
async function quickNewGame() {
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
  await run(async () => {
    const createdGame = await gamesStore.createGame(request);
    uiStateStore.openTab(createdGame.metadata.id);
    await router.push(`/game/${createdGame.metadata.id}`);
  });
}
async function handleMenuInterruptionRequested(action: () => Promise<unknown> | unknown) {
  const currentGame = game.value;
  if (!currentGame) return;
  if (settings.value?.gameSession.autoPauseOnMenu) await gamesStore.pauseGame(currentGame, PauseReason.Menu);
  await action();
}
async function handleMenuInterruptionCompleted(currentGame = game.value) {
  if (!currentGame?.$?.pauseReasons?.includes(PauseReason.Menu)) return;
  await gamesStore.resumeGame(currentGame, PauseReason.Menu);
}
function openCustomGame() {
  const interrupted = game.value;
  return handleMenuInterruptionRequested(() => uiStateStore.showModal({ kind: AppModalKind.NewGame }, () => {
    if (game.value === interrupted) return handleMenuInterruptionCompleted(interrupted);
  }));
}
async function selectTab(id: string) {
  uiStateStore.setActiveGame(id);
  await router.push(`/game/${id}`);
}
async function closeTab(id: string) {
  uiStateStore.closeTab(id);
  const activeId = uiStateStore.gameSession?.activeGameId;
  await router.push(activeId ? `/game/${activeId}` : '/home');
}
async function makeMove(move: IMove) {
  await requestMoves([move]);
}
async function navigateToNode(node: IMoveNode) {
  if (!game.value) return;
  await run(async () => gamesStore.navigateToNode(game.value!, node));
}
async function returnToLivePosition() {
  const currentGame = game.value;
  if (!currentGame?.livePath) return;
  let node = currentGame.moveTree.root;
  for (const index of currentGame.livePath) node = node.children[index]!;
  await navigateToNode(node);
}
async function playAnalysisLine(moves: readonly IMove[]) {
  const currentGame = game.value;
  if (!currentGame || isPlayingLine.value) return;
  const explore = !currentGame.livePath || currentGame.resultState !== ResultState.Ongoing || currentGame.$?.pauseReasons?.includes(PauseReason.Analysis);
  await requestMoves(explore ? moves : moves.slice(0, 1));
}
async function requestMoves(moves: readonly IMove[]) {
  const currentGame = game.value;
  if (!currentGame || !moves.length || isPlayingLine.value) return;
  const livePath = currentGame.livePath;
  const historical = livePath && currentGame.renderedPath.length < livePath.length && currentGame.renderedPath.every((part, index) => part === livePath[index]);
  if (historical && currentGame.resultState === ResultState.Ongoing && currentGame.gameplayOptions.allowTakeback && !currentGame.gameState.startsWith('paused')) {
    pendingContinuation.value = { game: currentGame, node: renderedNode.value!, moves };
    return;
  }
  await run(() => applyMoves(currentGame, moves));
}
async function confirmContinuation() {
  const pending = pendingContinuation.value;
  pendingContinuation.value = undefined;
  if (!pending || game.value !== pending.game || renderedNode.value !== pending.node) return;
  await run(() => applyMoves(pending.game, pending.moves));
}
async function applyMoves(currentGame: IGame, moves: readonly IMove[]) {
  const validated: IMove[] = [];
  const preview = MoveApplicationService.genPosition(position.value!, []);
  for (const move of moves) {
    if (!isMoveLegal(preview, move)) throw new Error('This suggested move is stale. Refresh analysis and try again.');
    const detailed = toDetailedMove(preview, move);
    validated.push(detailed);
    MoveApplicationService.applyMove(preview, detailed);
  }
  await playback.run(async (signal) => {
    isPlayingLine.value = validated.length > 1;
    let expectedPath = [...currentGame.renderedPath];
    try {
      for (const [index, move] of validated.entries()) {
        if (index > 0) await abortableDelay(350, signal);
        signal.throwIfAborted();
        if (game.value !== currentGame || JSON.stringify(expectedPath) !== JSON.stringify(currentGame.renderedPath)) return;
        await gamesStore.makeMove(currentGame, move);
        expectedPath = [...currentGame.renderedPath];
      }
    } finally {
      isPlayingLine.value = false;
    }
  });
}
async function toggleBoardEdit() {
  const currentGame = game.value;
  if (!currentGame) return;
  if (controlMode.value === 'inGameAnalysis') {
    uiStateStore.showModal({ kind: AppModalKind.BoardEditBlocked, payload: { gameId: currentGame.metadata.id, reason: BoardEditBlockedReason.InGameAnalysis } });
    return;
  }
  await run(async () => gamesStore.enterBoardEdit(currentGame));
}
async function handleDraw() {
  const currentGame = game.value;
  if (!currentGame || !position.value) return;
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Incoming) return run(() => gamesStore.acceptDrawOffer(currentGame));
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Outgoing) return run(() => gamesStore.withdrawDrawOffer(currentGame));
  const isLocalGame = currentGame.whitePlayer?.type === PlayerType.Local && currentGame.blackPlayer?.type === PlayerType.Local;
  if (isLocalGame) uiStateStore.showModal({ kind: AppModalKind.DrawOffer, payload: { gameId: currentGame.metadata.id, offeringColour: position.value.sideToMove } });
  else await run(() => gamesStore.offerDraw(currentGame));
}
function requestPlayerSelection(colour: PlayerColour) {
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'boardEdit') return;
  const player = colour === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  uiStateStore.showModal({ kind: AppModalKind.PlayerSelection, payload: { gameId: currentGame.metadata.id, colour, currentPlayerType: player?.type, currentAssignedEngine: player?.type === PlayerType.Engine ? (player as IEnginePlayer).assignedEngine : undefined } });
}
function requestAnalysisEngine() {
  const currentGame = game.value;
  if (!currentGame) return;
  uiStateStore.showModal({ kind: AppModalKind.AnalysisEngineSelection, payload: { gameId: currentGame.metadata.id, currentAnalysisEngines: currentGame.analysis.seats.map((seat) => seat.assignedEngine) } });
}
function toggleSection(section: 'history' | 'analysis') {
  uiStateStore.setSectionCollapsed(section);
  void run(() => uiStateStore.saveLayoutState());
}
function toggleAnalysisEngine(index: number) {
  uiStateStore.setAnalysisEngineExpanded(index);
  void run(() => uiStateStore.saveLayoutState());
}
async function removeAnalysisEngine(index: number) {
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
function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.value = '', 3600);
}
async function run(action: () => Promise<void> | void) {
  try {
    await action();
  } catch (error) {
    showNotice(error instanceof Error ? error.message : 'The action could not be completed.');
  }
}
</script>

<template>
  <main v-if="game && position" class="game-page app-page">
    <MenuBar
      can-save
      can-close
      @close-game-requested="run(() => closeTab(game!.metadata.id))"
      @home-requested="run(() => handleMenuInterruptionRequested(() => router.push('/home')))"
      @quick-new-game-requested="quickNewGame"
      @custom-new-game-requested="run(openCustomGame)"
      @load-game-requested="run(() => handleMenuInterruptionRequested(() => router.push('/saved-games/load')))"
      @save-game-requested="run(() => handleMenuInterruptionRequested(() => router.push(`/saved-games/save/${game!.metadata.id}`)))"
      @settings-requested="run(() => handleMenuInterruptionRequested(() => router.push('/settings/session')))" />
    <div class="game-content">
      <GameTabs v-if="tabs.length > 1" :tabs="tabs" :active-id="game.metadata.id" @tab-selected="selectTab" @tab-closed="closeTab" />
      <div class="game-stage">
        <section class="board-column" :class="{ 'board-column--editing': controlMode === 'boardEdit' }">
          <PlayerPanel :colour="topColour" :player="topPlayer" :selection-disabled="controlMode === 'boardEdit' || isPlayingLine" :remaining-ms="remainingTime[topColour]" :active="position.sideToMove === topColour && controlMode === 'live'" :captured-pieces="capturedByColour[topColour]" @player-selection-requested="requestPlayerSelection" />
          <Chessboard
            :position="position"
            :orientation="settings?.appearance.boardOrientation"
            :show-coordinates="settings?.appearance.showCoordinates"
            :highlight-last-move="settings?.appearance.highlightLastMove"
            :last-move="lastMove"
            :input-disabled="isBoardInputDisabled"
            :board-edit="controlMode === 'boardEdit'"
            @move-attempted="makeMove"
            @chess-piece-toggled="(boardId, piece) => gamesStore.toggleChessPiece(game!, boardId, piece)"
            @chess-piece-deleted="(boardId) => gamesStore.deleteChessPiece(game!, boardId)"
            @chess-piece-moved="(from, to) => gamesStore.moveChessPiece(game!, from, to)"
            @board-cleared="gamesStore.clearBoard(game!)"
            @board-reset="gamesStore.resetBoardToStartPosition(game!)"
          />
          <PlayerPanel :colour="bottomColour" :player="bottomPlayer" :selection-disabled="controlMode === 'boardEdit' || isPlayingLine" :remaining-ms="remainingTime[bottomColour]" :active="position.sideToMove === bottomColour && controlMode === 'live'" :captured-pieces="capturedByColour[bottomColour]" @player-selection-requested="requestPlayerSelection" />
        </section>
        <aside class="game-sidebar surface">
          <div class="game-sidebar__title"><div><p>{{ game.livePath ? 'Game workspace' : 'Analysis study' }}</p><h1 :title="game.metadata.name">{{ game.metadata.name }}</h1></div><span class="result-badge" :class="{ 'result-badge--finished': game.resultState !== ResultState.Ongoing }">{{ game.resultState === ResultState.Ongoing ? position.sideToMove + ' to move' : game.resultState.replace('Won', ' won') }}</span></div>
          <HistoryPanel v-if="layout?.showHistoryPanel" :root="game.moveTree.root" :revision="gamesStore.workspaceRevision" :rendered-path="game.renderedPath" :live-path="game.livePath" :collapsed="layout.historyCollapsed" :disabled="controlMode === 'paused' || controlMode === 'boardEdit' || isPlayingLine" @collapse-toggled="toggleSection('history')" @node-selected="navigateToNode" @return-to-live-requested="returnToLivePosition" />
          <AnalysisPanel
            v-if="layout?.showAnalysisPanel"
            :seats="analysisSeats"
            :collapsed="layout.analysisCollapsed"
            :expanded-by-index="layout.analysisEngineExpandedByIndex"
            :show-moves="showAnalysisMoves"
            :disabled="controlMode === 'paused' || controlMode === 'boardEdit' || isPlayingLine"
            :start-disabled="controlMode === 'boardEdit'"
            :can-add="canAddEngine"
            @collapse-toggled="toggleSection('analysis')"
            @engine-expanded-toggled="toggleAnalysisEngine"
            @refresh-requested="run(() => gamesStore.refreshAnalysis(game!))"
            @retry-requested="(index) => run(() => gamesStore.retryAnalysis(game!, index))"
            @stop-requested="(index) => run(() => gamesStore.stopAnalysis(game!, index))"
            @engine-add-requested="requestAnalysisEngine"
            @engine-remove-requested="(index) => run(() => removeAnalysisEngine(index))"
            @move-selected="playAnalysisLine"
          />
          <RecordedAnalysisPanel v-if="renderedNode?.recordedAnalysis" :record="renderedNode.recordedAnalysis" />
          <GameControlPanel
            class="game-sidebar__controls"
            :mode="controlMode"
            :can-take-back="canTakeBack"
            :can-pause="canPause"
            :draw-pending="!!game.drawOfferState"
            @take-back-requested="run(() => gamesStore.takeBack(game!))"
            @pause-requested="run(() => gamesStore.pauseGame(game!, PauseReason.Manual))"
            @resume-requested="run(() => gamesStore.resumeGame(game!, PauseReason.Manual))"
            @analysis-requested="run(() => gamesStore.enterInGameAnalysis(game!))"
            @exit-analysis-requested="gamesStore.exitInGameAnalysis(game!)"
            @board-edit-requested="toggleBoardEdit"
            @start-game-requested="uiStateStore.showModal({ kind: AppModalKind.StartGameFromSetup, payload: { gameId: game.metadata.id } })"
            @resign-requested="uiStateStore.showModal({ kind: AppModalKind.Resign, payload: { gameId: game.metadata.id, colour: position.sideToMove } })"
            @draw-requested="handleDraw"
          />
        </aside>
      </div>
    </div>
    <div v-if="notice" class="toast"><AppIcon name="info" />{{ notice }}</div>
    <ModalDialog v-if="pendingContinuation" title="Continue from this position?" subtitle="This changes the played line. The previous continuation will remain as a variation." @dismissed="pendingContinuation = undefined">
      <template #actions><button class="text-button" @click="pendingContinuation = undefined">Cancel</button><button class="text-button text-button--primary" @click="confirmContinuation">Continue game</button></template>
    </ModalDialog>
  </main>
</template>

<style scoped>
.game-page { background: var(--surface-app); }
.game-content { display: flex; min-width: 0; min-height: 0; padding: 0.75rem; flex: 1; flex-direction: column; gap: 0.5rem; }
.game-stage { display: flex; min-width: 0; min-height: 0; flex: 1; gap: 1rem; }
.board-column { --board-room: 5.5rem; --board-size: min(100cqw, calc(100cqh - var(--board-room)), 56rem); display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; container-type: size; }
.board-column--editing { --board-room: 9.5rem; }
.board-column > :deep(.player-panel), .board-column > :deep(.board-area) { width: var(--board-size); flex: 0 0 auto; }
.game-sidebar { display: flex; min-width: 0; min-height: 0; flex: 0 0 clamp(15rem, 27vw, 21rem); flex-direction: column; gap: 0.25rem; }
.game-sidebar__title { display: flex; min-height: 2.75rem; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 0.5rem; }
.game-sidebar__title p { margin: 0; color: var(--text-muted); font-size: 0.52rem; text-transform: uppercase; }
.game-sidebar__title > div { min-width: 0; }
.game-sidebar__title h1 { margin: 0; overflow: hidden; font-family: var(--font-display); font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
.result-badge { flex-shrink: 0; color: var(--text-muted); font-size: 0.6rem; text-transform: capitalize; }
.result-badge--finished { color: var(--accent-strong); }
.game-sidebar__controls { margin-top: auto; flex-shrink: 0; }
@media (max-width: 760px) {
  .game-content { padding: 0.5rem; gap: 0.25rem; }
  .game-stage { flex-direction: column; gap: 0.5rem; }
  .board-column { flex: 0 1 60%; }
  .game-sidebar { flex: 1; }
  .game-sidebar__title { min-height: 1.75rem; }
  .game-sidebar__title p { display: none; }
  .game-sidebar :deep(.control-panel__heading) { display: none; }
  .game-sidebar :deep(.control-button small) { display: none; }
  .game-sidebar :deep(.control-grid) { grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); }
}
</style>

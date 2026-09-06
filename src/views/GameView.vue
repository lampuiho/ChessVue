<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  type ICapturedPieceGroup,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IGame,
  type IMove,
  type IMoveNode,
} from '@/contracts';
import { MoveApplicationService, MoveHistoryService, TimeControlService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { useGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import MenuBar from '@/components/MenuBar.vue';
import GameTabs from '@/components/GameTabs.vue';
import Chessboard from '@/components/Chessboard.vue';
import PlayerPanel from '@/components/PlayerPanel.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';
import AnalysisPanel from '@/components/AnalysisPanel.vue';
import GameControlPanel from '@/components/GameControlPanel.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const gamesStore = useGamesStore();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const now = ref(Date.now());
const notice = ref('');
const timeoutShown = ref(false);
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
const position = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return;
  return MoveApplicationService.genPosition(currentGame.rootPosition, MoveHistoryService.getMoveSequence(currentGame.moveTree, currentGame.renderedPath));
});
const renderedNode = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return;
  let node = currentGame.moveTree.root;
  for (const childIndex of currentGame.renderedPath) node = node.children[childIndex]!;
  return node;
});
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
  const currentGame = game.value;
  if (!currentGame || controlMode.value === 'paused') return true;
  const currentPosition = position.value;
  if (!currentPosition || controlMode.value !== 'live') return false;
  const player = currentPosition.sideToMove === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  return player?.type === PlayerType.Engine;
});
const canTakeBack = computed(() => {
  const currentGame = game.value;
  if (!currentGame) return false;
  const hasMove = (currentGame.livePath ?? currentGame.renderedPath).length > 0;
  return hasMove && (!currentGame.livePath || !!currentGame.gameplayOptions.allowTakeback || controlMode.value === 'inGameAnalysis');
});
const canPause = computed(() => game.value?.timeControl.initialMs !== undefined && game.value.timeControl.preset !== 'untimed');
const canAddEngine = computed(() => !!game.value && game.value.analysis.snapshots.length < 4 && (settings.value?.analysis.engineInventory.length ?? 0) > game.value.analysis.snapshots.length);
const showAnalysisMoves = computed(() => !game.value?.livePath || !!game.value.gameplayOptions.showLiveAnalysisMoves);
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
  if (!game.value) void router.replace('/home');
  else void run(handleMenuInterruptionCompleted);
  clockTimer = setInterval(() => {
    now.value = Date.now();
    void reconcileTimeout();
  }, 250);
});
watch(gameId, () => void run(handleMenuInterruptionCompleted));
watch(() => uiStateStore.modalState?.kind, (nextKind, previousKind) => {
  if (previousKind === AppModalKind.NewGame && nextKind !== AppModalKind.NewGame) void run(handleMenuInterruptionCompleted);
});
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
});
async function reconcileTimeout(): Promise<void> {
  const currentGame = game.value;
  if (!currentGame || timeoutShown.value || currentGame.resultState !== ResultState.Ongoing) return;
  if ((remainingTime.value.white ?? 1) > 0 && (remainingTime.value.black ?? 1) > 0) return;
  await gamesStore.syncClock(currentGame, new ClockTimestamp());
  if (currentGame.resultReason !== ResultReason.Timeout) return;
  timeoutShown.value = true;
  uiStateStore.showModal({ kind: AppModalKind.Timeout, payload: { gameId: currentGame.metadata.id, resultState: currentGame.resultState as Exclude<ResultState, ResultState.Ongoing>, resultReason: ResultReason.Timeout } });
}
async function quickNewGame(): Promise<void> {
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
async function handleMenuInterruptionRequested(action: () => Promise<unknown> | unknown): Promise<void> {
  const currentGame = game.value;
  if (!currentGame) return;
  if (settings.value?.gameSession.autoPauseOnMenu) await gamesStore.pauseGame(currentGame, PauseReason.Menu);
  await action();
}
async function handleMenuInterruptionCompleted(): Promise<void> {
  const currentGame = game.value;
  if (!currentGame?.$?.pauseReasons?.includes(PauseReason.Menu)) return;
  await gamesStore.resumeGame(currentGame, PauseReason.Menu);
}
async function selectTab(id: string): Promise<void> {
  uiStateStore.setActiveGame(id);
  await router.push(`/game/${id}`);
}
async function closeTab(id: string): Promise<void> {
  uiStateStore.closeTab(id);
  const activeId = uiStateStore.gameSession?.activeGameId;
  await router.push(activeId ? `/game/${activeId}` : '/home');
}
async function makeMove(move: IMove): Promise<void> {
  if (!game.value) return;
  await run(() => gamesStore.makeMove(game.value!, move));
}
async function navigateToNode(node: IMoveNode): Promise<void> {
  if (!game.value) return;
  await run(async () => gamesStore.navigateToNode(game.value!, node));
}
async function playAnalysisLine(moves: readonly IMove[]): Promise<void> {
  if (!game.value) return;
  await run(async () => {
    for (const move of moves) await gamesStore.makeMove(game.value!, move);
  });
}
async function toggleBoardEdit(): Promise<void> {
  const currentGame = game.value;
  if (!currentGame) return;
  if (controlMode.value === 'inGameAnalysis') {
    uiStateStore.showModal({ kind: AppModalKind.BoardEditBlocked, payload: { gameId: currentGame.metadata.id, reason: BoardEditBlockedReason.InGameAnalysis } });
    return;
  }
  await run(async () => gamesStore.enterBoardEdit(currentGame));
}
async function handleDraw(): Promise<void> {
  const currentGame = game.value;
  if (!currentGame || !position.value) return;
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Incoming) return run(() => gamesStore.acceptDrawOffer(currentGame));
  if (currentGame.drawOfferState?.direction === DrawOfferDirection.Outgoing) return run(() => gamesStore.withdrawDrawOffer(currentGame));
  const isLocalGame = currentGame.whitePlayer?.type === PlayerType.Local && currentGame.blackPlayer?.type === PlayerType.Local;
  if (isLocalGame) uiStateStore.showModal({ kind: AppModalKind.DrawOffer, payload: { gameId: currentGame.metadata.id, offeringColour: position.value.sideToMove } });
  else await run(() => gamesStore.offerDraw(currentGame));
}
function requestPlayerSelection(colour: PlayerColour): void {
  const currentGame = game.value;
  if (!currentGame) return;
  const player = colour === PlayerColour.White ? currentGame.whitePlayer : currentGame.blackPlayer;
  uiStateStore.showModal({ kind: AppModalKind.PlayerSelection, payload: { gameId: currentGame.metadata.id, colour, currentPlayerType: player?.type, currentAssignedEngine: player?.type === PlayerType.Engine ? (player as IEnginePlayer).assignedEngine : undefined } });
}
function requestAnalysisEngine(): void {
  const currentGame = game.value;
  if (!currentGame) return;
  uiStateStore.showModal({ kind: AppModalKind.AnalysisEngineSelection, payload: { gameId: currentGame.metadata.id, currentAnalysisEngines: currentGame.analysis.snapshots.map((snapshot) => snapshot.assignedEngine) } });
}
function toggleSection(section: 'history' | 'analysis'): void {
  uiStateStore.setSectionCollapsed(section);
  void run(() => uiStateStore.saveLayoutState());
}
function toggleAnalysisEngine(index: number): void {
  uiStateStore.setAnalysisEngineExpanded(index);
  void run(() => uiStateStore.saveLayoutState());
}
function showNotice(message: string): void {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.value = '', 3600);
}
async function run(action: () => Promise<void> | void): Promise<void> {
  try {
    await action();
  } catch (error) {
    showNotice(error instanceof Error ? error.message : 'The action could not be completed.');
  }
}
</script>

<template>
  <main v-if="game && position" class="game-page">
    <MenuBar can-save @home-requested="run(() => handleMenuInterruptionRequested(() => router.push('/home')))" @quick-new-game-requested="quickNewGame" @custom-new-game-requested="run(() => handleMenuInterruptionRequested(() => uiStateStore.showModal({ kind: AppModalKind.NewGame })))" @load-game-requested="run(() => handleMenuInterruptionRequested(() => router.push('/saved-games/load')))" @save-game-requested="run(() => handleMenuInterruptionRequested(() => router.push(`/saved-games/save/${game!.metadata.id}`)))" @settings-requested="run(() => handleMenuInterruptionRequested(() => router.push('/settings/session')))" />
    <GameTabs :tabs="tabs" :active-id="game.metadata.id" @tab-selected="selectTab" @tab-closed="closeTab" />
    <div class="game-stage">
      <section class="board-column">
        <PlayerPanel :colour="topColour" :player="topPlayer" :remaining-ms="remainingTime[topColour]" :active="position.sideToMove === topColour && controlMode === 'live'" :captured-pieces="capturedByColour[topColour]" @player-selection-requested="requestPlayerSelection" />
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
        <PlayerPanel :colour="bottomColour" :player="bottomPlayer" :remaining-ms="remainingTime[bottomColour]" :active="position.sideToMove === bottomColour && controlMode === 'live'" :captured-pieces="capturedByColour[bottomColour]" @player-selection-requested="requestPlayerSelection" />
      </section>
      <aside class="game-sidebar surface">
        <div class="game-sidebar__title"><div><p>{{ game.livePath ? 'Game workspace' : 'Analysis study' }}</p><h1>{{ game.metadata.name }}</h1></div><span class="result-badge" :class="{ 'result-badge--finished': game.resultState !== ResultState.Ongoing }">{{ game.resultState === ResultState.Ongoing ? position.sideToMove + ' to move' : game.resultState.replace('Won', ' won') }}</span></div>
        <HistoryPanel v-if="layout?.showHistoryPanel" :root="game.moveTree.root" :rendered-path="game.renderedPath" :live-path="game.livePath" :collapsed="layout.historyCollapsed" :disabled="controlMode === 'paused'" @collapse-toggled="toggleSection('history')" @node-selected="navigateToNode" @return-to-live-requested="game.$?.liveNode && navigateToNode(game.$.liveNode)" />
        <AnalysisPanel
          v-if="layout?.showAnalysisPanel"
          :snapshots="game.analysis.snapshots"
          :collapsed="layout.analysisCollapsed"
          :expanded-by-index="layout.analysisEngineExpandedByIndex"
          :show-moves="showAnalysisMoves"
          :disabled="controlMode === 'paused' || controlMode === 'boardEdit'"
          :can-add="canAddEngine"
          @collapse-toggled="toggleSection('analysis')"
          @engine-expanded-toggled="toggleAnalysisEngine"
          @refresh-requested="run(() => gamesStore.refreshAnalysis(game!))"
          @retry-requested="(index) => run(() => gamesStore.retryAnalysis(game!, index))"
          @stop-requested="(index) => run(() => gamesStore.stopAnalysis(game!, index))"
          @engine-add-requested="requestAnalysisEngine"
          @engine-remove-requested="(index) => run(() => gamesStore.removeAnalysisEngine(game!, index))"
          @move-selected="playAnalysisLine"
        />
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
    <div v-if="notice" class="toast"><AppIcon name="info" />{{ notice }}</div>
  </main>
</template>

<style scoped>
.game-page { display: flex; min-height: 100vh; flex-direction: column; background: radial-gradient(circle at 8% 10%, var(--accent-ambient), transparent 28rem), var(--surface-app); }
.game-stage { display: grid; min-height: 0; padding: 0.8rem; flex: 1; grid-template-columns: minmax(30rem, 1fr) minmax(19rem, 24rem); gap: 0.8rem; overflow: hidden; }
.board-column { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.55rem; justify-items: center; }
.board-column > :deep(.player-panel), .board-column > :deep(.board-area) { width: min(100%, calc(100vh - 18rem), 49rem); }
.board-column > :deep(.board-area) { min-height: 0; }
.game-sidebar { display: flex; min-height: 0; flex-direction: column; overflow: hidden; }
.game-sidebar__title { display: flex; min-height: 4.3rem; padding: 0.75rem 0.9rem; align-items: center; justify-content: space-between; gap: 0.6rem; border-bottom: 0.0625rem solid var(--border-subtle); background: var(--surface-panel); }
.game-sidebar__title p { margin: 0; color: var(--accent); font-size: 0.52rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.game-sidebar__title h1 { max-width: 13rem; margin: 0.08rem 0 0; overflow: hidden; font-family: var(--font-display); font-size: 1.08rem; font-weight: 700; letter-spacing: -0.02em; text-overflow: ellipsis; white-space: nowrap; }
.result-badge { flex: 0 0 auto; padding: 0.25rem 0.48rem; color: var(--text-muted); border: 0.0625rem solid var(--border-subtle); border-radius: 999rem; background: var(--surface-app); font-size: 0.56rem; font-weight: 700; text-transform: capitalize; }
.result-badge--finished { color: var(--accent-strong); border-color: var(--accent); background: var(--accent-soft); }
.game-sidebar__controls { margin-top: auto; border-top: 0.0625rem solid var(--border-subtle); }
@media (max-width: 57.5rem) { .game-stage { grid-template-columns: minmax(0, 1fr); overflow: visible; } .game-sidebar { min-height: 36rem; } .board-column > :deep(.player-panel), .board-column > :deep(.board-area) { width: min(100%, 42rem); } }
</style>

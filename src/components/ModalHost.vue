<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  AppModalKind,
  EngineClientType,
  EngineProtocol,
  PieceKind,
  PlayerColour,
  PlayerType,
  TimeControlPreset,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IGame,
  type IPlayer,
} from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import { toDetailedMove } from '@/utility/chess';
import { useEnginesStore, useGamesStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import NewGameModal from './NewGameModal.vue';
import ModalDialog from './common/ModalDialog.vue';

const router = useRouter();
const uiStateStore = useUiStateStore();
const settingsStore = useSettingsStore();
const gamesStore = useGamesStore();
const enginesStore = useEnginesStore();
const savedGamesStore = useSavedGamesStore();
const errorMessage = ref('');
const selectedPlayer = ref('local');
const selectedEngineId = ref('');
const setupWhite = ref('local');
const setupBlack = ref('local');
const modal = computed(() => uiStateStore.modalState);
const engines = computed(() => enginesStore.listConfiguredEngines());
const availableAnalysisEngines = computed(() => {
  const current = modal.value;
  if (current?.kind !== AppModalKind.AnalysisEngineSelection) return [];
  return engines.value.filter((candidate) => !current.payload.currentAnalysisEngines.some((assigned) => assigned.displayName === candidate.displayName));
});

watch(modal, (nextModal) => {
  errorMessage.value = '';
  selectedEngineId.value = '';
  if (nextModal?.kind === AppModalKind.PlayerSelection) {
    selectedPlayer.value = nextModal.payload.currentPlayerType === PlayerType.Engine
      ? `engine:${engines.value.find((engine) => engine.displayName === nextModal.payload.currentAssignedEngine?.displayName)?.id ?? ''}`
      : nextModal.payload.currentPlayerType === PlayerType.Local ? 'local' : 'none';
  }
}, { immediate: true });

function mutableGame(gameId: string): IGame | undefined {
  return gamesStore.getGame(gameId) as unknown as IGame | undefined;
}
function assignedPlayer(selection: string, colour: PlayerColour): IPlayer | undefined {
  if (selection === 'none') return;
  if (selection === 'local') return { colour, type: PlayerType.Local, displayName: colour === PlayerColour.White ? 'White' : 'Black' };
  const engine = engines.value.find((candidate) => candidate.id === selection.slice('engine:'.length));
  if (!engine) return;
  const enginePlayer: IEnginePlayer = {
    colour,
    type: PlayerType.Engine,
    displayName: engine.displayName,
    assignedEngine: { displayName: engine.displayName, executablePath: engine.executablePath, clientType: engine.clientType ?? EngineClientType.Uci, protocol: engine.protocol ?? EngineProtocol.Uci, options: { ...engine.options } },
  };
  return enginePlayer;
}
async function createGame(request: ICreateGameRequest): Promise<void> {
  await run(async () => {
    const game = await gamesStore.createGame(request);
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
    uiStateStore.hideModal();
  });
}
async function confirmPlayerSelection(): Promise<void> {
  const current = modal.value;
  if (current?.kind !== AppModalKind.PlayerSelection) return;
  const game = mutableGame(current.payload.gameId);
  if (!game) return;
  await run(async () => {
    await gamesStore.reassignPlayer(game, current.payload.colour, assignedPlayer(selectedPlayer.value, current.payload.colour));
    uiStateStore.hideModal();
  });
}
async function confirmAnalysisEngine(): Promise<void> {
  const current = modal.value;
  if (current?.kind !== AppModalKind.AnalysisEngineSelection) return;
  const game = mutableGame(current.payload.gameId);
  const engine = engines.value.find((candidate) => candidate.id === selectedEngineId.value);
  if (!game || !engine) return;
  await run(async () => {
    await gamesStore.addAnalysisEngine(game, engine);
    if (game.gameState !== 'boardEdit') await gamesStore.refreshAnalysis(game);
    uiStateStore.hideModal();
  });
}
async function confirmSetupStart(): Promise<void> {
  const current = modal.value;
  if (current?.kind !== AppModalKind.StartGameFromSetup) return;
  const game = mutableGame(current.payload.gameId);
  const defaults = settingsStore.settings?.gameDefaults;
  if (!game || !defaults) return;
  await run(async () => {
    await gamesStore.startGameFromSetup(game, {
      whitePlayer: assignedPlayer(setupWhite.value, PlayerColour.White),
      blackPlayer: assignedPlayer(setupBlack.value, PlayerColour.Black),
      analysisEngineProfiles: engines.value.filter((engine) => game.analysis.snapshots.some((snapshot) => snapshot.assignedEngine.displayName === engine.displayName)),
      showLiveAnalysisMoves: false,
      allowTakeback: true,
      timeControl: { ...defaults.defaultTimeControl },
    });
    uiStateStore.hideModal();
  });
}
async function confirmSimpleAction(): Promise<void> {
  const current = modal.value;
  if (!current) return;
  await run(async () => {
    if (current.kind === AppModalKind.Resign) {
      const game = mutableGame(current.payload.gameId);
      if (game) await gamesStore.resignGame(game, current.payload.colour);
    } else if (current.kind === AppModalKind.DrawOffer) {
      const game = mutableGame(current.payload.gameId);
      if (game) {
        await gamesStore.offerDraw(game);
        uiStateStore.showModal({ kind: AppModalKind.DrawResolve, payload: { gameId: current.payload.gameId, offeringColour: current.payload.offeringColour, respondingColour: current.payload.offeringColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White } });
        return;
      }
    } else if (current.kind === AppModalKind.DrawResolve) {
      const game = mutableGame(current.payload.gameId);
      if (game) await gamesStore.acceptDrawOffer(game);
    } else if (current.kind === AppModalKind.ResetSettings) await settingsStore.resetSettings();
    else if (current.kind === AppModalKind.SettingsDirtyLeave) {
      settingsStore.discardPendingSettings();
      await router.push(current.payload.targetRoute);
    } else if (current.kind === AppModalKind.DeleteGame) await savedGamesStore.deleteSave(current.payload.gameId);
    uiStateStore.hideModal();
  });
}
async function declineDraw(): Promise<void> {
  const current = modal.value;
  if (current?.kind !== AppModalKind.DrawResolve) return;
  const game = mutableGame(current.payload.gameId);
  if (game) await gamesStore.declineDrawOffer(game);
  uiStateStore.hideModal();
}
async function choosePromotion(pieceKind: PieceKind): Promise<void> {
  const current = modal.value;
  if (current?.kind !== AppModalKind.Promotion) return;
  const game = mutableGame(current.payload.gameId);
  if (!game) return;
  const position = MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, game.renderedPath));
  const move = toDetailedMove(position, { from: current.payload.move.from, to: current.payload.move.to, promotionPiece: pieceKind });
  await run(async () => {
    await gamesStore.makeMove(game, move);
    uiStateStore.hideModal();
  });
}
async function run(action: () => Promise<void>): Promise<void> {
  errorMessage.value = '';
  try {
    await action();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The action could not be completed.';
  }
}
</script>

<template>
  <NewGameModal v-if="modal?.kind === AppModalKind.NewGame && settingsStore.draftSettings" :settings="settingsStore.draftSettings" :engines="engines" @create-requested="createGame" @cancel-requested="uiStateStore.hideModal" />
  <ModalDialog v-else-if="modal?.kind === AppModalKind.PlayerSelection" title="Choose a player" :subtitle="`Assign the ${modal.payload.colour} seat for this game.`" @dismissed="uiStateStore.hideModal">
    <div class="choice-list">
      <label class="choice-card"><input v-model="selectedPlayer" type="radio" value="none"><span class="choice-card__piece">○</span><span><strong>Unassigned</strong><small>Turn this game into a free analysis workspace.</small></span></label>
      <label class="choice-card"><input v-model="selectedPlayer" type="radio" value="local"><span class="choice-card__piece">♙</span><span><strong>Local player</strong><small>Moves are entered on this board.</small></span></label>
      <label v-for="engine in engines" :key="engine.id" class="choice-card"><input v-model="selectedPlayer" type="radio" :value="`engine:${engine.id}`"><span class="choice-card__piece">♞</span><span><strong>{{ engine.displayName }}</strong><small>Configured UCI engine.</small></span></label>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" @click="confirmPlayerSelection">Assign player</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.AnalysisEngineSelection" title="Add analysis engine" subtitle="Assign a configured engine to this board." @dismissed="uiStateStore.hideModal">
    <div v-if="engines.length" class="choice-list">
      <label v-for="engine in availableAnalysisEngines" :key="engine.id" class="choice-card"><input v-model="selectedEngineId" type="radio" :value="engine.id"><span class="choice-card__piece">♝</span><span><strong>{{ engine.displayName }}</strong><small>{{ engine.executablePath || 'Executable not selected' }}</small></span></label>
    </div>
    <p v-else class="inline-message">Add an engine profile in Settings before assigning analysis.</p>
    <p v-if="errorMessage" class="inline-message inline-message--error">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" :disabled="!selectedEngineId" @click="confirmAnalysisEngine">Add engine</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.StartGameFromSetup" title="Start from this position" subtitle="Assign both seats and begin from the board you prepared." @dismissed="uiStateStore.hideModal">
    <div class="form-section">
      <div class="field-row"><label class="field-label" for="setup-white">White</label><select id="setup-white" v-model="setupWhite" class="field-control"><option value="local">Local player</option><option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">{{ engine.displayName }}</option></select></div>
      <div class="field-row"><label class="field-label" for="setup-black">Black</label><select id="setup-black" v-model="setupBlack" class="field-control"><option value="local">Local player</option><option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">{{ engine.displayName }}</option></select></div>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" @click="confirmSetupStart">Start game</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.Promotion" title="Choose promotion" subtitle="Select the piece your pawn should become." @dismissed="uiStateStore.hideModal">
    <div class="promotion-row"><button v-for="kind in [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight]" :key="kind" @click="choosePromotion(kind)">{{ ({ queen: '♕', rook: '♖', bishop: '♗', knight: '♘' } as Record<string, string>)[kind] }}</button></div>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.Resign" title="Resign this game?" subtitle="This records the game as finished. You can still review the position afterwards." @dismissed="uiStateStore.hideModal">
    <p>Confirm that {{ modal.payload.colour }} resigns.</p><p v-if="errorMessage" class="inline-message inline-message--error">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--danger" @click="confirmSimpleAction">Resign</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.DrawOffer" title="Offer a draw?" subtitle="The other side will be asked to accept or decline." @dismissed="uiStateStore.hideModal">
    <p>Offer a draw from the {{ modal.payload.offeringColour }} side.</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" @click="confirmSimpleAction">Offer draw</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.DrawResolve" title="Draw offered" :subtitle="`${modal.payload.respondingColour} to respond.`" :dismissible="false">
    <p>Accept the draw and finish the game?</p>
    <template #actions><button class="text-button" @click="declineDraw">Decline</button><button class="text-button text-button--primary" @click="confirmSimpleAction">Accept</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.ResetSettings" title="Reset all settings?" subtitle="Preferences and engine profiles will return to their defaults." @dismissed="uiStateStore.hideModal">
    <p>This cannot be undone after you save another change.</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--danger" @click="confirmSimpleAction">Reset settings</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.SettingsDirtyLeave" title="Discard unsaved changes?" subtitle="You have settings changes that have not been applied." @dismissed="uiStateStore.hideModal">
    <template #actions><button class="text-button" @click="uiStateStore.hideModal">Keep editing</button><button class="text-button text-button--primary" @click="confirmSimpleAction">Discard changes</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.BoardEditBlocked" title="Board editing is unavailable" subtitle="Finish in-game analysis before changing the position." @dismissed="uiStateStore.hideModal">
    <p>Board editing is only available in a free analysis workspace.</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Understood</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.ImportError" title="Could not import game" subtitle="The selected document is unsupported or incomplete." @dismissed="uiStateStore.hideModal">
    <p class="inline-message inline-message--error">{{ modal.payload.message }}</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Close</button></template>
  </ModalDialog>
  <ModalDialog v-else-if="modal?.kind === AppModalKind.Timeout" title="Time has expired" subtitle="The game is finished, but the position remains available for review." @dismissed="uiStateStore.hideModal">
    <p>{{ modal.payload.resultState === 'whiteWon' ? 'White wins' : 'Black wins' }} on time.</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Review game</button></template>
  </ModalDialog>
</template>

<style scoped>
.choice-list { display: grid; gap: 0.55rem; }
.choice-card { display: grid; grid-template-columns: auto 2rem 1fr; padding: 0.75rem; align-items: center; gap: 0.7rem; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-panel); cursor: pointer; }
.choice-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.choice-card input { accent-color: var(--accent); }
.choice-card__piece { font-family: var(--font-display); font-size: 1.65rem; text-align: center; }
.choice-card strong, .choice-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.choice-card strong { font-size: 0.82rem; }
.choice-card small { color: var(--text-muted); font-size: 0.7rem; }
.inline-message { margin: 0.8rem 0 0; }
.promotion-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.65rem; }
.promotion-row button { aspect-ratio: 1; color: var(--text-primary); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-panel); font-family: var(--font-display); font-size: 3rem; }
.promotion-row button:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
p { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
</style>

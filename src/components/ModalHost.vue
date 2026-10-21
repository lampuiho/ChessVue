<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  AppModalKind,
  EngineClientType,
  EngineProtocol,
  PieceKind,
  PlayerColour,
  PlayerType,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IGame,
  type IPlayer,
} from '@/contracts';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService } from '@/domain';
import { toDetailedMove } from '@/utility/chess';
import { useEnginesStore, useGamesStore, useSavedGamesStore, useSettingsStore, useUiStateStore } from '@/state';
import NewGameModal from './NewGameModal.vue';
import ModalDialog from './common/ModalDialog.vue';
import ChessPiece from './common/ChessPiece.vue';

const router = useRouter();
const uiStateStore = useUiStateStore();
const settingsStore = useSettingsStore();
const gamesStore = useGamesStore();
const enginesStore = useEnginesStore();
const savedGamesStore = useSavedGamesStore();
const form = computed(() => uiStateStore.modalForm);
const modal = computed(() => uiStateStore.modalState);
const engines = computed(() => {
  void settingsStore.settings;
  return enginesStore.listConfiguredEngines();
});
const setupGame = computed(() => modal.value?.kind === AppModalKind.StartGameFromSetup ? _mutableGame(modal.value.payload.gameId) : undefined);
const promotionPosition = computed(() => {
  const current = modal.value;
  if (current?.kind !== AppModalKind.Promotion) return;
  const game = _mutableGame(current.payload.gameId);
  if (game) return MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, game.renderedPath));
});
const availableAnalysisEngines = computed(() => {
  const current = modal.value;
  if (current?.kind !== AppModalKind.AnalysisEngineSelection) return [];
  return engines.value.filter((candidate) => !current.payload.currentAnalysisEngines.some((assigned) => assigned.displayName === candidate.displayName));
});

function _mutableGame(gameId: string): IGame | undefined {
  return gamesStore.getGame(gameId) as unknown as IGame | undefined;
}
function _assignedPlayer(selection: string, colour: PlayerColour): IPlayer | undefined {
  if (selection === 'none') return;
  if (selection === 'local') return { colour, type: PlayerType.Local, displayName: colour === PlayerColour.White ? 'White' : 'Black' };
  const engine = engines.value.find((candidate) => candidate.id === selection.slice('engine:'.length));
  if (!engine?.executablePath.trim()) throw new Error('Choose an available engine profile.');
  const enginePlayer: IEnginePlayer = {
    colour,
    type: PlayerType.Engine,
    displayName: engine.displayName,
    assignedEngine: { displayName: engine.displayName, executablePath: engine.executablePath, clientType: engine.clientType ?? EngineClientType.Uci, protocol: engine.protocol ?? EngineProtocol.Uci, options: { ...engine.options } },
  };
  return enginePlayer;
}
async function _createGame(request: ICreateGameRequest) {
  await _run(async (signal) => {
    await _validateRequiredEngines(request);
    signal.throwIfAborted();
    const game = await gamesStore.createGame(request);
    signal.throwIfAborted();
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
    await _closeModal(signal);
  });
}
async function _validateRequiredEngines(request: ICreateGameRequest) {
  if (!request.whitePlayer || !request.blackPlayer) return;
  for (const player of [request.whitePlayer, request.blackPlayer]) {
    if (player.type !== PlayerType.Engine) continue;
    const assigned = (player as IEnginePlayer).assignedEngine;
    try {
      await EngineRuntimeService.getOptions({ ...assigned, id: player.colour });
    } catch {
      throw new Error(`${assigned.displayName} is unavailable. Choose another player engine and try again.`);
    }
  }
}
async function _confirmPlayerSelection() {
  const current = modal.value;
  if (current?.kind !== AppModalKind.PlayerSelection) return;
  const game = _mutableGame(current.payload.gameId);
  if (!game) return;
  await _run(async (signal) => {
    if (form.value.selectedPlayer !== 'unchanged') await gamesStore.reassignPlayer(game, current.payload.colour, _assignedPlayer(form.value.selectedPlayer, current.payload.colour));
    await _closeModal(signal);
  });
}
async function _confirmAnalysisEngine() {
  const current = modal.value;
  if (current?.kind !== AppModalKind.AnalysisEngineSelection) return;
  const game = _mutableGame(current.payload.gameId);
  const engine = engines.value.find((candidate) => candidate.id === form.value.selectedEngineId);
  if (!game || !engine) return;
  await _run(async (signal) => {
    const adding = gamesStore.addAnalysisEngine(game, engine);
    const seat = game.analysis.seats.find((candidate) => candidate.assignedEngine.displayName === engine.displayName);
    await adding;
    const index = seat ? game.analysis.seats.indexOf(seat) : -1;
    if (game.gameState !== 'boardEdit' && index >= 0) await gamesStore.retryAnalysis(game, index);
    await _closeModal(signal);
  });
}
async function _confirmSetupStart(request: ICreateGameRequest) {
  const current = modal.value;
  if (current?.kind !== AppModalKind.StartGameFromSetup) return;
  const game = _mutableGame(current.payload.gameId);
  if (!game) return;
  await _run(async (signal) => {
    await _validateRequiredEngines(request);
    signal.throwIfAborted();
    await gamesStore.startGameFromSetup(game, request);
    await _closeModal(signal);
  });
}
async function _confirmSimpleAction() {
  const current = modal.value;
  if (!current) return;
  await _run(async (signal) => {
    if (current.kind === AppModalKind.Resign) {
      const game = _mutableGame(current.payload.gameId);
      if (game) await gamesStore.resignGame(game, current.payload.colour);
    } else if (current.kind === AppModalKind.DrawOffer) {
      const game = _mutableGame(current.payload.gameId);
      if (game) {
        await gamesStore.offerDraw(game);
        signal.throwIfAborted();
        uiStateStore.showModal({ kind: AppModalKind.DrawResolve, payload: { gameId: current.payload.gameId, offeringColour: current.payload.offeringColour, respondingColour: current.payload.offeringColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White } });
        return;
      }
    } else if (current.kind === AppModalKind.DrawResolve) {
      const game = _mutableGame(current.payload.gameId);
      if (game) await gamesStore.acceptDrawOffer(game);
    } else if (current.kind === AppModalKind.ResetSettings) await settingsStore.resetSettings();
    else if (current.kind === AppModalKind.SettingsDirtyLeave) {
      settingsStore.discardPendingSettings();
      await router.push(current.payload.targetRoute);
    } else if (current.kind === AppModalKind.DeleteGame) await savedGamesStore.deleteSave(current.payload.gameId);
    await _closeModal(signal);
  });
}
async function _declineDraw() {
  const current = modal.value;
  if (current?.kind !== AppModalKind.DrawResolve) return;
  const game = _mutableGame(current.payload.gameId);
  await _run(async (signal) => {
    if (game) await gamesStore.declineDrawOffer(game);
    await _closeModal(signal);
  });
}
async function _choosePromotion(pieceKind: PieceKind) {
  const current = modal.value;
  if (current?.kind !== AppModalKind.Promotion) return;
  const game = _mutableGame(current.payload.gameId);
  if (!game) return;
  const position = MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, game.renderedPath));
  const move = toDetailedMove(position, { from: current.payload.move.from, to: current.payload.move.to, promotionPiece: pieceKind });
  await _run(async (signal) => {
    await gamesStore.makeMove(game, move);
    await _closeModal(signal);
  });
}
function _closeModal(signal: AbortSignal) {
  if (!signal.aborted) return uiStateStore.hideModal();
}
async function _run(action: (signal: AbortSignal) => Promise<void>) {
  const currentForm = form.value;
  const signal = uiStateStore.getModalSignal();
  if (currentForm.isWorking) return;
  currentForm.isWorking = true;
  currentForm.errorMessage = '';
  try {
    await action(signal);
  } catch (error) {
    if (!signal.aborted) currentForm.errorMessage = error instanceof Error ? error.message : 'The action could not be completed.';
  } finally {
    currentForm.isWorking = false;
  }
}
</script>

<template>
  <NewGameModal v-if="modal?.kind === AppModalKind.NewGame && settingsStore.draftSettings" :settings="settingsStore.draftSettings" :engines="engines" :error-message="form.errorMessage" :busy="form.isWorking" @create-requested="_createGame" @cancel-requested="uiStateStore.hideModal" />
  <NewGameModal v-else-if="modal?.kind === AppModalKind.StartGameFromSetup && settingsStore.draftSettings && setupGame" :settings="settingsStore.draftSettings" :engines="engines" :setup-game="setupGame" :error-message="form.errorMessage" :busy="form.isWorking" @create-requested="_confirmSetupStart" @cancel-requested="uiStateStore.hideModal" />
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.PlayerSelection" title="Choose a player" :subtitle="`Assign the ${modal.payload.colour} seat for this game.`" @dismissed="uiStateStore.hideModal">
    <div class="choice-list">
      <label v-if="modal.payload.currentPlayerType === PlayerType.Engine" class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="unchanged"><span class="choice-card__piece">♞</span><span><strong>Keep {{ modal.payload.currentAssignedEngine?.displayName }}</strong><small>Keep the engine and options assigned to this game.</small></span></label>
      <label class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="none"><span class="choice-card__piece">○</span><span><strong>Unassigned</strong><small>Turn this game into a free analysis workspace.</small></span></label>
      <label class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="local"><span class="choice-card__piece">♙</span><span><strong>Local player</strong><small>Moves are entered on this board.</small></span></label>
      <label v-for="engine in engines" :key="engine.id" class="choice-card"><input v-model="form.selectedPlayer" type="radio" :value="`engine:${engine.id}`"><span class="choice-card__piece">♞</span><span><strong>{{ engine.displayName }}</strong><small>Configured UCI engine.</small></span></label>
    </div>
    <p v-if="form.errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ form.errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" @click="_confirmPlayerSelection">Assign player</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.AnalysisEngineSelection" title="Add analysis engine" subtitle="Assign a configured engine to this board." @dismissed="uiStateStore.hideModal">
    <div v-if="engines.length" class="choice-list">
      <label v-for="engine in availableAnalysisEngines" :key="engine.id" class="choice-card"><input v-model="form.selectedEngineId" type="radio" :value="engine.id"><span class="choice-card__piece">♝</span><span><strong>{{ engine.displayName }}</strong><small>{{ engine.executablePath || 'Executable not selected' }}</small></span></label>
    </div>
    <p v-else class="inline-message">Add an engine profile in Settings before assigning analysis.</p>
    <p v-if="form.errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ form.errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" :disabled="!form.selectedEngineId" @click="_confirmAnalysisEngine">Add engine</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.Promotion" title="Choose promotion" subtitle="Select the piece your pawn should become." @dismissed="uiStateStore.hideModal">
    <div class="promotion-row"><button v-for="kind in [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight]" :key="kind" :aria-label="`Promote to ${kind}`" @click="_choosePromotion(kind)"><ChessPiece :kind="kind" :colour="promotionPosition?.sideToMove ?? PlayerColour.White" /></button></div>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.Resign" title="Resign this game?" subtitle="This records the game as finished. You can still review the position afterwards." @dismissed="uiStateStore.hideModal">
    <p class="modal-copy">Confirm that {{ modal.payload.colour }} resigns.</p><p v-if="form.errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ form.errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--danger" @click="_confirmSimpleAction">Resign</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.DrawOffer" title="Offer a draw?" subtitle="The other side will be asked to accept or decline." @dismissed="uiStateStore.hideModal">
    <p class="modal-copy">Offer a draw from the {{ modal.payload.offeringColour }} side.</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--primary" @click="_confirmSimpleAction">Offer draw</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.DrawResolve" title="Draw offered" :subtitle="`${modal.payload.respondingColour} to respond.`" :dismissible="false">
    <p class="modal-copy">Accept the draw and finish the game?</p>
    <template #actions><button class="text-button" @click="_declineDraw">Decline</button><button class="text-button text-button--primary" @click="_confirmSimpleAction">Accept</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.ResetSettings" title="Reset all settings?" subtitle="Preferences and engine profiles will return to their defaults." @dismissed="uiStateStore.hideModal">
    <p class="modal-copy">This cannot be undone after you save another change.</p>
    <template #actions><button class="text-button text-button--ghost" @click="uiStateStore.hideModal">Cancel</button><button class="text-button text-button--danger" @click="_confirmSimpleAction">Reset settings</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.SettingsDirtyLeave" title="Discard unsaved changes?" subtitle="You have settings changes that have not been applied." @dismissed="uiStateStore.hideModal">
    <template #actions><button class="text-button" @click="uiStateStore.hideModal">Keep editing</button><button class="text-button text-button--primary" @click="_confirmSimpleAction">Discard changes</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.BoardEditBlocked" title="Board editing is unavailable" subtitle="Finish in-game analysis before changing the position." @dismissed="uiStateStore.hideModal">
    <p class="modal-copy">Board editing is only available in a free analysis workspace.</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Understood</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.ImportError" title="Could not import game" subtitle="The selected document is unsupported or incomplete." @dismissed="uiStateStore.hideModal">
    <p class="inline-message inline-message--error inline-message--spaced">{{ modal.payload.message }}</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Close</button></template>
  </ModalDialog>
  <ModalDialog :key="modal?.kind" v-else-if="modal?.kind === AppModalKind.Timeout" title="Time has expired" subtitle="The game is finished, but the position remains available for review." @dismissed="uiStateStore.hideModal">
    <p class="modal-copy">{{ modal.payload.resultState === 'whiteWon' ? 'White wins' : 'Black wins' }} on time.</p>
    <template #actions><button class="text-button text-button--primary" @click="uiStateStore.hideModal">Review game</button></template>
  </ModalDialog>
</template>


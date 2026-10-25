<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { EngineRuntimeService } from '@/domain';
import { useGamesStore, useSettingsStore, useEnginesStore, useUiStateStore } from '@/state';
import { useModalAction } from '@/composables/ModalActionComposable';
import { PlayerColour, PlayerType, type ICreateGameRequest, type IEnginePlayer, type IGame } from '@/contracts';
import { copyGameRequest, createLocalPlayer, getGameCreationError } from '@/utility/GameCreationUtility';
import GamePlayerField from '@/components/GamePlayerField.vue';
import GameClockFields from '@/components/GameClockFields.vue';
import AnalysisSnapshotFields from '@/components/AnalysisSnapshotFields.vue';
import ModalDialog from './ModalDialog.vue';
const props = defineProps<{ gameId?: string; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const router = useRouter();
const gamesStore = useGamesStore();
const settingsStore = useSettingsStore();
const enginesStore = useEnginesStore();
const uiStateStore = useUiStateStore();
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const engines = computed(() => { void settingsStore.settings; return enginesStore.listConfiguredEngines(); });
const setupGame = computed(() => props.gameId ? gamesStore.getGame(props.gameId) as IGame | undefined : undefined);
const form = reactive(_initialForm());
const mode = ref(!form.whitePlayer && !form.blackPlayer ? 'analysis' : 'live');
const validationMessage = computed(() => getGameCreationError(_effectiveRequest()));
const canCreate = computed(() => !isWorking.value && !validationMessage.value);
function _initialForm() {
  const defaults = settingsStore.settings!.gameDefaults;
  const prepared = setupGame.value;
  if (!prepared) return copyGameRequest(defaults);
  return copyGameRequest({ ...defaults, name: prepared.metadata.name,
    whitePlayer: createLocalPlayer(PlayerColour.White), blackPlayer: createLocalPlayer(PlayerColour.Black),
    allowTakeback: prepared.gameplayOptions.allowTakeback ?? true, showLiveAnalysisMoves: prepared.gameplayOptions.showLiveAnalysisMoves ?? false,
    analysisEngineProfiles: prepared.analysis.seats.map(seat => ({ ...seat.assignedEngine, id: crypto.randomUUID() })),
  });
}
function _effectiveRequest(): ICreateGameRequest {
  const whitePlayer = mode.value === 'live' ? form.whitePlayer : undefined;
  const blackPlayer = mode.value === 'live' ? form.blackPlayer : undefined;
  return { ...form, whitePlayer, blackPlayer, showLiveAnalysisMoves: whitePlayer && blackPlayer ? form.showLiveAnalysisMoves : true };
}
function _dismiss() { if (!isWorking.value && !props.signal.aborted) emit('dismissed'); }
async function _submit() {
  if (!canCreate.value) return;
  const request = copyGameRequest(_effectiveRequest());
  const prepared = setupGame.value;
  if (props.gameId && !prepared) return;
  if (await run(async () => {
    await _validateRequiredEngines(request);
    props.signal.throwIfAborted();
    if (prepared) await gamesStore.startGameFromSetup(prepared, request);
    else {
      const game = await gamesStore.createGame(request);
      props.signal.throwIfAborted();
      uiStateStore.openTab(game.metadata.id);
      await router.push('/game/' + game.metadata.id);
    }
  })) emit('dismissed');
}
async function _validateRequiredEngines(request: ICreateGameRequest) {
  if (!request.whitePlayer || !request.blackPlayer) return;
  for (const player of [request.whitePlayer, request.blackPlayer]) {
    if (player.type !== PlayerType.Engine) continue;
    props.signal.throwIfAborted();
    const assigned = (player as IEnginePlayer).assignedEngine;
    try { await EngineRuntimeService.getOptions({ ...assigned, id: player.colour }); }
    catch { throw new Error(assigned.displayName + ' is unavailable. Choose another player engine and try again.'); }
  }
}
</script>
<template>
  <ModalDialog v-if="settingsStore.settings && (!gameId || setupGame)" :title="setupGame ? 'Start from this position' : 'Set up a new board'" :subtitle="setupGame ? 'Choose players, clocks and analysis for the board you prepared.' : 'Choose a quick match or open a free analysis study.'" :dismissible="!isWorking" wide @dismissed="_dismiss()">
    <form id="new-game-form" @submit.prevent="_submit">
      <section class="form-section">
        <h3 class="form-section__heading">Game</h3>
        <div class="field-row"><label class="field-label" for="game-name">Name<span class="field-help">Shown in the workspace tab</span></label><input id="game-name" v-model="form.name" class="field-control" autocomplete="off" autofocus></div>
        <div v-if="!setupGame" class="field-row"><span class="field-label">Workspace</span><div class="segmented-control"><button type="button" :class="{ active: mode === 'live' }" @click="mode = 'live'">Play a game</button><button type="button" :class="{ active: mode === 'analysis' }" @click="mode = 'analysis'">Free analysis</button></div></div>
      </section>
      <section v-if="mode === 'live'" class="form-section">
        <h3 class="form-section__heading">Players</h3>
        <label class="toggle-row"><input v-model="form.randomiseColours" :disabled="!form.whitePlayer || !form.blackPlayer" type="checkbox"><span class="toggle-track"></span><span><strong>Randomly assign colours</strong><small>Assign Player 1 and Player 2 to White or Black when the game starts.</small></span></label>
        <GamePlayerField id="white-player" v-model="form.whitePlayer" :label="form.randomiseColours ? 'Player 1' : 'White'" :colour="PlayerColour.White" :engines="engines" :required="!!setupGame" />
        <GamePlayerField id="black-player" v-model="form.blackPlayer" :label="form.randomiseColours ? 'Player 2' : 'Black'" :colour="PlayerColour.Black" :engines="engines" :required="!!setupGame" />
      </section>
      <section class="form-section">
        <h3 class="form-section__heading">Time &amp; assistance</h3>
        <GameClockFields id="time-preset" v-model="form.timeControl" label="Clock" />
        <label class="toggle-row"><input v-model="form.allowTakeback" type="checkbox"><span class="toggle-track"></span><span><strong>Allow takebacks</strong><small>Rewind the played line when needed.</small></span></label>
        <label v-if="mode === 'live'" class="toggle-row"><input v-model="form.showLiveAnalysisMoves" :disabled="!form.whitePlayer || !form.blackPlayer" type="checkbox"><span class="toggle-track"></span><span><strong>Show live analysis moves</strong><small>{{ !form.whitePlayer || !form.blackPlayer ? 'Analysis moves are available in free analysis.' : 'Engine continuations become playable suggestions.' }}</small></span></label>
        <AnalysisSnapshotFields v-model="form.analysisEngineProfiles" :engines="engines" />
      </section>
    </form>
    <p v-if="validationMessage" class="inline-message inline-message--error" role="alert">{{ validationMessage }}</p>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" :disabled="isWorking" @click="_dismiss()">Cancel</button><button class="text-button text-button--primary" :disabled="!canCreate" form="new-game-form" type="submit">{{ setupGame ? 'Start game' : 'Create workspace' }}</button></template>
  </ModalDialog>
</template>

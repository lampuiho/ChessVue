<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { PlayerType, type ICreateGameRequest, type IEnginePlayer, type IGame } from '@/contracts';
import { EngineRuntimeService } from '@/domain';
import { useGamesStore, useSettingsStore, useEnginesStore, useUiStateStore } from '@/state';
import NewGameModal from './NewGameModal.vue';
const props = defineProps<{ gameId?: string; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const router = useRouter();
const gamesStore = useGamesStore();
const settingsStore = useSettingsStore();
const enginesStore = useEnginesStore();
const uiStateStore = useUiStateStore();
const form = reactive({ isWorking: false, errorMessage: '' });
const engines = computed(() => { void settingsStore.settings; return enginesStore.listConfiguredEngines(); });
const setupGame = computed(() => props.gameId ? gamesStore.getGame(props.gameId) as unknown as IGame | undefined : undefined);
function _createGame(request: ICreateGameRequest) {
  return _run(async () => {
    await _validateRequiredEngines(request);
    props.signal.throwIfAborted();
    const game = await gamesStore.createGame(request);
    props.signal.throwIfAborted();
    uiStateStore.openTab(game.metadata.id);
    await router.push(`/game/${game.metadata.id}`);
  });
}
function _confirmSetupStart(request: ICreateGameRequest) {
  const game = setupGame.value;
  if (!game) return;
  return _run(async () => {
    await _validateRequiredEngines(request);
    props.signal.throwIfAborted();
    await gamesStore.startGameFromSetup(game, request);
  });
}
async function _validateRequiredEngines(request: ICreateGameRequest) {
  if (!request.whitePlayer || !request.blackPlayer) return;
  for (const player of [request.whitePlayer, request.blackPlayer]) {
    if (player.type !== PlayerType.Engine) continue;
    const assigned = (player as IEnginePlayer).assignedEngine;
    try { await EngineRuntimeService.getOptions({ ...assigned, id: player.colour }); } catch {
      throw new Error(`${assigned.displayName} is unavailable. Choose another player engine and try again.`);
    }
  }
}
async function _run(action: () => Promise<void>) {
  if (form.isWorking || props.signal.aborted) return;
  form.isWorking = true;
  form.errorMessage = '';
  try {
    await action();
    if (!props.signal.aborted) emit('dismissed');
  } catch (error) {
    if (!props.signal.aborted) form.errorMessage = error instanceof Error ? error.message : 'The action could not be completed.';
  } finally { form.isWorking = false; }
}
</script>
<template>
  <NewGameModal v-if="settingsStore.draftSettings && (!gameId || setupGame)" :settings="settingsStore.draftSettings" :engines="engines" :setup-game="setupGame" :error-message="form.errorMessage" :busy="form.isWorking" @create-requested="gameId ? _confirmSetupStart($event) : _createGame($event)" @cancel-requested="emit('dismissed')" />
</template>

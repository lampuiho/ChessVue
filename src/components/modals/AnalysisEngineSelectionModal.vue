<script setup lang="ts">
import { computed, reactive } from 'vue';
import { GameState, type IGame } from '@/contracts';
import { useEnginesStore, useGamesStore, useSettingsStore } from '@/state';
import { useModalAction } from '@/composables/ModalActionComposable';
import ModalDialog from './ModalDialog.vue';
const props = defineProps<{ gameId: string; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const gamesStore = useGamesStore();
const enginesStore = useEnginesStore();
const settingsStore = useSettingsStore();
const form = reactive({ selectedEngineId: '' });
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const engines = computed(() => { void settingsStore.settings; return enginesStore.listConfiguredEngines(); });
const availableAnalysisEngines = computed(() => engines.value.filter((candidate) => !gamesStore.getGame(props.gameId)?.analysis.seats.some((seat) => seat.assignedEngine.displayName === candidate.displayName)));
async function _confirmAnalysisEngine() {
  const game = gamesStore.getGame(props.gameId) as unknown as IGame | undefined;
  const engine = engines.value.find((candidate) => candidate.id === form.selectedEngineId);
  if (!game || !engine) return;
  if (await run(async () => {
    const adding = gamesStore.addAnalysisEngine(game, engine);
    const seat = game.analysis.seats.find((candidate) => candidate.assignedEngine.displayName === engine.displayName);
    await adding;
    const index = seat ? game.analysis.seats.indexOf(seat) : -1;
    if (game.gameState !== GameState.BoardEdit && index >= 0) await gamesStore.retryAnalysis(game, index);
  })) emit('dismissed');
}
</script>
<template>
  <ModalDialog title="Add analysis engine" subtitle="Assign a configured engine to this board." @dismissed="emit('dismissed')">
    <div v-if="engines.length" class="choice-list">
      <label v-for="engine in availableAnalysisEngines" :key="engine.id" class="choice-card"><input v-model="form.selectedEngineId" type="radio" :value="engine.id"><span class="choice-card__piece">♝</span><span><strong>{{ engine.displayName }}</strong><small>{{ engine.entryPath || 'Executable not selected' }}</small></span></label>
    </div>
    <p v-else class="inline-message">Add an engine profile in Settings before assigning analysis.</p>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="emit('dismissed')">Cancel</button><button class="text-button text-button--primary" :disabled="isWorking || !form.selectedEngineId" @click="_confirmAnalysisEngine">Add engine</button></template>
  </ModalDialog>
</template>

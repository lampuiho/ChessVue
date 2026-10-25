<script setup lang="ts">
import { computed, reactive } from 'vue';
import { EngineClientType, PlayerColour, PlayerType, type IEnginePlayer, type IGame, type IPlayer } from '@/contracts';
import { useEnginesStore, useGamesStore, useSettingsStore } from '@/state';
import { useModalAction } from '@/composables/ModalActionComposable';
import ModalDialog from './ModalDialog.vue';
const props = defineProps<{ gameId: string; colour: PlayerColour; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const gamesStore = useGamesStore();
const enginesStore = useEnginesStore();
const settingsStore = useSettingsStore();
const initialGame = gamesStore.getGame(props.gameId);
const currentPlayer = props.colour === PlayerColour.White ? initialGame?.whitePlayer : initialGame?.blackPlayer;
const form = reactive({ selectedPlayer: currentPlayer?.type === PlayerType.Engine ? 'unchanged' : currentPlayer?.type === PlayerType.Local ? 'local' : 'none' });
const { isWorking, errorMessage, run } = useModalAction(props.signal);
const engines = computed(() => { void settingsStore.settings; return enginesStore.listConfiguredEngines(); });
async function _confirmPlayerSelection() {
  const game = gamesStore.getGame(props.gameId) as unknown as IGame | undefined;
  if (!game) return;
  if (await run(async () => {
    if (form.selectedPlayer !== 'unchanged') await gamesStore.reassignPlayer(game, props.colour, _assignedPlayer(form.selectedPlayer, props.colour));
  })) emit('dismissed');
}
function _assignedPlayer(selection: string, colour: PlayerColour): IPlayer | undefined {
  if (selection === 'none') return;
  if (selection === 'local') return { colour, type: PlayerType.Local, displayName: colour === PlayerColour.White ? 'White' : 'Black' };
  const engine = engines.value.find((candidate) => candidate.id === selection.slice('engine:'.length));
  if (!engine?.entryPath.trim()) throw new Error('Choose an available engine profile.');
  const enginePlayer: IEnginePlayer = {
    colour,
    type: PlayerType.Engine,
    displayName: engine.displayName,
    assignedEngine: { displayName: engine.displayName, entryPath: engine.entryPath, clientType: engine.clientType ?? EngineClientType.Uci, options: { ...engine.options } },
  };
  return enginePlayer;
}
</script>
<template>
  <ModalDialog title="Choose a player" :subtitle="`Assign the ${colour} seat for this game.`" @dismissed="emit('dismissed')">
    <div class="choice-list">
      <label v-if="currentPlayer?.type === PlayerType.Engine" class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="unchanged"><span class="choice-card__piece">♞</span><span><strong>Keep {{ currentPlayer?.displayName }}</strong><small>Keep the engine and options assigned to this game.</small></span></label>
      <label class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="none"><span class="choice-card__piece">○</span><span><strong>Unassigned</strong><small>Turn this game into a free analysis workspace.</small></span></label>
      <label class="choice-card"><input v-model="form.selectedPlayer" type="radio" value="local"><span class="choice-card__piece">♙</span><span><strong>Local player</strong><small>Moves are entered on this board.</small></span></label>
      <label v-for="engine in engines" :key="engine.id" class="choice-card"><input v-model="form.selectedPlayer" type="radio" :value="`engine:${engine.id}`"><span class="choice-card__piece">♞</span><span><strong>{{ engine.displayName }}</strong><small>Configured UCI engine.</small></span></label>
    </div>
    <p v-if="errorMessage" class="inline-message inline-message--error inline-message--spaced">{{ errorMessage }}</p>
    <template #actions><button class="text-button text-button--ghost" @click="emit('dismissed')">Cancel</button><button class="text-button text-button--primary" :disabled="isWorking" @click="_confirmPlayerSelection">Assign player</button></template>
  </ModalDialog>
</template>

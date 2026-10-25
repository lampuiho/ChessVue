<script setup lang="ts">
import { computed } from 'vue';
import { PlayerType, type IEnginePlayer, type IPlayer } from '@/contracts/Game';
import type { PlayerColour } from '@/contracts/Chess';
import type { IEngineRecord } from '@/contracts/Engine';
import type { DeepReadonly } from '@/contracts/Readonly';
import { createEnginePlayer, createLocalPlayer } from '@/utility/GameCreationUtility';
const props = defineProps<{ id: string; label: string; colour: PlayerColour; engines: readonly DeepReadonly<IEngineRecord>[]; required?: boolean }>();
const player = defineModel<IPlayer>();
const selection = computed(() => !player.value ? 'none' : player.value.type === PlayerType.Local ? 'local' : 'keep');
const savedEngine = computed(() => player.value?.type === PlayerType.Engine ? (player.value as IEnginePlayer).assignedEngine : undefined);
function _select(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'keep') return;
  if (value === 'none') { player.value = undefined; return; }
  if (value === 'local') { player.value = createLocalPlayer(props.colour); return; }
  const engine = props.engines.find(candidate => `engine:${candidate.id}` === value);
  if (engine) player.value = createEnginePlayer(engine, props.colour);
}
</script>
<template>
  <div class="field-row">
    <label class="field-label" :for="id">{{ label }}<span v-if="savedEngine" class="field-help field-help--path">{{ savedEngine.entryPath }}</span></label>
    <select :id="id" :value="selection" :aria-label="label" class="field-control" @change="_select">
      <option v-if="!required" value="none">Unassigned (free analysis)</option>
      <option value="local">Local player</option>
      <option v-if="savedEngine" value="keep">Keep {{ savedEngine.displayName }} (saved configuration)</option>
      <option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">Use profile: {{ engine.displayName }}</option>
    </select>
  </div>
</template>

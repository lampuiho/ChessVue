<script setup lang="ts">
import { computed, ref } from 'vue';
import type { IEngineRecord } from '@/contracts/Engine';
import type { DeepReadonly } from '@/contracts/Readonly';
import { copyEngineProfile } from '@/utility/GameCreationUtility';
const props = defineProps<{ engines: readonly DeepReadonly<IEngineRecord>[] }>();
const snapshots = defineModel<IEngineRecord[]>({ required: true });
const selectedProfile = ref('');
const canAdd = computed(() => snapshots.value.length < 4 && props.engines.some(engine => engine.id === selectedProfile.value && !_unavailable(engine)));
function _unavailable(engine: DeepReadonly<IEngineRecord>, index = -1) { return snapshots.value.some((snapshot, position) => position !== index && snapshot.displayName === engine.displayName); }
function _replace(index: number, event: Event) {
  const select = event.target as HTMLSelectElement;
  const engine = props.engines.find(profile => profile.id === select.value);
  if (engine && !_unavailable(engine, index)) snapshots.value = snapshots.value.map((snapshot, position) => position === index ? copyEngineProfile(engine) : snapshot);
  select.value = '';
}
function _add() {
  const engine = props.engines.find(profile => profile.id === selectedProfile.value);
  if (!engine || snapshots.value.length >= 4 || _unavailable(engine)) return;
  snapshots.value = [...snapshots.value, copyEngineProfile(engine)];
  selectedProfile.value = '';
}
function _remove(index: number) { snapshots.value = snapshots.value.filter((_, position) => position !== index); }
</script>
<template>
  <div class="analysis-snapshots">
    <span class="field-label">Analysis engines<span class="field-help">{{ snapshots.length }} of 4 selected</span></span>
    <div v-for="(snapshot, index) in snapshots" :key="index" class="analysis-snapshots__row">
      <label class="field-label">Saved analysis engine {{ index + 1 }}<span class="field-help">{{ snapshot.entryPath }}</span><select value="" :aria-label="`Saved analysis engine ${index + 1}`" class="field-control" @change="_replace(index, $event)"><option value="">Keep {{ snapshot.displayName }} (saved configuration)</option><option v-for="engine in engines" :key="engine.id" :value="engine.id" :disabled="_unavailable(engine, index)">Use profile: {{ engine.displayName }}</option></select></label>
      <button type="button" class="text-button text-button--danger" :aria-label="`Remove analysis engine ${index + 1}`" @click="_remove(index)">Remove</button>
    </div>
    <div class="analysis-snapshots__row"><label class="field-label">Add analysis engine<select v-model="selectedProfile" aria-label="Add analysis engine" class="field-control" :disabled="snapshots.length >= 4"><option value="">Choose engine profile</option><option v-for="engine in engines" :key="engine.id" :value="engine.id" :disabled="_unavailable(engine)">{{ engine.displayName }}</option></select></label><button type="button" class="text-button" :disabled="!canAdd" @click="_add">Add engine</button></div>
    <p v-if="!engines.length" class="field-help">Add an engine profile in Settings &gt; Engines to choose another configuration.</p>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { EngineClientType, EngineProtocol, type IEngineOptionMap, type IEngineRecord } from '@/contracts';
import { useSettingsStore } from '@/state';
import ModalDialog from './ModalDialog.vue';
import AppIcon from '../common/AppIcon.vue';
const props = defineProps<{ engine?: IEngineRecord; index?: number; signal: AbortSignal }>();
const emit = defineEmits<{ dismissed: [] }>();
const settingsStore = useSettingsStore();
const errorMessage = ref('');
const engineForm = reactive({
  id: props.engine?.id ?? crypto.randomUUID(), displayName: props.engine?.displayName ?? '', executablePath: props.engine?.executablePath ?? '',
  options: Object.entries(props.engine?.options ?? {}).map(([name, value]) => ({ name, value: String(value) })),
});
function _saveEngine() {
  if (props.signal.aborted) return;
  const currentDraft = settingsStore.draftSettings;
  if (!currentDraft) return;
  const name = engineForm.displayName.trim();
  if (!name) {
    errorMessage.value = 'Engine name is required.';
    return;
  }
  const duplicate = currentDraft.analysis.engineInventory.some((engine, index) => engine.displayName === name && index !== props.index);
  if (duplicate) {
    errorMessage.value = `An engine named “${name}” already exists.`;
    return;
  }
  const options = _engineOptions();
  const record: IEngineRecord = { id: engineForm.id, displayName: name, executablePath: engineForm.executablePath.trim(), clientType: EngineClientType.Uci, protocol: EngineProtocol.Uci, options };
  if (props.index === undefined) currentDraft.analysis.engineInventory.push(record);
  else currentDraft.analysis.engineInventory.splice(props.index, 1, record);
  emit('dismissed');
  errorMessage.value = '';
}
function _engineOptions() {
  const options: IEngineOptionMap = {};
  for (const option of engineForm.options) {
    if (!option.name.trim()) continue;
    const trimmedValue = option.value.trim();
    options[option.name.trim()] = trimmedValue === 'true' ? true : trimmedValue === 'false' ? false : trimmedValue !== '' && Number.isFinite(Number(trimmedValue)) ? Number(trimmedValue) : option.value;
  }
  return options;
}
function _addOption() { engineForm.options.push({ name: '', value: '' }); }
</script>
<template>
  <ModalDialog :title="index === undefined ? 'Add engine profile' : 'Edit engine profile'" subtitle="Configure a UCI engine and its launch options." wide @dismissed="emit('dismissed')">
      <section class="form-section form-section--settings"><h3 class="form-section__heading">General</h3><div class="field-row"><label class="field-label" for="engine-name">Display name</label><input id="engine-name" v-model="engineForm.displayName" class="field-control" autofocus></div><div class="field-row"><label class="field-label" for="engine-path">Engine location<span class="field-help">Desktop executable path or browser worker URL. Use stockfish.js for the bundled browser engine.</span></label><input id="engine-path" v-model="engineForm.executablePath" class="field-control" placeholder="stockfish.js or C:\Engines\stockfish.exe"></div><div class="field-row"><span class="field-label">Protocol</span><span class="read-only-value">Universal Chess Interface (UCI)</span></div></section>
      <section class="form-section form-section--settings"><div class="engine-heading"><div><h3 class="form-section__heading">Options</h3><p class="form-section__description form-section__description--inline">Name/value pairs sent when the engine starts.</p></div><button class="text-button" @click="_addOption"><AppIcon name="plus" />Add option</button></div><div v-if="engineForm.options.length" class="option-list"><div v-for="(option, index) in engineForm.options" :key="index"><input v-model="option.name" class="field-control" placeholder="Option name"><input v-model="option.value" class="field-control" placeholder="Value"><button class="icon-button icon-button--danger" @click="engineForm.options.splice(index, 1)"><AppIcon name="trash" /></button></div></div><p v-else class="inline-message">No custom options. The engine will use its own defaults.</p></section>
      <p v-if="errorMessage" class="inline-message inline-message--error editor-error" role="alert">{{ errorMessage }}</p>
      <template #actions><button class="text-button text-button--ghost" @click="emit('dismissed')">Cancel</button><button class="text-button text-button--primary" @click="_saveEngine">Save profile</button></template>
  </ModalDialog>
</template>

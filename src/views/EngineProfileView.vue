<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { EngineClientType, type IEngineOptionMap, type IEngineRecord } from '@/contracts/Engine';
import { StockfishConfig } from '@/config/StockfishConfig';
import { useEnginesStore, useSettingsStore } from '@/state';
import AppIcon from '@/components/common/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const enginesStore = useEnginesStore();
const managedPackages = enginesStore.canInstallPackages();
const editing = computed(() => route.name === 'engine-profile-edit');
const copying = computed(() => route.name === 'engine-profile-copy');
const missing = ref(false);
const ready = ref(false);
const errorMessage = ref('');
const packageError = ref('');
const browsing = ref(false);
const options = reactive<Array<{ name: string; value: string }>>([]);
const form = reactive<IEngineRecord>({ id: crypto.randomUUID(), displayName: '', entryPath: '', clientType: managedPackages ? EngineClientType.UciWorker : EngineClientType.Uci, options: {} });
const packages = computed(() => enginesStore.listPackages());
const packageHint = computed(() => typeof route.query.packagePath === 'string' ? enginesStore.getPackage(route.query.packagePath) : undefined);
const workerEntry = computed(() => form.clientType === EngineClientType.UciWorker);
onMounted(_load);
async function _load() {
  try {
    await settingsStore.loadSettings();
    const profile = settingsStore.draftSettings?.analysis.engineInventory.find(engine => engine.id === route.params.profileId);
    if ((editing.value || copying.value) && !profile) { missing.value = true; return; }
    if (profile) {
      Object.assign(form, { ...profile, id: copying.value ? crypto.randomUUID() : profile.id, displayName: copying.value ? _copyName(profile.displayName) : profile.displayName, options: { ...profile.options } });
      options.push(...Object.entries(profile.options).map(([name, value]) => ({ name, value: String(value) })));
    }
    ready.value = true;
    await _refreshPackages();
  } catch (error) { errorMessage.value = _message(error); }
}
function _copyName(name: string) {
  const names = new Set(settingsStore.draftSettings?.analysis.engineInventory.map(engine => engine.displayName));
  let candidate = name + ' copy';
  let suffix = 2;
  while (names.has(candidate)) candidate = name + ' copy ' + suffix++;
  return candidate;
}
async function _refreshPackages() {
  packageError.value = '';
  try { await enginesStore.refreshPackages(); }
  catch (error) { packageError.value = _message(error); }
}
function _message(error: unknown) { return error instanceof Error ? error.message : 'The engine profile could not be loaded.'; }
function _back() { return router.push({ name: 'settings', params: { category: 'engines' } }); }
async function _browseEngineFile() {
  if (browsing.value) return;
  browsing.value = true;
  try { form.entryPath = await enginesStore.browseEngineFile(form.entryPath || undefined); }
  catch (error) { if (!(typeof error === 'object' && error && 'kind' in error && error.kind === 'cancelled')) errorMessage.value = _message(error); }
  finally { browsing.value = false; }
}
function _useIncludedEngine() { form.clientType = EngineClientType.UciWorker; form.entryPath = StockfishConfig.entryPath; }
function _engineOptions() {
  const result: IEngineOptionMap = {};
  for (const option of options) {
    if (!option.name.trim()) continue;
    const value = option.value.trim();
    result[option.name.trim()] = value === 'true' ? true : value === 'false' ? false : value !== '' && Number.isFinite(Number(value)) ? Number(value) : option.value;
  }
  return result;
}
async function _saveEngine() {
  const inventory = settingsStore.draftSettings?.analysis.engineInventory;
  if (!inventory) return;
  const name = form.displayName.trim();
  if (!name) { errorMessage.value = 'Profile name is required.'; return; }
  if (inventory.some(engine => engine.displayName === name && engine.id !== form.id)) { errorMessage.value = 'A profile named "' + name + '" already exists.'; return; }
  const record: IEngineRecord = { id: form.id, displayName: name, entryPath: form.entryPath.trim(), clientType: form.clientType, options: _engineOptions() };
  const index = inventory.findIndex(engine => engine.id === form.id);
  if (editing.value && index < 0) { missing.value = true; return; }
  if (index < 0) inventory.push(record);
  else inventory.splice(index, 1, record);
  await router.replace({ name: 'settings', params: { category: 'engines' } });
}
</script>

<template>
  <section class="engine-editor">
    <button class="text-button text-button--ghost" @click="_back"><AppIcon name="chevron-left" />Back to engines</button>
    <template v-if="missing"><h2 class="engine-editor__title">Profile not found</h2><p class="inline-message">This profile is no longer in the Settings draft.</p></template>
    <template v-else-if="ready">
      <header class="engine-editor__header"><h2 class="engine-editor__title">{{ editing ? 'Edit engine profile' : copying ? 'Copy engine profile' : 'Add engine profile' }}</h2><p class="form-section__description">Choose an executable or the supplied script inside an engine package.</p></header>
      <section class="form-section form-section--settings">
        <div class="field-row"><label class="field-label" for="engine-name">Profile name</label><input id="engine-name" v-model="form.displayName" class="field-control" autofocus></div>
        <div class="field-row"><label class="field-label" for="engine-interface">Engine interface</label><select id="engine-interface" v-model="form.clientType" class="field-control"><option :value="EngineClientType.Uci" :disabled="managedPackages">Desktop executable{{ managedPackages ? ' (requires desktop app)' : '' }}</option><option :value="EngineClientType.UciWorker">Browser UCI Worker</option></select></div>
        <p v-if="managedPackages && !workerEntry" class="inline-message">This executable requires the desktop app. Choose a browser engine to relink this profile.</p>
        <template v-if="managedPackages && workerEntry">
          <p v-if="packageHint" class="inline-message">Choose the supplied entry from {{ packageHint.displayName }}. The folder may contain several builds or helper scripts.</p>
          <div class="field-row"><label class="field-label" for="engine-entry-file">Engine entry script</label><select id="engine-entry-file" v-model="form.entryPath" class="field-control"><option value="">Choose the engine entry script</option><optgroup v-for="engine in packages" :key="engine.packagePath" :label="engine.displayName"><option v-for="file in engine.files" :key="file" :value="engine.packagePath + '/' + file">{{ file }}</option></optgroup></select></div>
        </template>
        <div class="field-row"><label class="field-label" for="engine-path">{{ workerEntry ? 'Entry path' : 'Executable path' }}<span class="field-help">{{ workerEntry ? 'Keep the package files and their relative layout together.' : 'The executable stays in its current location.' }}</span></label><input id="engine-path" v-model="form.entryPath" class="field-control"></div>
        <div class="engine-editor__actions"><button v-if="!managedPackages" class="text-button" :disabled="browsing" @click="_browseEngineFile">{{ workerEntry ? 'Browse entry script' : 'Browse executable' }}</button><button v-if="workerEntry" class="text-button" @click="_useIncludedEngine">Use included Stockfish</button></div>
        <p v-if="packageError" class="inline-message inline-message--error" role="alert">{{ packageError }} <button class="text-button" @click="_refreshPackages">Retry discovery</button></p>
      </section>
      <section class="form-section form-section--settings">
        <div class="engine-heading"><h3 class="form-section__heading">Options</h3><button class="text-button" @click="options.push({ name: '', value: '' })"><AppIcon name="plus" />Add option</button></div>
        <div v-if="options.length" class="option-list"><div v-for="(option, index) in options" :key="index"><input v-model="option.name" class="field-control" aria-label="Option name" placeholder="Option name"><input v-model="option.value" class="field-control" aria-label="Option value" placeholder="Value"><button class="icon-button icon-button--danger" aria-label="Remove option" @click="options.splice(index, 1)"><AppIcon name="trash" /></button></div></div>
        <p v-else class="inline-message">No custom options. The engine will use its own defaults.</p>
      </section>
      <p class="inline-message">Apply or Save on Settings to keep this profile. Open games retain their assigned configuration.</p>
      <footer class="engine-editor__actions"><button class="text-button text-button--ghost" @click="_back">Cancel</button><button class="text-button text-button--primary" @click="_saveEngine">{{ editing ? 'Update profile' : 'Add profile' }}</button></footer>
    </template>
    <p v-else class="inline-message">Loading profile...</p>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import type { IEngineArchive } from '@/contracts/Engine';
import { PlatformError } from '@/contracts/PlatformError';
import { useEnginesStore } from '@/state';
import { OperationOwner } from '@/utility/async/OperationOwner';
import AppIcon from '@/components/common/AppIcon.vue';

const router = useRouter();
const enginesStore = useEnginesStore();
const canInstall = enginesStore.canInstallPackages();
const engineName = ref('');
const filename = ref('');
const archive = shallowRef<IEngineArchive>();
const errorMessage = ref('');
const discoveryError = ref('');
const packagesReady = ref(false);
const loadingPackages = ref(false);
const reading = ref(false);
const installing = ref(false);
const savedPath = ref('');
const nameError = computed(() => _validateEngineName(engineName.value));
const canSubmit = computed(() => canInstall && packagesReady.value && !loadingPackages.value && !reading.value && !installing.value && !!archive.value && !nameError.value);
const _fileOwner = new OperationOwner();
let _fileWork = Promise.resolve();
let _packageRead: Promise<void> | undefined;
onMounted(() => { if (canInstall) void _refreshPackages(); });
onBeforeRouteLeave(_settleFileAction);
onBeforeRouteUpdate(_settleFileAction);
onBeforeUnmount(() => { void _fileOwner.dispose(); });
function _message(error: unknown) { return error instanceof Error ? error.message : 'The engine files could not be read.'; }
function _refreshPackages() {
  if (_packageRead) return _packageRead;
  packagesReady.value = false;
  loadingPackages.value = true;
  discoveryError.value = '';
  _packageRead = (async () => {
    try {
      await enginesStore.refreshPackages();
      packagesReady.value = true;
      if (savedPath.value) errorMessage.value = '';
    } catch (error) { discoveryError.value = _message(error); }
    finally { loadingPackages.value = false; _packageRead = undefined; }
  })();
  return _packageRead;
}
function _validateEngineName(name: string) {
  if (!name.trim()) return 'Engine name is required.';
  if (name === '.' || name === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[ .]$/.test(name)) return 'Use a folder name without reserved characters or a trailing space or dot.';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return 'This folder name is reserved.';
  if (enginesStore.listPackages().some(engine => engine.displayName.toLowerCase() === name.toLowerCase())) return 'An engine named "' + name + '" already exists.';
  return '';
}
function _chooseArchive(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || installing.value) return;
  _fileWork = _fileOwner.run(async signal => {
    reading.value = true;
    filename.value = file.name;
    archive.value = undefined;
    errorMessage.value = '';
    try {
      const buffer = await file.arrayBuffer();
      signal.throwIfAborted();
      archive.value = await enginesStore.readArchive({ path: file.name, data: new Uint8Array(buffer) }, signal);
    } catch (error) { if (!signal.aborted) errorMessage.value = _message(error); }
    finally { reading.value = false; }
  });
}
function _install() {
  if (!canSubmit.value || !archive.value) return;
  const selectedArchive = archive.value;
  const selectedName = engineName.value;
  installing.value = true;
  packagesReady.value = false;
  errorMessage.value = '';
  _fileWork = _fileOwner.run(async signal => {
    try {
      savedPath.value = await enginesStore.installPackage(selectedName, selectedArchive, signal);
      packagesReady.value = true;
    } catch (error) {
      if (error instanceof PlatformError && error.operation === 'refreshEnginePackagesAfterInstall') savedPath.value = error.detail ?? '';
      errorMessage.value = _message(error);
    } finally { installing.value = false; }
  });
}
async function _settleFileAction() {
  if (installing.value) await _fileWork;
  else await _fileOwner.cancel();
  return true;
}
function _back() { return router.push({ name: 'settings', params: { category: 'engines' } }); }
function _createProfile() { return router.push({ name: 'engine-profile-new', params: { category: 'engines' }, query: { packagePath: savedPath.value } }); }
</script>

<template>
  <section class="engine-editor">
    <button class="text-button text-button--ghost" :disabled="installing" @click="_back"><AppIcon name="chevron-left" />Back to engines</button>
    <header class="engine-editor__header"><h2 class="engine-editor__title">Install browser engine</h2><p class="form-section__description">Package files are saved immediately. Profiles are configured separately.</p></header>
    <p v-if="!canInstall" class="inline-message">Package import is available in the browser app. On desktop, add a profile pointing to your executable or unpacked script.</p>
    <template v-else-if="savedPath">
      <p class="inline-message" role="status">{{ packagesReady ? 'Import complete.' : 'Engine files were saved. Refresh the folder list to continue.' }}</p>
      <p class="inline-message">Create a profile to choose the engine entry and interface.</p>
      <div class="engine-editor__actions"><button class="text-button" @click="_back">Done</button><button v-if="!packagesReady" class="text-button" :disabled="loadingPackages" @click="_refreshPackages">Refresh folders</button><button class="text-button text-button--primary" :disabled="!packagesReady" @click="_createProfile">Create profile</button></div>
    </template>
    <template v-else>
      <section class="form-section form-section--settings">
        <div class="field-row"><label class="field-label" for="package-engine-name">Engine name<span class="field-help">The installed folder name. It must be unique; include a version in the name if you want one.</span></label><input id="package-engine-name" v-model="engineName" class="field-control" :disabled="installing" :aria-invalid="!!engineName && !!nameError" aria-describedby="package-name-error"></div>
        <p v-if="engineName && nameError" id="package-name-error" class="inline-message inline-message--error" role="alert">{{ nameError }}</p>
        <div class="field-row"><label class="field-label" for="engine-archive">Choose engine archive<span class="field-help">ZIP files keep their original names and relative layout.</span></label><input id="engine-archive" class="field-control" type="file" accept=".zip,application/zip" :disabled="installing" @change="_chooseArchive"></div>
        <p v-if="loadingPackages" class="inline-message" role="status">Loading engine folders...</p>
        <p v-if="discoveryError" class="inline-message inline-message--error" role="alert">{{ discoveryError }}</p>
        <button v-if="!packagesReady && !loadingPackages" class="text-button" :disabled="installing" @click="_refreshPackages">Refresh folders</button>
        <p v-if="reading" class="inline-message" role="status">Reading package...</p>
        <template v-if="archive"><p class="inline-message">{{ filename }} &middot; {{ archive.files.length }} files</p><ul class="engine-package-files" aria-label="Package files"><li v-for="file in archive.files" :key="file.path">{{ file.path }}</li></ul><p class="inline-message">Choose the entry and interface later in a separate profile.</p></template>
      </section>
      <p v-if="installing" class="inline-message" role="status">Saving engine files...</p>
      <footer class="engine-editor__actions"><button class="text-button text-button--ghost" :disabled="installing" @click="_back">Cancel</button><button class="text-button text-button--primary" :disabled="!canSubmit" @click="_install">Install engine</button></footer>
    </template>
    <p v-if="savedPath && discoveryError" class="inline-message inline-message--error" role="alert">{{ discoveryError }}</p>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

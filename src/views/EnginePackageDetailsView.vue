<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { EngineClientType, EngineInstallationSource, type IEnginePackageUsage } from '@/contracts/Engine';
import { PlayerType, type IEnginePlayer } from '@/contracts';
import { useEnginesStore, useGamesStore, useSettingsStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import ConfirmationModal from '@/components/modals/ConfirmationModal.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const modal = useModal();
const enginesStore = useEnginesStore();
const settingsStore = useSettingsStore();
const gamesStore = useGamesStore();
const packagePath = computed(() => typeof route.query.packagePath === 'string' ? route.query.packagePath : '');
const engine = computed(() => enginesStore.getPackage(packagePath.value));
const loading = ref(false);
const errorMessage = ref('');
const references = computed(() => _readReferences().filter(reference => reference.clientType === EngineClientType.UciWorker && reference.entryPath.startsWith(packagePath.value + '/')));
onMounted(_load);
async function _load() {
  loading.value = true;
  errorMessage.value = '';
  try { await settingsStore.loadSettings(); await enginesStore.refreshPackages(); }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'The engine folder could not be read.'; }
  finally { loading.value = false; }
}
function _readReferences(): IEnginePackageUsage[] {
  const result: IEnginePackageUsage[] = [];
  for (const profile of settingsStore.settings?.analysis.engineInventory ?? []) result.push({ displayName: 'Profile: ' + profile.displayName, entryPath: profile.entryPath, clientType: profile.clientType });
  for (const profile of settingsStore.draftSettings?.analysis.engineInventory ?? []) result.push({ displayName: 'Draft profile: ' + profile.displayName, entryPath: profile.entryPath, clientType: profile.clientType });
  for (const game of gamesStore.listGames()) {
    for (const player of [game.whitePlayer, game.blackPlayer]) {
      if (player?.type !== PlayerType.Engine) continue;
      const assigned = (player as IEnginePlayer).assignedEngine;
      result.push({ displayName: game.metadata.name + ': ' + assigned.displayName, entryPath: assigned.entryPath, clientType: assigned.clientType });
    }
    for (const seat of game.analysis.seats) result.push({ displayName: game.metadata.name + ' analysis: ' + seat.assignedEngine.displayName, entryPath: seat.assignedEngine.entryPath, clientType: seat.assignedEngine.clientType });
  }
  return result;
}
function _back() { return router.push({ name: 'settings', params: { category: 'engines' } }); }
function _createProfile() { return router.push({ name: 'engine-profile-new', params: { category: 'engines' }, query: { packagePath: packagePath.value } }); }
function _removePackage() {
  modal.open(ConfirmationModal, {
    title: 'Remove engine files?', subtitle: engine.value?.displayName ?? '',
    message: 'Remove the imported package files from this browser. Profiles and open games are kept. Closed games may need the package again.',
    confirmLabel: 'Remove files', danger: true, dismissibleWhileWorking: false,
    confirm: _confirmRemovePackage,
  });
}
async function _confirmRemovePackage(signal: AbortSignal) {
  signal.throwIfAborted();
  await enginesStore.removePackage(packagePath.value, _readReferences);
  await router.replace({ name: 'settings', params: { category: 'engines' } });
}
</script>

<template>
  <section class="engine-editor">
    <button class="text-button text-button--ghost" @click="_back"><AppIcon name="chevron-left" />Back to engines</button>
    <p v-if="loading" class="inline-message" role="status">Reading engine folder...</p>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }} <button class="text-button" @click="_load">Refresh folders</button></p>
    <template v-if="engine">
      <header class="engine-editor__header"><h2 class="engine-editor__title">{{ engine.displayName }}</h2><p class="form-section__description">{{ engine.source === EngineInstallationSource.Bundled ? 'Included with ChessVue' : 'Imported package' }}</p></header>
      <p v-if="engine.warning" class="inline-message inline-message--error" role="alert">{{ engine.warning }}</p>
      <section class="form-section form-section--settings"><h3 class="form-section__heading">Package files</h3><ul class="engine-package-files"><li v-for="file in engine.files" :key="file">{{ file }}</li></ul></section>
      <section class="form-section form-section--settings"><h3 class="form-section__heading">Profiles and open games</h3><ul v-if="references.length" class="engine-package-files"><li v-for="reference in references" :key="reference.displayName + reference.entryPath">{{ reference.displayName }}</li></ul><p v-else class="inline-message">No profiles or open games reference this folder.</p></section>
      <p class="inline-message">Create a profile to choose the supplied entry script and engine interface.</p>
      <footer class="engine-editor__actions"><button class="text-button text-button--primary" @click="_createProfile">Create profile</button><button v-if="engine.source === EngineInstallationSource.User && enginesStore.canInstallPackages()" class="text-button text-button--danger" :disabled="loading" @click="_removePackage">Remove files</button></footer>
    </template>
    <template v-else-if="!loading && !errorMessage"><h2 class="engine-editor__title">Engine folder not found</h2><p class="inline-message">Return to engines and refresh the folder list.</p></template>
  </section>
</template>

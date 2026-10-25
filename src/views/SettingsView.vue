<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterView, useRoute, useRouter } from 'vue-router';
import {
  AnalysisBranchExitBehaviour,
  EngineClientType,
  EngineInstallationSource,
  BoardOrientation,
  PlayerType,
  SettingsCategory,
  ThemeMode,
  TimeControlPreset,
  type IEngineRecord,
} from '@/contracts';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { useEnginesStore, useSettingsStore, useUiStateStore } from '@/state';
import { useModal } from '@/composables/ModalComposable';
import ConfirmationModal from '@/components/modals/ConfirmationModal.vue';
import NavigationFrame from '@/components/NavigationFrame.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const emit = defineEmits<{ appearanceChanged: [] }>();
const modal = useModal();
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const enginesStore = useEnginesStore();
const uiStateStore = useUiStateStore();
const category = computed(() => route.params.category as SettingsCategory);
const draft = computed(() => settingsStore.draftSettings);
const errorMessage = ref('');
const successMessage = ref('');
const hasEngineView = computed(() => route.matched.length > 1);
const packages = computed(() => enginesStore.listPackages());
const packagesLoading = ref(false);
const packageError = ref('');
let _packageRead: Promise<void> | undefined;
const categories = [
  { id: SettingsCategory.Session, label: 'Session', icon: 'save' },
  { id: SettingsCategory.Gameplay, label: 'Gameplay', icon: 'sliders' },
  { id: SettingsCategory.Appearance, label: 'Appearance', icon: 'sparkles' },
  { id: SettingsCategory.Engines, label: 'Engines', icon: 'activity' },
];
const returnRoute = computed(() => uiStateStore.gameSession?.activeGameId ? `/game/${uiStateStore.gameSession.activeGameId}` as const : '/home' as const);
onMounted(() => { if (category.value === SettingsCategory.Engines) void _loadEnginePackages(); });
onBeforeRouteUpdate(to => { if (to.params.category === SettingsCategory.Engines) void _loadEnginePackages(); });
onBeforeRouteLeave((to) => {
  if (!settingsStore.hasPendingChanges) return true;
  _requestDiscardChanges(to.fullPath);
  return false;
});

function _themePreviewStyle(theme: ThemeMode): Record<string, string> {
  const light = defaultLightThemeProfile.cssVariables;
  const dark = defaultDarkThemeProfile.cssVariables;
  const _value = (name: keyof typeof light): string => theme === ThemeMode.System
    ? `linear-gradient(120deg, ${light[name]} 49%, ${dark[name]} 51%)`
    : (theme === ThemeMode.Light ? light : dark)[name];
  return {
    '--preview-app': _value('--surface-app'),
    '--preview-accent': _value('--accent'),
    '--preview-border': _value('--border-subtle'),
    '--preview-dialog': _value('--surface-dialog'),
  };
}

function _changeCategory(nextCategory: SettingsCategory) {
  void router.push(`/settings/${nextCategory}`);
}
function _requestReturn() {
  if (settingsStore.hasPendingChanges) {
    _requestDiscardChanges(returnRoute.value);
    return;
  }
  void router.push(returnRoute.value);
}
function _requestDiscardChanges(targetRoute: string) {
  modal.open(ConfirmationModal, {
    title: 'Discard unsaved changes?', subtitle: 'You have settings changes that have not been applied.',
    cancelLabel: 'Keep editing', confirmLabel: 'Discard changes', confirm: (signal) => _discardChangesAndNavigate(targetRoute, signal),
  });
}
async function _discardChangesAndNavigate(targetRoute: string, signal: AbortSignal) {
  signal.throwIfAborted();
  settingsStore.discardPendingSettings();
  await router.push(targetRoute);
}
function _requestResetSettings() {
  modal.open(ConfirmationModal, {
    title: 'Reset all settings?', subtitle: 'Preferences and engine profiles will return to their defaults.',
    message: 'This cannot be undone after you save another change.', confirmLabel: 'Reset settings', danger: true,
    confirm: _resetSettings,
  });
}
async function _resetSettings() {
  await settingsStore.resetSettings();
  emit('appearanceChanged');
}
async function _applySettings(leave: boolean) {
  errorMessage.value = '';
  successMessage.value = '';
  try {
    if (leave) await settingsStore.saveSettings();
    else await settingsStore.applySettings();
    emit('appearanceChanged');
    successMessage.value = 'Settings applied.';
    if (leave) await router.push(returnRoute.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings could not be saved.';
  }
}
function _openEngineEditor(engine?: IEngineRecord) {
  return router.push({ name: engine ? 'engine-profile-edit' : 'engine-profile-new', params: { category: 'engines', ...(engine ? { profileId: engine.id } : {}) } });
}
function _copyEngine(engine: IEngineRecord) {
  return router.push({ name: 'engine-profile-copy', params: { category: 'engines', profileId: engine.id } });
}
function _openImport() { return router.push({ name: 'engine-package-import', params: { category: 'engines' } }); }
function _openPackage(packagePath: string) { return router.push({ name: 'engine-package-details', params: { category: 'engines' }, query: { packagePath } }); }
function _createPackageProfile(packagePath: string) { return router.push({ name: 'engine-profile-new', params: { category: 'engines' }, query: { packagePath } }); }
function _loadEnginePackages() {
  if (_packageRead) return _packageRead;
  packagesLoading.value = true;
  packageError.value = '';
  _packageRead = (async () => {
    try { await enginesStore.refreshPackages(); }
    catch (error) { packageError.value = error instanceof Error ? error.message : 'Engine folders could not be read.'; }
    finally { packagesLoading.value = false; _packageRead = undefined; }
  })();
  return _packageRead;
}
function _removeEngine(index: number) {
  draft.value?.analysis.engineInventory.splice(index, 1);
}
</script>

<template>
  <main class="settings-page page-shell app-page">
    <NavigationFrame>
      <template #brand><button class="app-brand" aria-label="ChessVue home" title="ChessVue home" @click="_requestReturn"><span class="app-brand__mark">♞</span><span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Preferences</span></span></button></template>
      <button class="menu-button" :aria-label="`Back to ${uiStateStore.gameSession?.activeGameId ? 'game' : 'home'}`" @click="_requestReturn"><AppIcon name="chevron-left" /><span>Back to {{ uiStateStore.gameSession?.activeGameId ? 'game' : 'home' }}</span></button>
      <nav class="navigation-group" aria-label="Settings categories"><button v-for="item in categories" :key="item.id" class="menu-button" :class="{ active: category === item.id }" :aria-label="item.label" @click="_changeCategory(item.id)"><AppIcon :name="item.icon" /><span>{{ item.label }}</span></button></nav>
      <template #footer><button class="menu-button menu-button--danger" aria-label="Reset to defaults" title="Reset to defaults" @click="_requestResetSettings()"><AppIcon name="rotate" /><span>Reset to defaults</span></button></template>
    </NavigationFrame>
    <div class="settings-layout">
      <section v-if="draft" class="settings-content surface">
        <header class="settings-content__header"><div><p class="page-kicker page-kicker--flush">{{ category }}</p><h2>{{ categories.find((item) => item.id === category)?.label }}</h2></div><span v-if="settingsStore.hasPendingChanges" class="unsaved-badge"><i></i>Unsaved changes</span></header>
        <div class="settings-content__body">
          <RouterView v-if="hasEngineView" :key="route.fullPath" />
          <template v-else-if="category === SettingsCategory.Session">
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Startup</h3><p class="form-section__description">Choose what ChessVue restores when the application opens.</p>
              <div class="field-row"><span class="field-label">Previous session<span class="field-help">Reopen active game tabs after launch</span></span><label class="toggle-row"><input v-model="draft.gameSession.restorePreviousSession" aria-label="Restore previous session" type="checkbox"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.gameSession.restorePreviousSession ? 'Restore my workspace' : 'Always open home' }}</span></label></div>
              <div class="field-row"><span class="field-label">Auto-pause on menu<span class="field-help">Stops timed games while using app screens</span></span><label class="toggle-row"><input v-model="draft.gameSession.autoPauseOnMenu" aria-label="Pause on menus" type="checkbox"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.gameSession.autoPauseOnMenu ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Saving</h3><p class="form-section__description">Games remain local to this desktop.</p>
              <div class="field-row"><label class="field-label" for="save-root">Save folder<span class="field-help">Relative or absolute local path</span></label><input id="save-root" v-model="draft.gameSession.saveRootPath" class="field-control"></div>
              <div class="field-row"><label class="field-label" for="autosave-count">Autosave interval<span class="field-help">Moves between automatic snapshots; 0 disables</span></label><input id="autosave-count" v-model.number="draft.gameSession.autosaveAfterMoveCount" class="field-control" type="number" min="0"></div>
              <div class="field-row"><span class="field-label">Save on close</span><label class="toggle-row"><input v-model="draft.gameSession.autosaveOnClose" aria-label="Save on close" type="checkbox" :disabled="draft.gameSession.restorePreviousSession"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.gameSession.autosaveOnClose ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
          </template>
          <template v-else-if="category === SettingsCategory.Gameplay">
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Quick game defaults</h3><p class="form-section__description">Used by the one-click Quick game action.</p>
              <div class="field-row"><label class="field-label" for="quick-name">Game name</label><input id="quick-name" v-model="draft.gameDefaults.quickNewGameName" class="field-control"></div>
              <div class="field-row"><label class="field-label" for="white-default">White player</label><select id="white-default" v-model="draft.gameDefaults.defaultWhitePlayerType" class="field-control"><option :value="PlayerType.Local">Local</option><option :value="PlayerType.Engine">Engine</option></select></div>
              <div class="field-row"><label class="field-label" for="black-default">Black player</label><select id="black-default" v-model="draft.gameDefaults.defaultBlackPlayerType" class="field-control"><option :value="PlayerType.Local">Local</option><option :value="PlayerType.Engine">Engine</option></select></div>
              <div class="field-row"><label class="field-label" for="clock-preset">Clock preset</label><select id="clock-preset" v-model="draft.gameDefaults.defaultTimeControl.preset" class="field-control"><option :value="TimeControlPreset.Untimed">Untimed</option><option :value="TimeControlPreset.Bullet">Bullet</option><option :value="TimeControlPreset.Blitz">Blitz</option><option :value="TimeControlPreset.Rapid">Rapid</option><option :value="TimeControlPreset.Classical">Classical</option></select></div>
              <div v-if="draft.gameDefaults.defaultTimeControl.preset !== TimeControlPreset.Untimed" class="field-row"><label class="field-label" for="initial-time">Initial time (milliseconds)</label><input id="initial-time" v-model.number="draft.gameDefaults.defaultTimeControl.initialMs" class="field-control" type="number" min="1000" step="1000"></div>
              <div class="field-row"><label class="field-label" for="increment">Increment (milliseconds)</label><input id="increment" v-model.number="draft.gameDefaults.defaultTimeControl.incrementMs" class="field-control" type="number" min="0" step="1000"></div>
            </section>
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Move behaviour</h3>
              <div class="field-row"><label class="field-label" for="branch-exit">After exploring history<span class="field-help">Where the board settles after an analysis move</span></label><select id="branch-exit" v-model="draft.gameplay.analysisBranchExitBehaviour" class="field-control"><option :value="AnalysisBranchExitBehaviour.ReturnToLiveNode">Return to live position</option><option :value="AnalysisBranchExitBehaviour.StayOnBranch">Stay on analysis branch</option></select></div>
            </section>
          </template>
          <template v-else-if="category === SettingsCategory.Appearance">
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Theme</h3><p class="form-section__description">Choose how the app chrome responds to your desktop.</p>
              <div class="theme-picker"><label v-for="theme in [ThemeMode.System, ThemeMode.Light, ThemeMode.Dark]" :key="theme" :class="{ active: draft.appearance.themeMode === theme }"><input v-model="draft.appearance.themeMode" type="radio" :value="theme"><span class="theme-preview" :style="_themePreviewStyle(theme)"><i></i><b></b><em></em></span><strong>{{ theme }}</strong></label></div>
            </section>
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Board</h3>
              <div class="field-row"><label class="field-label" for="orientation">Orientation</label><select id="orientation" v-model="draft.appearance.boardOrientation" class="field-control"><option :value="BoardOrientation.White">White at bottom</option><option :value="BoardOrientation.Black">Black at bottom</option></select></div>
              <div class="field-row"><span class="field-label">Coordinates</span><label class="toggle-row"><input v-model="draft.appearance.showCoordinates" aria-label="Coordinates" type="checkbox"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.appearance.showCoordinates ? 'Shown' : 'Hidden' }}</span></label></div>
              <div class="field-row"><span class="field-label">Last move highlight</span><label class="toggle-row"><input v-model="draft.appearance.highlightLastMove" aria-label="Last move highlight" type="checkbox"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.appearance.highlightLastMove ? 'Shown' : 'Hidden' }}</span></label></div>
            </section>
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Interface scale</h3>
              <div class="scale-control"><input v-model.number="draft.appearance.uiScalePercent" aria-label="Interface scale" type="range" min="75" max="150" step="5"><strong>{{ draft.appearance.uiScalePercent }}%</strong></div>
            </section>
          </template>
          <template v-else>
            <section v-if="enginesStore.canInstallPackages()" class="form-section form-section--settings">
              <div class="engine-heading"><div><h3 class="form-section__heading">Installed browser engines</h3><p class="form-section__description">Stored package folders and included engine files.</p></div><div class="engine-editor__actions"><button class="text-button" :disabled="packagesLoading" @click="_loadEnginePackages">Refresh</button><button class="text-button text-button--primary" @click="_openImport">Install browser engine</button></div></div>
              <p v-if="packagesLoading" class="inline-message" role="status">Reading engine folders?</p>
              <p v-if="packageError" class="inline-message inline-message--error" role="alert">{{ packageError }}</p>
              <div class="engine-package-list"><article v-for="engine in packages" :key="engine.packagePath" class="engine-package-list__item"><div class="engine-package-list__description"><strong class="engine-package-list__name">{{ engine.displayName }}</strong><span class="engine-package-list__meta">{{ engine.source === EngineInstallationSource.Bundled ? 'Included with ChessVue' : 'Imported package' }} &middot; {{ engine.files.length }} files</span><p v-if="engine.warning" class="inline-message inline-message--error">{{ engine.warning }}</p></div><div class="engine-editor__actions"><button class="text-button" @click="_createPackageProfile(engine.packagePath)">Create profile</button><button class="text-button" @click="_openPackage(engine.packagePath)">Details</button></div></article></div>
            </section>
            <section class="form-section form-section--settings"><h3 class="form-section__heading">Analysis behaviour</h3>
              <div class="field-row"><span class="field-label">Resume after restore<span class="field-help">Restart assigned analysis engines with the session</span></span><label class="toggle-row"><input v-model="draft.analysis.resumeLiveAnalysisAfterRestore" aria-label="Resume after restore" type="checkbox"><span class="toggle-track"></span><span class="toggle-copy">{{ draft.analysis.resumeLiveAnalysisAfterRestore ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
            <section class="form-section form-section--settings"><div class="engine-heading"><div><h3 class="form-section__heading">Engine profiles</h3><p class="form-section__description form-section__description--inline">Reusable engine configurations.</p></div><button class="text-button text-button--primary" @click="_openEngineEditor()"><AppIcon name="plus" />Add profile</button></div>
              <div v-if="draft.analysis.engineInventory.length" class="engine-list">
                <article v-for="(engine, index) in draft.analysis.engineInventory" :key="engine.id"><span class="engine-list__mark">♞</span><div><strong>{{ engine.displayName }}</strong><small>{{ engine.entryPath || 'No engine location selected' }}</small></div><span class="engine-list__interface">{{ engine.clientType === EngineClientType.UciWorker ? 'Browser UCI Worker' : 'Desktop executable' }}</span><button class="icon-button" title="Copy" @click="_copyEngine(engine)"><AppIcon name="copy" /></button><button class="icon-button" title="Edit" @click="_openEngineEditor(engine)"><AppIcon name="edit" /></button><button class="icon-button icon-button--danger" title="Delete" @click="_removeEngine(index)"><AppIcon name="trash" /></button></article>
              </div>
              <div v-else class="empty-state empty-state--engine engine-empty"><AppIcon name="activity" /><strong>No engines configured</strong><span>Add a UCI engine to use computer opponents and live analysis.</span></div>
            </section>
          </template>
        </div>
        <footer v-if="!hasEngineView" class="settings-actions"><span v-if="errorMessage" class="settings-feedback settings-feedback--error">{{ errorMessage }}</span><span v-else-if="successMessage" class="settings-feedback">{{ successMessage }}</span><button class="text-button text-button--ghost text-button--settings-mobile" @click="_requestReturn">Cancel</button><button class="text-button text-button--settings-mobile" :disabled="!settingsStore.hasPendingChanges" @click="_applySettings(true)">Save</button><button class="text-button text-button--primary text-button--settings-mobile" :disabled="!settingsStore.hasPendingChanges" @click="_applySettings(false)">Apply changes</button></footer>
      </section>
    </div>
  </main>
</template>


<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  AnalysisBranchExitBehaviour,
  AppModalKind,
  BoardOrientation,
  EngineClientType,
  EngineProtocol,
  PlayerType,
  SettingsCategory,
  ThemeMode,
  TimeControlPreset,
  type IEngineOptionMap,
  type IEngineRecord,
} from '@/contracts';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { useSettingsStore, useUiStateStore } from '@/state';
import NavigationFrame from '@/components/NavigationFrame.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ModalDialog from '@/components/common/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const uiStateStore = useUiStateStore();
const category = computed(() => route.params.category as SettingsCategory);
const draft = computed(() => settingsStore.draftSettings);
const errorMessage = ref('');
const successMessage = ref('');
const editingEngineIndex = ref<number>();
const engineEditorOpen = ref(false);
const engineForm = reactive({ id: '', displayName: '', executablePath: '', options: [] as { name: string; value: string }[] });
const categories = [
  { id: SettingsCategory.Session, label: 'Session', icon: 'save' },
  { id: SettingsCategory.Gameplay, label: 'Gameplay', icon: 'sliders' },
  { id: SettingsCategory.Appearance, label: 'Appearance', icon: 'sparkles' },
  { id: SettingsCategory.Engines, label: 'Engines', icon: 'activity' },
];
const returnRoute = computed(() => uiStateStore.gameSession?.activeGameId ? `/game/${uiStateStore.gameSession.activeGameId}` as const : '/home' as const);
onBeforeRouteLeave((to) => {
  if (!settingsStore.hasPendingChanges) return true;
  uiStateStore.showModal({ kind: AppModalKind.SettingsDirtyLeave, payload: { targetRoute: to.fullPath } });
  return false;
});

function themePreviewStyle(theme: ThemeMode): Record<string, string> {
  const light = defaultLightThemeProfile.cssVariables;
  const dark = defaultDarkThemeProfile.cssVariables;
  const value = (name: keyof typeof light): string => theme === ThemeMode.System
    ? `linear-gradient(120deg, ${light[name]} 49%, ${dark[name]} 51%)`
    : (theme === ThemeMode.Light ? light : dark)[name];
  return {
    '--preview-app': value('--surface-app'),
    '--preview-accent': value('--accent'),
    '--preview-border': value('--border-subtle'),
    '--preview-dialog': value('--surface-dialog'),
  };
}

function changeCategory(nextCategory: SettingsCategory) {
  void router.push(`/settings/${nextCategory}`);
}
function requestReturn() {
  if (settingsStore.hasPendingChanges) {
    uiStateStore.showModal({ kind: AppModalKind.SettingsDirtyLeave, payload: { targetRoute: returnRoute.value } });
    return;
  }
  void router.push(returnRoute.value);
}
async function applySettings(leave: boolean) {
  errorMessage.value = '';
  successMessage.value = '';
  try {
    if (leave) await settingsStore.saveSettings();
    else await settingsStore.applySettings();
    successMessage.value = 'Settings applied.';
    if (leave) await router.push(returnRoute.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings could not be saved.';
  }
}
function openEngineEditor(engine?: IEngineRecord, index?: number) {
  editingEngineIndex.value = index;
  engineForm.id = engine?.id ?? crypto.randomUUID();
  engineForm.displayName = engine?.displayName ?? '';
  engineForm.executablePath = engine?.executablePath ?? '';
  engineForm.options = Object.entries(engine?.options ?? {}).map(([name, value]) => ({ name, value: String(value) }));
  engineEditorOpen.value = true;
}
function copyEngine(engine: IEngineRecord) {
  const names = new Set(draft.value?.analysis.engineInventory.map((candidate) => candidate.displayName));
  let displayName = `${engine.displayName} copy`;
  let suffix = 2;
  while (names.has(displayName)) displayName = `${engine.displayName} copy ${suffix++}`;
  openEngineEditor({ ...engine, id: crypto.randomUUID(), displayName, options: { ...engine.options } });
}
function saveEngine() {
  const currentDraft = draft.value;
  if (!currentDraft) return;
  const name = engineForm.displayName.trim();
  if (!name) {
    errorMessage.value = 'Engine name is required.';
    return;
  }
  const duplicate = currentDraft.analysis.engineInventory.some((engine, index) => engine.displayName === name && index !== editingEngineIndex.value);
  if (duplicate) {
    errorMessage.value = `An engine named “${name}” already exists.`;
    return;
  }
  const options: IEngineOptionMap = {};
  for (const option of engineForm.options) {
    if (!option.name.trim()) continue;
    const trimmedValue = option.value.trim();
    options[option.name.trim()] = trimmedValue === 'true' ? true : trimmedValue === 'false' ? false : trimmedValue !== '' && Number.isFinite(Number(trimmedValue)) ? Number(trimmedValue) : option.value;
  }
  const record: IEngineRecord = { id: engineForm.id, displayName: name, executablePath: engineForm.executablePath.trim(), clientType: EngineClientType.Uci, protocol: EngineProtocol.Uci, options };
  if (editingEngineIndex.value === undefined) currentDraft.analysis.engineInventory.push(record);
  else currentDraft.analysis.engineInventory.splice(editingEngineIndex.value, 1, record);
  engineEditorOpen.value = false;
  errorMessage.value = '';
}
function removeEngine(index: number) {
  draft.value?.analysis.engineInventory.splice(index, 1);
}
function addOption() {
  engineForm.options.push({ name: '', value: '' });
}
</script>

<template>
  <main class="settings-page page-shell app-page">
    <NavigationFrame>
      <template #brand><button class="app-brand" aria-label="ChessVue home" title="ChessVue home" @click="requestReturn"><span class="app-brand__mark">♞</span><span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Preferences</span></span></button></template>
      <button class="menu-button" :aria-label="`Back to ${uiStateStore.gameSession?.activeGameId ? 'game' : 'home'}`" @click="requestReturn"><AppIcon name="chevron-left" /><span>Back to {{ uiStateStore.gameSession?.activeGameId ? 'game' : 'home' }}</span></button>
      <nav class="category-list" aria-label="Settings categories"><button v-for="item in categories" :key="item.id" class="menu-button" :class="{ active: category === item.id }" :aria-label="item.label" @click="changeCategory(item.id)"><AppIcon :name="item.icon" /><span>{{ item.label }}</span></button></nav>
      <template #footer><button class="menu-button menu-button--danger" aria-label="Reset to defaults" title="Reset to defaults" @click="uiStateStore.showModal({ kind: AppModalKind.ResetSettings })"><AppIcon name="rotate" /><span>Reset to defaults</span></button></template>
    </NavigationFrame>
    <div class="settings-layout">
      <section v-if="draft" class="settings-content surface">
        <header class="settings-content__header"><div><p class="page-kicker">{{ category }}</p><h2>{{ categories.find((item) => item.id === category)?.label }}</h2></div><span v-if="settingsStore.hasPendingChanges" class="unsaved-badge"><i></i>Unsaved changes</span></header>
        <div class="settings-content__body">
          <template v-if="category === SettingsCategory.Session">
            <section class="form-section"><h3 class="form-section__heading">Startup</h3><p class="form-section__description">Choose what ChessVue restores when the application opens.</p>
              <div class="field-row"><span class="field-label">Previous session<span class="field-help">Reopen active game tabs after launch</span></span><label class="toggle-row"><input v-model="draft.gameSession.restorePreviousSession" aria-label="Restore previous session" type="checkbox"><span class="toggle-track"></span><span>{{ draft.gameSession.restorePreviousSession ? 'Restore my workspace' : 'Always open home' }}</span></label></div>
              <div class="field-row"><span class="field-label">Auto-pause on menu<span class="field-help">Stops timed games while using app screens</span></span><label class="toggle-row"><input v-model="draft.gameSession.autoPauseOnMenu" aria-label="Pause on menus" type="checkbox"><span class="toggle-track"></span><span>{{ draft.gameSession.autoPauseOnMenu ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
            <section class="form-section"><h3 class="form-section__heading">Saving</h3><p class="form-section__description">Games remain local to this desktop.</p>
              <div class="field-row"><label class="field-label" for="save-root">Save folder<span class="field-help">Relative or absolute local path</span></label><input id="save-root" v-model="draft.gameSession.saveRootPath" class="field-control"></div>
              <div class="field-row"><label class="field-label" for="autosave-count">Autosave interval<span class="field-help">Moves between automatic snapshots; 0 disables</span></label><input id="autosave-count" v-model.number="draft.gameSession.autosaveAfterMoveCount" class="field-control" type="number" min="0"></div>
              <div class="field-row"><span class="field-label">Save on close</span><label class="toggle-row"><input v-model="draft.gameSession.autosaveOnClose" aria-label="Save on close" type="checkbox" :disabled="draft.gameSession.restorePreviousSession"><span class="toggle-track"></span><span>{{ draft.gameSession.autosaveOnClose ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
          </template>
          <template v-else-if="category === SettingsCategory.Gameplay">
            <section class="form-section"><h3 class="form-section__heading">Quick game defaults</h3><p class="form-section__description">Used by the one-click Quick game action.</p>
              <div class="field-row"><label class="field-label" for="quick-name">Game name</label><input id="quick-name" v-model="draft.gameDefaults.quickNewGameName" class="field-control"></div>
              <div class="field-row"><label class="field-label" for="white-default">White player</label><select id="white-default" v-model="draft.gameDefaults.defaultWhitePlayerType" class="field-control"><option :value="PlayerType.Local">Local</option><option :value="PlayerType.Engine">Engine</option></select></div>
              <div class="field-row"><label class="field-label" for="black-default">Black player</label><select id="black-default" v-model="draft.gameDefaults.defaultBlackPlayerType" class="field-control"><option :value="PlayerType.Local">Local</option><option :value="PlayerType.Engine">Engine</option></select></div>
              <div class="field-row"><label class="field-label" for="clock-preset">Clock preset</label><select id="clock-preset" v-model="draft.gameDefaults.defaultTimeControl.preset" class="field-control"><option :value="TimeControlPreset.Untimed">Untimed</option><option :value="TimeControlPreset.Bullet">Bullet</option><option :value="TimeControlPreset.Blitz">Blitz</option><option :value="TimeControlPreset.Rapid">Rapid</option><option :value="TimeControlPreset.Classical">Classical</option></select></div>
              <div v-if="draft.gameDefaults.defaultTimeControl.preset !== TimeControlPreset.Untimed" class="field-row"><label class="field-label" for="initial-time">Initial time (milliseconds)</label><input id="initial-time" v-model.number="draft.gameDefaults.defaultTimeControl.initialMs" class="field-control" type="number" min="1000" step="1000"></div>
              <div class="field-row"><label class="field-label" for="increment">Increment (milliseconds)</label><input id="increment" v-model.number="draft.gameDefaults.defaultTimeControl.incrementMs" class="field-control" type="number" min="0" step="1000"></div>
            </section>
            <section class="form-section"><h3 class="form-section__heading">Move behaviour</h3>
              <div class="field-row"><label class="field-label" for="branch-exit">After exploring history<span class="field-help">Where the board settles after an analysis move</span></label><select id="branch-exit" v-model="draft.gameplay.analysisBranchExitBehaviour" class="field-control"><option :value="AnalysisBranchExitBehaviour.ReturnToLiveNode">Return to live position</option><option :value="AnalysisBranchExitBehaviour.StayOnBranch">Stay on analysis branch</option></select></div>
            </section>
          </template>
          <template v-else-if="category === SettingsCategory.Appearance">
            <section class="form-section"><h3 class="form-section__heading">Theme</h3><p class="form-section__description">Choose how the app chrome responds to your desktop.</p>
              <div class="theme-picker"><label v-for="theme in [ThemeMode.System, ThemeMode.Light, ThemeMode.Dark]" :key="theme" :class="{ active: draft.appearance.themeMode === theme }"><input v-model="draft.appearance.themeMode" type="radio" :value="theme"><span class="theme-preview" :style="themePreviewStyle(theme)"><i></i><b></b><em></em></span><strong>{{ theme }}</strong></label></div>
            </section>
            <section class="form-section"><h3 class="form-section__heading">Board</h3>
              <div class="field-row"><label class="field-label" for="orientation">Orientation</label><select id="orientation" v-model="draft.appearance.boardOrientation" class="field-control"><option :value="BoardOrientation.White">White at bottom</option><option :value="BoardOrientation.Black">Black at bottom</option></select></div>
              <div class="field-row"><span class="field-label">Coordinates</span><label class="toggle-row"><input v-model="draft.appearance.showCoordinates" aria-label="Coordinates" type="checkbox"><span class="toggle-track"></span><span>{{ draft.appearance.showCoordinates ? 'Shown' : 'Hidden' }}</span></label></div>
              <div class="field-row"><span class="field-label">Last move highlight</span><label class="toggle-row"><input v-model="draft.appearance.highlightLastMove" aria-label="Last move highlight" type="checkbox"><span class="toggle-track"></span><span>{{ draft.appearance.highlightLastMove ? 'Shown' : 'Hidden' }}</span></label></div>
            </section>
            <section class="form-section"><h3 class="form-section__heading">Interface scale</h3>
              <div class="scale-control"><input v-model.number="draft.appearance.uiScalePercent" aria-label="Interface scale" type="range" min="75" max="150" step="5"><strong>{{ draft.appearance.uiScalePercent }}%</strong></div>
            </section>
          </template>
          <template v-else>
            <section class="form-section"><h3 class="form-section__heading">Analysis behaviour</h3>
              <div class="field-row"><span class="field-label">Resume after restore<span class="field-help">Restart assigned analysis engines with the session</span></span><label class="toggle-row"><input v-model="draft.analysis.resumeLiveAnalysisAfterRestore" aria-label="Resume after restore" type="checkbox"><span class="toggle-track"></span><span>{{ draft.analysis.resumeLiveAnalysisAfterRestore ? 'Enabled' : 'Disabled' }}</span></label></div>
            </section>
            <section class="form-section"><div class="engine-heading"><div><h3 class="form-section__heading">Engine profiles</h3><p class="form-section__description">Reusable UCI engine configurations.</p></div><button class="text-button text-button--primary" @click="openEngineEditor()"><AppIcon name="plus" />Add engine</button></div>
              <div v-if="draft.analysis.engineInventory.length" class="engine-list">
                <article v-for="(engine, index) in draft.analysis.engineInventory" :key="engine.id"><span class="engine-list__mark">♞</span><div><strong>{{ engine.displayName }}</strong><small>{{ engine.executablePath || 'No engine location selected' }}</small></div><span class="engine-list__protocol">UCI</span><button class="icon-button" title="Copy" @click="copyEngine(engine)"><AppIcon name="copy" /></button><button class="icon-button" title="Edit" @click="openEngineEditor(engine, index)"><AppIcon name="edit" /></button><button class="icon-button icon-button--danger" title="Delete" @click="removeEngine(index)"><AppIcon name="trash" /></button></article>
              </div>
              <div v-else class="empty-state engine-empty"><AppIcon name="activity" /><strong>No engines configured</strong><span>Add a UCI engine to use computer opponents and live analysis.</span></div>
            </section>
          </template>
        </div>
        <footer class="settings-actions"><span v-if="errorMessage" class="settings-feedback settings-feedback--error">{{ errorMessage }}</span><span v-else-if="successMessage" class="settings-feedback">{{ successMessage }}</span><button class="text-button text-button--ghost" @click="requestReturn">Cancel</button><button class="text-button" :disabled="!settingsStore.hasPendingChanges" @click="applySettings(true)">Save</button><button class="text-button text-button--primary" :disabled="!settingsStore.hasPendingChanges" @click="applySettings(false)">Apply changes</button></footer>
      </section>
    </div>
    <ModalDialog v-if="engineEditorOpen" :title="editingEngineIndex === undefined ? 'Add engine profile' : 'Edit engine profile'" subtitle="Configure a UCI engine and its launch options." wide @dismissed="engineEditorOpen = false">
      <section class="form-section"><h3 class="form-section__heading">General</h3><div class="field-row"><label class="field-label" for="engine-name">Display name</label><input id="engine-name" v-model="engineForm.displayName" class="field-control" autofocus></div><div class="field-row"><label class="field-label" for="engine-path">Engine location<span class="field-help">Desktop executable path or browser worker URL. Use stockfish.js for the bundled browser engine.</span></label><input id="engine-path" v-model="engineForm.executablePath" class="field-control" placeholder="stockfish.js or C:\Engines\stockfish.exe"></div><div class="field-row"><span class="field-label">Protocol</span><span class="read-only-value">Universal Chess Interface (UCI)</span></div></section>
      <section class="form-section"><div class="engine-heading"><div><h3 class="form-section__heading">Options</h3><p class="form-section__description">Name/value pairs sent when the engine starts.</p></div><button class="text-button" @click="addOption"><AppIcon name="plus" />Add option</button></div><div v-if="engineForm.options.length" class="option-list"><div v-for="(option, index) in engineForm.options" :key="index"><input v-model="option.name" class="field-control" placeholder="Option name"><input v-model="option.value" class="field-control" placeholder="Value"><button class="icon-button icon-button--danger" @click="engineForm.options.splice(index, 1)"><AppIcon name="trash" /></button></div></div><p v-else class="inline-message">No custom options. The engine will use its own defaults.</p></section>
      <p v-if="errorMessage" class="inline-message inline-message--error editor-error">{{ errorMessage }}</p>
      <template #actions><button class="text-button text-button--ghost" @click="engineEditorOpen = false">Cancel</button><button class="text-button text-button--primary" @click="saveEngine">Save profile</button></template>
    </ModalDialog>
  </main>
</template>

<style scoped>
.settings-layout { display: flex; min-width: 0; min-height: 0; padding: 1rem; flex: 1; }
.settings-content { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.settings-content__header { display: flex; min-height: 3.5rem; padding: 0 0 0.75rem; flex-shrink: 0; align-items: center; justify-content: space-between;  }
.settings-content__header .page-kicker { margin-bottom: 0; }
.settings-content__header h2 { margin: 0.08rem 0 0; font-family: var(--font-display); font-size: 1.7rem; text-transform: capitalize; }
.unsaved-badge { display: flex; padding: 0.3rem 0.55rem; align-items: center; gap: 0.35rem; color: var(--accent-strong); border-radius: 999rem; background: var(--accent-soft); font-size: 0.62rem; font-weight: 700; }
.unsaved-badge i { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); }
.settings-content__body { min-height: 0; padding: 0.75rem 0.25rem; flex: 1; overflow: auto; }
.settings-content__body > .form-section { max-width: 49rem; }
.toggle-row > span:last-child { color: var(--text-muted); font-size: 0.76rem; }
.settings-actions { display: flex; padding: 0.75rem 0 0; flex-shrink: 0; align-items: center; justify-content: flex-end; gap: 0.5rem;  background: var(--surface-app); }
.settings-feedback { margin-right: auto; color: var(--success-strong); font-size: 0.72rem; }
.settings-feedback--error { color: var(--danger); }
.theme-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; }
.theme-picker label { display: grid; padding: 0.45rem; gap: 0.4rem; color: var(--text-muted); border: 0; border-radius: var(--radius-sm); cursor: pointer; text-transform: capitalize; }
.theme-picker label.active { color: var(--accent-strong); border-color: var(--accent); background: var(--accent-soft); }
.theme-picker label:has(input:focus-visible) { outline: 0.125rem solid var(--focus-ring); outline-offset: 0.125rem; }
.theme-picker input { position: absolute; opacity: 0; }
.theme-picker strong { padding: 0.1rem 0.25rem; font-size: 0.7rem; }
.theme-preview { display: grid; height: 3rem; padding: 0.45rem; grid-template-columns: 1fr 2fr; grid-template-rows: 0.55rem 1fr; gap: 0.28rem; border-radius: 0.3rem; background: var(--preview-app); }
.theme-preview i { grid-column: 1 / -1; border-radius: 0.15rem; background: var(--preview-accent); }
.theme-preview b { grid-row: 2; border-radius: 0.15rem; background: var(--preview-border); }
.theme-preview em { grid-row: 2; border-radius: 0.15rem; background: var(--preview-dialog); }
.scale-control { display: flex; align-items: center; gap: 1rem; }.scale-control input { width: min(28rem, 100%); accent-color: var(--accent); }.scale-control strong { min-width: 3.5rem; font-variant-numeric: tabular-nums; }
.engine-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }.engine-heading .form-section__description { margin: 0.15rem 0 0; }
.engine-list { display: grid; border: 0; border-radius: var(--radius-sm); overflow: hidden; }
.engine-list article { display: grid; min-height: 3.8rem; padding: 0.55rem 0.65rem; grid-template-columns: auto minmax(0, 1fr) auto auto auto auto; align-items: center; gap: 0.5rem; background: var(--surface-dialog); }
.engine-list article + article {  }
.engine-list__mark { display: grid; width: 2.35rem; height: 2.35rem; place-items: center; color: var(--surface-panel); border-radius: 50%; background: var(--text-primary); font-family: var(--font-display); font-size: 1.4rem; }
.engine-list article div { min-width: 0; }.engine-list article strong, .engine-list article small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.engine-list article strong { font-size: 0.76rem; }.engine-list article small { color: var(--text-muted); font-size: 0.62rem; }
.engine-list__protocol { padding: 0.2rem 0.4rem; color: var(--text-muted); border-radius: 0.25rem; background: var(--surface-app); font-size: 0.55rem; font-weight: 800; }
.engine-empty { box-shadow: none; }.engine-empty > span { font-size: 0.72rem; }
.read-only-value { padding: 0.55rem 0; color: var(--text-muted); font-size: 0.78rem; }
.option-list { display: grid; gap: 0.4rem; }.option-list > div { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 0.4rem; }.editor-error { margin-top: 1rem; }
@media (max-width: 760px) {
  .settings-layout { padding: 0.75rem; }
  .theme-preview { display: none; }
  .settings-actions { gap: 0.25rem; }
  .settings-actions .text-button { padding: 0.5rem; font-size: 0.7rem; }
  .settings-feedback { font-size: 0.6rem; }
  .engine-list article { grid-template-columns: minmax(0, 1fr) auto auto auto; padding: 0.35rem 0; gap: 0.25rem; }
  .engine-list__mark, .engine-list__protocol { display: none; }
}
</style>

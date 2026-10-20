<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AppModalKind, PlatformErrorKind, type IGame } from '@/contracts';
import type { ISavedGameFileEntry, ISavedGameGroup } from '@/contracts/domain';
import { SaveGameTargetKind } from '@/contracts/state';
import { SavedGameIndexService } from '@/domain';
import { useGamesStore, useSavedGamesStore, useUiStateStore } from '@/state';
import NavigationFrame from '@/components/NavigationFrame.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ModalDialog from '@/components/common/ModalDialog.vue';
import { OperationOwner } from '@/utility/async/OperationOwner';
import { abortable } from '@/utility/async/Abortable';

const route = useRoute();
const router = useRouter();
const gamesStore = useGamesStore();
const savedGamesStore = useSavedGamesStore();
const uiStateStore = useUiStateStore();
const groups = ref<ISavedGameGroup[]>([]);
const gameNames = ref(new Map<string, string>());
const selectedGameId = ref('');
const selectedSaveName = ref('');
const selectedDocument = shallowRef<IGame>();
const detailError = ref('');
const details = new OperationOwner();
const saveName = ref('');
const isLoading = ref(true);
const isWorking = ref(false);
const message = ref('');
const errorMessage = ref('');
const deleteTarget = ref<ISavedGameFileEntry>();
const overwriteTarget = ref<{ game: IGame; saveName: string }>();
const isSaveMode = computed(() => route.name === 'save-game');
const isDetailMode = computed(() => route.name === 'load-game' || isSaveMode.value);
const routeGameId = computed(() => String(route.params.name ?? ''));
const activeGame = computed(() => gamesStore.getGame(routeGameId.value) as unknown as IGame | undefined);
const selectedGroup = computed(() => groups.value.find((group) => group.gameId === routeGameId.value));
const orderedSaves = computed(() => [...(selectedGroup.value?.saves ?? [])].sort((left, right) => Number(right.isAutosave) - Number(left.isAutosave)));
const selectedEntry = computed(() => selectedGroup.value?.saves.find((entry) => entry.saveName === selectedSaveName.value));
const saveNameError = computed(() => {
  const value = saveName.value.trim();
  if (!value) return 'Enter a save name.';
  if (value.toLowerCase() === 'auto') return '“auto” is reserved for automatic saves.';
  if (/[\\/:*?"<>|\x00-\x1f]/.test(value) || /[.]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) return 'Use a single, non-reserved file name without path characters.';
  return '';
});
const returnRoute = computed(() => uiStateStore.gameSession?.activeGameId ? `/game/${uiStateStore.gameSession.activeGameId}` : '/home');

onMounted(refreshGroups);
const removeRouteActivation = router.afterEach((to, _from, failure) => {
  if (failure || !['save-game', 'load-game', 'load-games'].includes(String(to.name))) return;
  overwriteTarget.value = undefined;
  initialiseRoute();
  refreshSelection();
});
onBeforeUnmount(() => { removeRouteActivation(); void details.dispose(); });
function loadDetails(entry?: ISavedGameFileEntry) {
  selectedDocument.value = undefined;
  detailError.value = '';
  return details.run(async (signal) => {
    if (!entry) return;
    try {
      const game = await abortable(savedGamesStore.loadGame(entry.gameId, entry.saveName), signal);
      signal.throwIfAborted();
      selectedDocument.value = game;
    } catch (error) {
      if (!signal.aborted) detailError.value = error instanceof Error ? error.message : 'This snapshot could not be read.';
    }
  });
}
function refreshSelection() {
  const group = selectedGroup.value;
  const entry = group?.saves.find((candidate) => candidate.saveName === selectedSaveName.value)
    ?? (group ? SavedGameIndexService.getLatestSaveEntry(group.saves) : undefined);
  selectedSaveName.value = entry?.saveName ?? '';
  void loadDetails(entry);
}
async function refreshGroups() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    groups.value = await savedGamesStore.listSavedGames();
    const entries = await Promise.all(groups.value.map(async (group) => {
      try {
        const game = await savedGamesStore.loadGame(group.gameId);
        return [group.gameId, game.metadata.name] as const;
      } catch {
        return [group.gameId, `Game ${group.gameId.slice(0, 8)}`] as const;
      }
    }));
    gameNames.value = new Map(entries);
  } catch (error) {
    groups.value = [];
    if (!String(error).includes('not found')) errorMessage.value = error instanceof Error ? error.message : 'Saved games could not be listed.';
  } finally {
    isLoading.value = false;
    initialiseRoute();
    refreshSelection();
  }
}
function initialiseRoute() {
  if (isSaveMode.value && activeGame.value && !saveName.value) saveName.value = activeGame.value.metadata.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Game';
  if (route.name === 'load-game') selectedGameId.value = routeGameId.value;
  else if (!isSaveMode.value && !groups.value.some((group) => group.gameId === selectedGameId.value)) selectedGameId.value = groups.value.find((group) => group.gameId === uiStateStore.gameSession?.activeGameId)?.gameId ?? groups.value[0]?.gameId ?? '';
}
function selectSave(entry: ISavedGameFileEntry) {
  selectedSaveName.value = entry.saveName;
  if (isSaveMode.value && !entry.isAutosave) saveName.value = entry.saveName;
  return loadDetails(entry);
}
async function loadGame(gameId: string, entryName?: string) {
  await run(async () => {
    const game = await savedGamesStore.loadGame(gameId, entryName);
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  });
}
async function saveGame() {
  const currentGame = activeGame.value;
  if (!currentGame || saveNameError.value || isLoading.value || isWorking.value || overwriteTarget.value) return;
  const target = { game: currentGame, saveName: saveName.value.trim() };
  await run(async () => {
    if (selectedGroup.value?.saves.some((entry) => entry.saveName === target.saveName)) {
      overwriteTarget.value = target;
      return;
    }
    try {
      await writeSave(target.game, target.saveName, false);
    } catch (error) {
      if (typeof error !== 'object' || error === null || !('kind' in error) || error.kind !== PlatformErrorKind.AlreadyExists) throw error;
      overwriteTarget.value = target;
    }
  });
}
async function writeSave(game: IGame, name: string, overwrite: boolean) {
  await savedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName: name, overwrite });
  message.value = `Saved “${name}”.`;
  await refreshGroups();
  selectedSaveName.value = name;
  refreshSelection();
}
async function confirmOverwrite() {
  const target = overwriteTarget.value;
  if (!target || isWorking.value) return;
  await run(() => writeSave(target.game, target.saveName, true));
  if (!errorMessage.value) overwriteTarget.value = undefined;
}
async function importGame() {
  await run(async () => {
    const game = await savedGamesStore.importGame();
    if (!game) return;
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  }, true);
}
async function exportCurrent() {
  if (!activeGame.value) return;
  await run(async () => {
    if (await savedGamesStore.exportGame(activeGame.value!)) message.value = 'Game exported.';
  });
}
async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  await run(async () => {
    deleteTarget.value = undefined;
    try {
      await savedGamesStore.deleteSave(target.gameId, target.saveName);
    } finally {
      await refreshGroups();
      if (route.name === 'load-game' && !groups.value.some((group) => group.gameId === routeGameId.value)) await router.replace('/saved-games/load');
    }
  });
}
async function run(action: () => Promise<void>, importAction: boolean = false) {
  isWorking.value = true;
  errorMessage.value = '';
  message.value = '';
  try {
    await action();
  } catch (error) {
    const text = error instanceof Error ? error.message : 'The action could not be completed.';
    if (importAction) uiStateStore.showModal({ kind: AppModalKind.ImportError, payload: { message: text } });
    else errorMessage.value = text;
  } finally {
    isWorking.value = false;
  }
}
function formatDate(entry: ISavedGameFileEntry): string {
  return entry.savedAtUtc?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? 'Date unavailable';
}
</script>

<template>
  <main class="saved-page page-shell app-page">
    <NavigationFrame>
      <template #brand><button class="app-brand" aria-label="ChessVue home" title="ChessVue home" @click="router.push(returnRoute)"><span class="app-brand__mark">♞</span><span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Game library</span></span></button></template>
      <nav class="library-tabs" aria-label="Library mode">
        <button class="menu-button" :class="{ active: !isSaveMode }" aria-label="Load" title="Load" @click="router.push('/saved-games/load')"><AppIcon name="folder" /><span>Load</span></button>
        <button class="menu-button" :class="{ active: isSaveMode }" :disabled="!uiStateStore.gameSession?.activeGameId" aria-label="Save" title="Save" @click="uiStateStore.gameSession?.activeGameId && router.push(`/saved-games/save/${uiStateStore.gameSession.activeGameId}`)"><AppIcon name="save" /><span>Save</span></button>
      </nav>
      <button class="menu-button" aria-label="Import file" title="Import file" @click="importGame"><AppIcon name="upload" /><span>Import file</span></button>
      <button v-if="isSaveMode" class="menu-button" :disabled="!activeGame" aria-label="Export" title="Export" @click="exportCurrent"><AppIcon name="download" /><span>Export</span></button>
      <template #footer><button class="menu-button" aria-label="Close" title="Close" @click="router.push(returnRoute)"><AppIcon name="x" /><span>Close</span></button></template>
    </NavigationFrame>
    <div class="library-shell">
      <section class="library-heading"><p class="page-kicker">Local library</p><h1 class="page-heading">{{ isSaveMode ? 'Save your game' : isDetailMode ? gameNames.get(routeGameId) ?? 'Saved game' : 'Saved games' }}</h1><p class="page-description">{{ isSaveMode ? 'Create a named snapshot of the current board.' : isDetailMode ? 'Choose a snapshot to return to.' : 'Every game and analysis study saved on this desktop.' }}</p></section>
      <section class="library-surface surface">
        <div v-if="!isLoading && isDetailMode && selectedGroup" class="snapshot-browser">
          <div class="save-list" aria-label="Saved snapshots">
            <template v-for="(entry, index) in orderedSaves" :key="entry.filePath">
              <div v-if="index > 0 && orderedSaves[index - 1]?.isAutosave && !entry.isAutosave" class="save-separator" role="separator">Named saves</div>
              <article class="save-row" :class="{ selected: entry.saveName === selectedSaveName }"><span class="save-row__icon"><AppIcon :name="entry.isAutosave ? 'clock' : 'save'" /></span><button class="save-row__content" :aria-pressed="entry.saveName === selectedSaveName" @click="selectSave(entry)" @dblclick="!isSaveMode && loadGame(entry.gameId, entry.saveName)"><strong>{{ entry.isAutosave ? 'Automatic save' : entry.saveName }}</strong><small>{{ formatDate(entry) }}</small></button><span v-if="entry.isAutosave" class="auto-badge">Auto</span><button class="icon-button icon-button--danger" title="Delete save" :disabled="isWorking" @click="deleteTarget = entry"><AppIcon name="trash" /></button><button v-if="!isSaveMode" class="text-button" :disabled="isWorking" @click="loadGame(entry.gameId, entry.saveName)">Load</button></article>
            </template>
          </div>
          <aside class="snapshot-details" aria-label="Selected save details"><h2>{{ selectedEntry?.isAutosave ? 'Automatic save' : selectedEntry?.saveName }}</h2><p v-if="detailError" class="library-feedback--error">{{ detailError }}</p><template v-else-if="selectedDocument"><strong>{{ selectedDocument.metadata.name }}</strong><dl><dt>Saved</dt><dd>{{ selectedEntry && formatDate(selectedEntry) }}</dd><dt>Position</dt><dd>{{ selectedDocument.renderedPath.length }} plies</dd><dt>White</dt><dd>{{ selectedDocument.whitePlayer?.displayName ?? 'Unassigned' }}</dd><dt>Black</dt><dd>{{ selectedDocument.blackPlayer?.displayName ?? 'Unassigned' }}</dd><dt>Clock</dt><dd>{{ selectedDocument.timeControl.initialMs === undefined ? 'Untimed' : `${selectedDocument.timeControl.initialMs / 60000} minutes + ${selectedDocument.timeControl.incrementMs / 1000} seconds` }}</dd><dt>Result</dt><dd>{{ selectedDocument.resultState }}{{ selectedDocument.resultReason ? ` (${selectedDocument.resultReason})` : '' }}</dd></dl></template><p v-else>Reading snapshot…</p></aside>
        </div>
        <div v-if="isLoading" class="empty-state"><span class="library-spinner">♞</span><strong>Opening your library…</strong></div>
        <template v-else-if="isSaveMode">
          <div v-if="activeGame" class="save-layout">
            <div class="save-game-card"><span>♞</span><div><small>Current workspace</small><strong>{{ activeGame.metadata.name }}</strong><p>{{ activeGame.renderedPath.length }} moves · Updated {{ activeGame.metadata.updatedAt.toLocaleString() }}</p></div></div>
            <section class="form-section"><h2 class="form-section__heading">Named save</h2><p class="form-section__description">Use a short, recognisable name for this point in the game.</p><div class="field-row"><label class="field-label" for="save-name">Save name<span class="field-help">Stored as a JSON game document</span></label><div><input id="save-name" v-model="saveName" class="field-control" autofocus @keydown.enter="saveGame"><p v-if="saveNameError" class="field-error">{{ saveNameError }}</p></div></div></section>
          </div>
          <div v-else class="empty-state"><AppIcon name="info" /><strong>No active game</strong><span>Open a game before creating a save.</span></div>
        </template>
        <template v-else-if="route.name === 'load-game'">
          <div v-if="!selectedGroup" class="empty-state"><AppIcon name="folder" /><strong>Saved game not found</strong><span>This game may have been moved or deleted.</span></div>
        </template>
        <template v-else>
          <div v-if="groups.length" class="game-list">
            <button v-for="group in groups" :key="group.gameId" class="game-row" :class="{ selected: selectedGameId === group.gameId }" @click="selectedGameId = group.gameId" @dblclick="loadGame(group.gameId)"><span class="game-row__piece">♟</span><span class="game-row__copy"><strong>{{ gameNames.get(group.gameId) ?? `Game ${group.gameId.slice(0, 8)}` }}</strong><small>{{ group.saves.length }} {{ group.saves.length === 1 ? 'snapshot' : 'snapshots' }} · {{ formatDate(group.saves[0]!) }}</small></span><span class="game-row__latest">{{ group.saves[0]?.isAutosave ? 'Autosaved' : 'Saved' }}</span><AppIcon name="chevron-right" /></button>
          </div>
          <div v-else class="empty-state library-empty"><AppIcon name="folder" /><strong>No saved games yet</strong><span>Your named saves and automatic snapshots will appear here.</span><button class="text-button text-button--primary" @click="router.push(returnRoute)">Return to your board</button></div>
        </template>
        <footer class="library-actions"><span v-if="errorMessage" class="library-feedback library-feedback--error">{{ errorMessage }}</span><span v-else-if="message" class="library-feedback">{{ message }}</span><span v-else class="library-count">{{ groups.length }} {{ groups.length === 1 ? 'game' : 'games' }} in library</span><button class="text-button text-button--ghost" @click="router.push(returnRoute)">Cancel</button><button v-if="isSaveMode" class="text-button text-button--primary" :disabled="!!saveNameError || !activeGame || isWorking" @click="saveGame"><AppIcon name="save" />Save game</button><button v-else-if="route.name === 'load-game'" class="text-button text-button--primary" :disabled="!selectedEntry || isWorking" @click="selectedEntry && loadGame(selectedEntry.gameId, selectedEntry.saveName)">Load selected</button><button v-else class="text-button text-button--primary" :disabled="!selectedGameId || isWorking" @click="selectedGameId && router.push(`/saved-games/load/${selectedGameId}`)">Select game<AppIcon name="arrow-right" /></button></footer>
      </section>
    </div>
    <ModalDialog v-if="deleteTarget" title="Delete this save?" :subtitle="`“${deleteTarget.saveName}” will be permanently removed from this game.`" @dismissed="deleteTarget = undefined"><p class="delete-warning">Other snapshots of this game will not be affected.</p><template #actions><button class="text-button text-button--ghost" @click="deleteTarget = undefined">Cancel</button><button class="text-button text-button--danger" @click="confirmDelete">Delete save</button></template></ModalDialog>
    <ModalDialog v-if="overwriteTarget" title="Replace this save?" :subtitle="`“${overwriteTarget.saveName}” already exists for this game.`" :dismissible="!isWorking" @dismissed="overwriteTarget = undefined"><p class="delete-warning">Replacing it will overwrite the existing snapshot with the current game.</p><p v-if="errorMessage" class="library-feedback--error" role="alert">{{ errorMessage }}</p><template #actions><button class="text-button text-button--ghost" :disabled="isWorking" @click="overwriteTarget = undefined">Cancel</button><button class="text-button text-button--danger" :disabled="isWorking" @click="confirmOverwrite">Replace save</button></template></ModalDialog>
  </main>
</template>

<style scoped>
.library-shell { display: flex; min-width: 0; min-height: 0; padding: 1rem; flex: 1; flex-direction: column; gap: 0.75rem; }
.library-heading { min-width: 0; flex-shrink: 0; }
.library-heading .page-kicker { margin-bottom: 0.25rem; }
.library-heading .page-heading { font-size: clamp(1.3rem, 2.5vw, 2rem); overflow-wrap: anywhere; }
.library-heading .page-description { margin-top: 0.35rem; font-size: 0.78rem; }
.library-surface { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.library-surface > .empty-state { min-height: 0; flex: 1; }
.library-spinner { color: var(--accent); font-size: 3rem; }
.snapshot-browser { display: flex; min-height: 0; flex: 1; gap: 1rem; }
.snapshot-browser .save-list { flex: 1.5; }
.snapshot-details { min-width: 0; min-height: 0; padding: 0.5rem; flex: 1; overflow: auto; font-size: 0.75rem; overflow-wrap: anywhere; }
.snapshot-details h2 { margin: 0 0 0.5rem; font-size: 1rem; }
.snapshot-details dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.5rem 0.8rem; }
.snapshot-details dt { color: var(--text-muted); }
.snapshot-details dd { margin: 0; overflow-wrap: anywhere; }
.game-list, .save-list { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: auto; }
.save-separator { padding: 0.5rem; color: var(--text-muted); font-size: 0.65rem; }
.game-row { display: flex; min-width: 0; min-height: 4rem; padding: 0.5rem; flex-shrink: 0; align-items: center; gap: 0.75rem; background: transparent; text-align: left; }
.game-row:hover, .game-row.selected, .save-row.selected { background: var(--accent-soft); }
.game-row__piece { display: grid; width: 2.5rem; height: 2.5rem; flex-shrink: 0; place-items: center; color: var(--accent-strong); font-size: 1.7rem; }
.game-row__copy { min-width: 0; flex: 1; }
.game-row__copy strong, .game-row__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.game-row__copy strong { font-size: 0.9rem; }
.game-row__copy small { color: var(--text-muted); font-size: 0.65rem; }
.game-row__latest { color: var(--text-muted); font-size: 0.6rem; }
.save-row { display: flex; min-height: 3.5rem; padding: 0.4rem; flex-shrink: 0; align-items: center; gap: 0.5rem; }
.save-row__icon { color: var(--accent); }
.save-row__content { display: grid; min-width: 0; padding: 0; flex: 1; background: transparent; text-align: left; overflow-wrap: anywhere; }
.save-row__content strong { font-size: 0.75rem; }
.save-row__content small { color: var(--text-muted); font-size: 0.6rem; }
.auto-badge { color: var(--accent-strong); font-size: 0.55rem; }
.library-actions { display: flex; padding: 0.5rem 0 0; flex-shrink: 0; align-items: center; justify-content: flex-end; gap: 0.5rem; }
.library-count, .library-feedback { min-width: 0; margin-right: auto; color: var(--text-muted); font-size: 0.66rem; overflow-wrap: anywhere; }
.library-feedback { color: var(--success-strong); }
.library-feedback--error { color: var(--danger); }
.save-layout { display: grid; padding: 0.75rem 0; flex-shrink: 0; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); align-items: center; gap: 1rem; }
.save-game-card { display: flex; min-width: 0; align-items: center; gap: 0.5rem; }
.save-game-card > span { color: var(--accent-strong); font-size: 2rem; }
.save-game-card div { display: grid; min-width: 0; }
.save-game-card small { color: var(--accent); font-size: 0.6rem; }
.save-game-card strong { overflow: hidden; font-size: 0.9rem; text-overflow: ellipsis; white-space: nowrap; }
.save-game-card p { margin: 0; color: var(--text-muted); font-size: 0.6rem; }
.save-layout .form-section { gap: 0.5rem; }
.save-layout .form-section__heading { font-size: 1rem; }
.save-layout .form-section__description { margin: 0; font-size: 0.7rem; }
.save-layout .field-row { gap: 0.5rem; }
.field-error { margin: 0.25rem 0 0; color: var(--danger); font-size: 0.65rem; }
.delete-warning { margin: 0; color: var(--text-muted); font-size: 0.8rem; }
@media (max-width: 760px) {
  .library-shell { padding: 0.75rem; gap: 0.5rem; }
  .snapshot-browser { flex-direction: column; gap: 0.25rem; }
  .snapshot-details { flex: 0 1 35%; padding: 0.25rem; }
  .save-row__icon, .auto-badge, .game-row__latest, .library-count { display: none; }
  .save-row { gap: 0.25rem; }
  .save-row .text-button { min-height: 2rem; padding: 0.3rem 0.5rem; font-size: 0.7rem; }
  .save-layout { grid-template-columns: 1fr; }
  .save-game-card { display: none; }
  .save-layout .form-section__description { display: none; }
}
</style>

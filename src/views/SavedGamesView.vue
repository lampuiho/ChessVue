<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PlatformErrorKind, type IGame } from '@/contracts';
import type { ISavedGameFileEntry, ISavedGameGroup } from '@/contracts/domain';
import { SaveGameTargetKind } from '@/contracts/state';
import { SavedGameIndexService } from '@/domain';
import { useGamesStore, useSavedGamesStore, useUiStateStore } from '@/state';
import { useModal, type IModalHandle } from '@/composables/ModalComposable';
import MessageModal from '@/components/modals/MessageModal.vue';
import NavigationFrame from '@/components/NavigationFrame.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import ConfirmationModal from '@/components/modals/ConfirmationModal.vue';
import { OperationOwner } from '@/utility/async/OperationOwner';
import { abortable } from '@/utility/async/Abortable';

const modal = useModal();
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
let confirmation: IModalHandle | undefined;
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

onMounted(_refreshGroups);
const removeRouteActivation = router.afterEach((to, _from, failure) => {
  if (failure || !['save-game', 'load-game', 'load-games'].includes(String(to.name))) return;
  _closeConfirmation();
  _initialiseRoute();
  _refreshSelection();
});
onBeforeUnmount(() => { _closeConfirmation(); removeRouteActivation(); void details.dispose(); });
function _loadDetails(entry?: ISavedGameFileEntry) {
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
function _refreshSelection() {
  const group = selectedGroup.value;
  const entry = group?.saves.find((candidate) => candidate.saveName === selectedSaveName.value)
    ?? (group ? SavedGameIndexService.getLatestSaveEntry(group.saves) : undefined);
  selectedSaveName.value = entry?.saveName ?? '';
  void _loadDetails(entry);
}
async function _refreshGroups() {
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
    _initialiseRoute();
    _refreshSelection();
  }
}
function _initialiseRoute() {
  if (isSaveMode.value && activeGame.value && !saveName.value) saveName.value = activeGame.value.metadata.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Game';
  if (route.name === 'load-game') selectedGameId.value = routeGameId.value;
  else if (!isSaveMode.value && !groups.value.some((group) => group.gameId === selectedGameId.value)) selectedGameId.value = groups.value.find((group) => group.gameId === uiStateStore.gameSession?.activeGameId)?.gameId ?? groups.value[0]?.gameId ?? '';
}
function _selectSave(entry: ISavedGameFileEntry) {
  selectedSaveName.value = entry.saveName;
  if (isSaveMode.value && !entry.isAutosave) saveName.value = entry.saveName;
  return _loadDetails(entry);
}
async function _loadGame(gameId: string, entryName?: string) {
  await _run(async () => {
    const game = await savedGamesStore.loadGame(gameId, entryName);
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  });
}
async function _saveGame() {
  const currentGame = activeGame.value;
  if (!currentGame || saveNameError.value || isLoading.value || isWorking.value || (confirmation && !confirmation.signal.aborted)) return;
  const target = { game: currentGame, saveName: saveName.value.trim() };
  await _run(async () => {
    if (selectedGroup.value?.saves.some((entry) => entry.saveName === target.saveName)) {
      _requestOverwrite(target);
      return;
    }
    try {
      await _writeSave(target.game, target.saveName, false);
    } catch (error) {
      if (typeof error !== 'object' || error === null || !('kind' in error) || error.kind !== PlatformErrorKind.AlreadyExists) throw error;
      _requestOverwrite(target);
    }
  });
}
async function _writeSave(game: IGame, name: string, overwrite: boolean, signal?: AbortSignal) {
  await savedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName: name, overwrite });
  if (signal?.aborted) return;
  message.value = `Saved “${name}”.`;
  await _refreshGroups();
  if (signal?.aborted) return;
  selectedSaveName.value = name;
  _refreshSelection();
}
function _closeConfirmation() {
  const current = confirmation;
  confirmation = undefined;
  void current?.close();
}
function _requestOverwrite(target: { game: IGame; saveName: string }) {
  confirmation = modal.open(ConfirmationModal, {
    title: 'Replace this save?', subtitle: `“${target.saveName}” already exists for this game.`,
    message: 'Replacing it will overwrite the existing snapshot with the current game.', confirmLabel: 'Replace save', danger: true,
    dismissibleWhileWorking: false, confirm: (signal) => _confirmOverwrite(target, signal),
  });
}
async function _confirmOverwrite(target: { game: IGame; saveName: string }, signal: AbortSignal) {
  if (signal.aborted || isWorking.value) return;
  isWorking.value = true;
  errorMessage.value = '';
  message.value = '';
  try { await _writeSave(target.game, target.saveName, true, signal); } catch (error) {
    if (!signal.aborted) errorMessage.value = error instanceof Error ? error.message : 'The action could not be completed.';
    throw error;
  } finally { isWorking.value = false; }
}
async function _importGame() {
  await _run(async () => {
    const game = await savedGamesStore.importGame();
    if (!game) return;
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  }, true);
}
async function _exportCurrent() {
  if (!activeGame.value) return;
  await _run(async () => {
    if (await savedGamesStore.exportGame(activeGame.value!)) message.value = 'Game exported.';
  });
}
function _requestDelete(target: ISavedGameFileEntry) {
  confirmation = modal.open(ConfirmationModal, {
    title: 'Delete this save?', subtitle: `“${target.saveName}” will be permanently removed from this game.`,
    message: 'Other snapshots of this game will not be affected.', confirmLabel: 'Delete save', danger: true,
    confirm: (signal) => _confirmDelete(target, signal),
  });
}
async function _confirmDelete(target: ISavedGameFileEntry, signal: AbortSignal) {
  signal.throwIfAborted();
  await _run(async () => {
    try { await savedGamesStore.deleteSave(target.gameId, target.saveName); } finally {
      if (!signal.aborted) {
        await _refreshGroups();
        if (!signal.aborted && route.name === 'load-game' && !groups.value.some((group) => group.gameId === routeGameId.value)) await router.replace('/saved-games/load');
      }
    }
  });
}
async function _run(action: () => Promise<void>, importAction: boolean = false) {
  isWorking.value = true;
  errorMessage.value = '';
  message.value = '';
  try {
    await action();
  } catch (error) {
    const text = error instanceof Error ? error.message : 'The action could not be completed.';
    if (importAction) modal.open(MessageModal, { title: 'Could not import game', subtitle: 'The selected document is unsupported or incomplete.', message: text, error: true });
    else errorMessage.value = text;
  } finally {
    isWorking.value = false;
  }
}
function _formatDate(entry: ISavedGameFileEntry): string {
  return entry.savedAtUtc?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? 'Date unavailable';
}
</script>

<template>
  <main class="saved-page page-shell app-page">
    <NavigationFrame>
      <template #brand><button class="app-brand" aria-label="ChessVue home" title="ChessVue home" @click="router.push(returnRoute)"><span class="app-brand__mark">♞</span><span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Game library</span></span></button></template>
      <nav class="navigation-group" aria-label="Library mode">
        <button class="menu-button" :class="{ active: !isSaveMode }" aria-label="Load" title="Load" @click="router.push('/saved-games/load')"><AppIcon name="folder" /><span>Load</span></button>
        <button class="menu-button" :class="{ active: isSaveMode }" :disabled="!uiStateStore.gameSession?.activeGameId" aria-label="Save" title="Save" @click="uiStateStore.gameSession?.activeGameId && router.push(`/saved-games/save/${uiStateStore.gameSession.activeGameId}`)"><AppIcon name="save" /><span>Save</span></button>
      </nav>
      <button class="menu-button" aria-label="Import file" title="Import file" @click="_importGame"><AppIcon name="upload" /><span>Import file</span></button>
      <button v-if="isSaveMode" class="menu-button" :disabled="!activeGame" aria-label="Export" title="Export" @click="_exportCurrent"><AppIcon name="download" /><span>Export</span></button>
      <template #footer><button class="menu-button" aria-label="Close" title="Close" @click="router.push(returnRoute)"><AppIcon name="x" /><span>Close</span></button></template>
    </NavigationFrame>
    <div class="library-shell">
      <section class="library-heading"><p class="page-kicker page-kicker--compact">Local library</p><h1 class="page-heading page-heading--library">{{ isSaveMode ? 'Save your game' : isDetailMode ? gameNames.get(routeGameId) ?? 'Saved game' : 'Saved games' }}</h1><p class="page-description page-description--library">{{ isSaveMode ? 'Create a named snapshot of the current board.' : isDetailMode ? 'Choose a snapshot to return to.' : 'Every game and analysis study saved on this desktop.' }}</p></section>
      <section class="library-surface surface">
        <div v-if="!isLoading && isDetailMode && selectedGroup" class="snapshot-browser">
          <div class="save-list" aria-label="Saved snapshots">
            <template v-for="(entry, index) in orderedSaves" :key="entry.filePath">
              <div v-if="index > 0 && orderedSaves[index - 1]?.isAutosave && !entry.isAutosave" class="save-separator" role="separator">Named saves</div>
              <article class="save-row" :class="{ selected: entry.saveName === selectedSaveName }"><span class="save-row__icon"><AppIcon :name="entry.isAutosave ? 'clock' : 'save'" /></span><button class="save-row__content" :aria-pressed="entry.saveName === selectedSaveName" @click="_selectSave(entry)" @dblclick="!isSaveMode && _loadGame(entry.gameId, entry.saveName)"><strong>{{ entry.isAutosave ? 'Automatic save' : entry.saveName }}</strong><small>{{ _formatDate(entry) }}</small></button><span v-if="entry.isAutosave" class="auto-badge">Auto</span><button class="icon-button icon-button--danger" title="Delete save" :disabled="isWorking" @click="_requestDelete(entry)"><AppIcon name="trash" /></button><button v-if="!isSaveMode" class="text-button text-button--compact-mobile" :disabled="isWorking" @click="_loadGame(entry.gameId, entry.saveName)">Load</button></article>
            </template>
          </div>
          <aside class="snapshot-details" aria-label="Selected save details"><h2>{{ selectedEntry?.isAutosave ? 'Automatic save' : selectedEntry?.saveName }}</h2><p v-if="detailError" class="library-feedback--error">{{ detailError }}</p><template v-else-if="selectedDocument"><strong>{{ selectedDocument.metadata.name }}</strong><dl><dt>Saved</dt><dd>{{ selectedEntry && _formatDate(selectedEntry) }}</dd><dt>Position</dt><dd>{{ selectedDocument.renderedPath.length }} plies</dd><dt>White</dt><dd>{{ selectedDocument.whitePlayer?.displayName ?? 'Unassigned' }}</dd><dt>Black</dt><dd>{{ selectedDocument.blackPlayer?.displayName ?? 'Unassigned' }}</dd><dt>Clock</dt><dd>{{ selectedDocument.timeControl.initialMs === undefined ? 'Untimed' : `${selectedDocument.timeControl.initialMs / 60000} minutes + ${selectedDocument.timeControl.incrementMs / 1000} seconds` }}</dd><dt>Result</dt><dd>{{ selectedDocument.resultState }}{{ selectedDocument.resultReason ? ` (${selectedDocument.resultReason})` : '' }}</dd></dl></template><p v-else>Reading snapshot…</p></aside>
        </div>
        <div v-if="isLoading" class="empty-state empty-state--fill"><span class="library-spinner">♞</span><strong>Opening your library…</strong></div>
        <template v-else-if="isSaveMode">
          <div v-if="activeGame" class="save-layout">
            <div class="save-game-card"><span>♞</span><div><small>Current workspace</small><strong>{{ activeGame.metadata.name }}</strong><p>{{ activeGame.renderedPath.length }} moves · Updated {{ activeGame.metadata.updatedAt.toLocaleString() }}</p></div></div>
            <section class="form-section form-section--compact"><h2 class="form-section__heading">Named save</h2><p class="form-section__description form-section__description--desktop">Use a short, recognisable name for this point in the game.</p><div class="field-row"><label class="field-label" for="save-name">Save name<span class="field-help">Stored as a JSON game document</span></label><div><input id="save-name" v-model="saveName" class="field-control" autofocus @keydown.enter="_saveGame"><p v-if="saveNameError" class="field-error">{{ saveNameError }}</p></div></div></section>
          </div>
          <div v-else class="empty-state empty-state--fill"><AppIcon name="info" /><strong>No active game</strong><span>Open a game before creating a save.</span></div>
        </template>
        <template v-else-if="route.name === 'load-game'">
          <div v-if="!selectedGroup" class="empty-state empty-state--fill"><AppIcon name="folder" /><strong>Saved game not found</strong><span>This game may have been moved or deleted.</span></div>
        </template>
        <template v-else>
          <div v-if="groups.length" class="game-list">
            <button v-for="group in groups" :key="group.gameId" class="game-row" :class="{ selected: selectedGameId === group.gameId }" @click="selectedGameId = group.gameId" @dblclick="_loadGame(group.gameId)"><span class="game-row__piece">♟</span><span class="game-row__copy"><strong>{{ gameNames.get(group.gameId) ?? `Game ${group.gameId.slice(0, 8)}` }}</strong><small>{{ group.saves.length }} {{ group.saves.length === 1 ? 'snapshot' : 'snapshots' }} · {{ _formatDate(group.saves[0]!) }}</small></span><span class="game-row__latest">{{ group.saves[0]?.isAutosave ? 'Autosaved' : 'Saved' }}</span><AppIcon name="chevron-right" /></button>
          </div>
          <div v-else class="empty-state empty-state--fill library-empty"><AppIcon name="folder" /><strong>No saved games yet</strong><span>Your named saves and automatic snapshots will appear here.</span><button class="text-button text-button--primary" @click="router.push(returnRoute)">Return to your board</button></div>
        </template>
        <footer class="library-actions"><span v-if="errorMessage" class="library-feedback library-feedback--error">{{ errorMessage }}</span><span v-else-if="message" class="library-feedback">{{ message }}</span><span v-else class="library-count">{{ groups.length }} {{ groups.length === 1 ? 'game' : 'games' }} in library</span><button class="text-button text-button--ghost" @click="router.push(returnRoute)">Cancel</button><button v-if="isSaveMode" class="text-button text-button--primary" :disabled="!!saveNameError || !activeGame || isWorking" @click="_saveGame"><AppIcon name="save" />Save game</button><button v-else-if="route.name === 'load-game'" class="text-button text-button--primary" :disabled="!selectedEntry || isWorking" @click="selectedEntry && _loadGame(selectedEntry.gameId, selectedEntry.saveName)">Load selected</button><button v-else class="text-button text-button--primary" :disabled="!selectedGameId || isWorking" @click="selectedGameId && router.push(`/saved-games/load/${selectedGameId}`)">Select game<AppIcon name="arrow-right" /></button></footer>
      </section>
    </div>
  </main>
</template>


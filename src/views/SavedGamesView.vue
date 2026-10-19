<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AppModalKind, PlatformErrorKind, type IGame } from '@/contracts';
import type { ISavedGameFileEntry, ISavedGameGroup } from '@/contracts/domain';
import { SaveGameTargetKind } from '@/contracts/state';
import { SavedGameIndexService } from '@/domain';
import { useGamesStore, useSavedGamesStore, useUiStateStore } from '@/state';
import AppIcon from '@/components/common/AppIcon.vue';
import ModalDialog from '@/components/common/ModalDialog.vue';

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
watch(selectedGroup, (group) => {
  if (!group?.saves.some((entry) => entry.saveName === selectedSaveName.value)) selectedSaveName.value = group ? SavedGameIndexService.getLatestSaveEntry(group.saves)?.saveName ?? '' : '';
}, { immediate: true });
watch(selectedEntry, async (entry, _previousEntry, onCleanup) => {
  let active = true;
  onCleanup(() => { active = false; });
  selectedDocument.value = undefined;
  detailError.value = '';
  if (!entry) return;
  try {
    const game = await savedGamesStore.loadGame(entry.gameId, entry.saveName);
    if (active) selectedDocument.value = game;
  } catch (error) {
    if (active) detailError.value = error instanceof Error ? error.message : 'This snapshot could not be read.';
  }
});
watch(() => route.fullPath, () => {
  overwriteTarget.value = undefined;
  initialiseRoute();
});
async function refreshGroups(): Promise<void> {
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
  }
}
function initialiseRoute(): void {
  if (isSaveMode.value && activeGame.value && !saveName.value) saveName.value = activeGame.value.metadata.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Game';
  if (route.name === 'load-game') selectedGameId.value = routeGameId.value;
  else if (!isSaveMode.value && !groups.value.some((group) => group.gameId === selectedGameId.value)) selectedGameId.value = groups.value.find((group) => group.gameId === uiStateStore.gameSession?.activeGameId)?.gameId ?? groups.value[0]?.gameId ?? '';
}
function selectSave(entry: ISavedGameFileEntry): void {
  selectedSaveName.value = entry.saveName;
  if (isSaveMode.value && !entry.isAutosave) saveName.value = entry.saveName;
}
async function loadGame(gameId: string, entryName?: string): Promise<void> {
  await run(async () => {
    const game = await savedGamesStore.loadGame(gameId, entryName);
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  });
}
async function saveGame(): Promise<void> {
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
async function writeSave(game: IGame, name: string, overwrite: boolean): Promise<void> {
  await savedGamesStore.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName: name, overwrite });
  overwriteTarget.value = undefined;
  message.value = `Saved “${name}”.`;
  await refreshGroups();
  selectedSaveName.value = name;
}
async function confirmOverwrite(): Promise<void> {
  const target = overwriteTarget.value;
  if (!target || isWorking.value) return;
  await run(() => writeSave(target.game, target.saveName, true));
}
async function importGame(): Promise<void> {
  await run(async () => {
    const game = await savedGamesStore.importGame();
    if (!game) return;
    const insertedGame = await gamesStore.insertGame(game);
    uiStateStore.openTab(insertedGame.metadata.id);
    await router.push(`/game/${insertedGame.metadata.id}`);
  }, true);
}
async function exportCurrent(): Promise<void> {
  if (!activeGame.value) return;
  await run(async () => {
    if (await savedGamesStore.exportGame(activeGame.value!)) message.value = 'Game exported.';
  });
}
async function confirmDelete(): Promise<void> {
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
async function run(action: () => Promise<void>, importAction: boolean = false): Promise<void> {
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
  <main class="saved-page page-shell">
    <header class="app-header">
      <button class="app-brand" @click="router.push(returnRoute)"><span class="app-brand__mark">♞</span><span class="app-brand__text"><span class="app-brand__name">ChessVue</span><span class="app-brand__sub">Game library</span></span></button>
      <nav class="library-tabs"><button :class="{ active: !isSaveMode }" @click="router.push('/saved-games/load')">Load</button><button :class="{ active: isSaveMode }" :disabled="!uiStateStore.gameSession?.activeGameId" @click="uiStateStore.gameSession?.activeGameId && router.push(`/saved-games/save/${uiStateStore.gameSession.activeGameId}`)">Save</button></nav>
      <div class="header-actions header-actions--end"><button class="menu-button" @click="importGame"><AppIcon name="upload" /><span>Import file</span></button><button v-if="isSaveMode" class="menu-button" :disabled="!activeGame" @click="exportCurrent"><AppIcon name="download" /><span>Export</span></button><button class="menu-button" @click="router.push(returnRoute)"><AppIcon name="x" /><span>Close</span></button></div>
    </header>
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
            <div v-if="selectedGroup?.saves.length" class="existing-saves"><h3>Existing snapshots</h3><div><span v-for="entry in selectedGroup.saves" :key="entry.filePath">{{ entry.saveName }}</span></div></div>
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
.snapshot-browser { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(15rem, 1fr); border-bottom: 0.0625rem solid var(--border-subtle); }
.snapshot-browser .save-list { min-height: 14rem; }
.snapshot-details { padding: 1rem; border-left: 0.0625rem solid var(--border-subtle); background: var(--surface-app); font-size: 0.75rem; }
.snapshot-details h2 { margin: 0 0 0.5rem; font-size: 1rem; }
.snapshot-details dl { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 0.8rem; }
.snapshot-details dt { color: var(--text-muted); }
.snapshot-details dd { margin: 0; overflow-wrap: anywhere; }
.save-separator { padding: 0.5rem 1rem; border-bottom: 0.0625rem solid var(--border-subtle); color: var(--text-muted); background: var(--surface-app); font-size: 0.65rem; }
.save-row.selected { background: var(--accent-soft); box-shadow: inset 0.2rem 0 0 var(--accent); }
@media (max-width: 43.75rem) { .snapshot-browser { grid-template-columns: 1fr; }.snapshot-details { border-top: 0.0625rem solid var(--border-subtle); border-left: 0; } }
.saved-page { min-height: 100vh; }
.app-brand { padding: 0; border: 0; background: transparent; text-align: left; }.app-brand__text { display: grid; }
.library-tabs { display: flex; height: 100%; margin-left: 1rem; align-self: stretch; gap: 0.25rem; }.library-tabs button { position: relative; min-width: 5rem; padding: 0 0.8rem; color: var(--text-muted); background: transparent; font-size: 0.75rem; font-weight: 700; }.library-tabs button.active { color: var(--text-primary); }.library-tabs button.active::after { position: absolute; right: 0.65rem; bottom: -0.0625rem; left: 0.65rem; height: 0.125rem; border-radius: 0.125rem; background: var(--accent); content: ''; }
.library-shell { width: min(66rem, calc(100% - 3rem)); margin: 0 auto; padding: 2.4rem 0 3rem; }.library-heading { margin-bottom: 1.6rem; }.library-heading .page-heading { font-size: clamp(2rem, 4vw, 3rem); }
.library-surface { overflow: hidden; }.library-surface > .empty-state { min-height: 25rem; }.library-spinner { color: var(--accent); font-family: var(--font-display); font-size: 3rem; animation: breathe 1.5s ease infinite; }
.game-list, .save-list { display: grid; min-height: 22rem; align-content: start; }.game-row { display: grid; min-height: 5rem; padding: 0.75rem 1rem; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 0.85rem; color: var(--text-primary); border-bottom: 0.0625rem solid var(--border-subtle); background: var(--surface-panel); text-align: left; }.game-row:hover, .game-row.selected { background: var(--accent-soft); }.game-row.selected { box-shadow: inset 0.2rem 0 0 var(--accent); }.game-row__piece { display: grid; width: 2.8rem; height: 2.8rem; place-items: center; color: var(--surface-panel); border-radius: 50%; background: var(--text-primary); font-family: var(--font-display); font-size: 1.7rem; }.game-row__copy { min-width: 0; }.game-row__copy strong, .game-row__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.game-row__copy strong { font-family: var(--font-display); font-size: 0.96rem; }.game-row__copy small { margin-top: 0.18rem; color: var(--text-muted); font-size: 0.66rem; }.game-row__latest { padding: 0.23rem 0.45rem; color: var(--text-muted); border-radius: 999rem; background: var(--surface-app); font-size: 0.56rem; font-weight: 700; text-transform: uppercase; }
.save-row { display: grid; min-height: 4.6rem; padding: 0.65rem 0.85rem; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 0.65rem; border-bottom: 0.0625rem solid var(--border-subtle); }.save-row__icon { display: grid; width: 2.3rem; height: 2.3rem; place-items: center; color: var(--accent); border-radius: var(--radius-sm); background: var(--accent-soft); }.save-row__content { display: grid; min-width: 0; padding: 0; background: transparent; text-align: left; }.save-row__content strong { font-size: 0.78rem; }.save-row__content small { color: var(--text-muted); font-size: 0.62rem; }.auto-badge { padding: 0.2rem 0.4rem; color: var(--accent-strong); border-radius: 999rem; background: var(--accent-soft); font-size: 0.54rem; font-weight: 800; text-transform: uppercase; }
.library-actions { display: flex; min-height: 4.7rem; padding: 0.85rem 1rem; align-items: center; justify-content: flex-end; gap: 0.55rem; border-top: 0.0625rem solid var(--border-subtle); background: var(--surface-app); }.library-count, .library-feedback { margin-right: auto; color: var(--text-muted); font-size: 0.66rem; }.library-feedback { color: var(--success-strong); }.library-feedback--error { color: var(--danger); }
.save-layout { display: grid; min-height: 22rem; padding: 1.5rem; align-content: start; gap: 1.5rem; }.save-game-card { display: flex; padding: 1rem; align-items: center; gap: 1rem; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-app); }.save-game-card > span { display: grid; width: 3.6rem; height: 3.6rem; place-items: center; color: var(--text-on-accent); border-radius: 50%; background: var(--accent-strong); font-family: var(--font-display); font-size: 2.1rem; }.save-game-card div { display: grid; }.save-game-card small { color: var(--accent); font-size: 0.56rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }.save-game-card strong { font-family: var(--font-display); font-size: 1.15rem; }.save-game-card p { margin: 0.18rem 0 0; color: var(--text-muted); font-size: 0.64rem; }.field-error { margin: 0.3rem 0 0; color: var(--danger); font-size: 0.62rem; }.existing-saves h3 { margin: 0 0 0.45rem; color: var(--text-muted); font-size: 0.64rem; text-transform: uppercase; }.existing-saves div { display: flex; flex-wrap: wrap; gap: 0.35rem; }.existing-saves span { padding: 0.25rem 0.45rem; border: 0.0625rem solid var(--border-subtle); border-radius: 999rem; background: var(--surface-panel); font-size: 0.6rem; }
.library-empty .text-button { margin-top: 0.5rem; }.delete-warning { margin: 0; color: var(--text-muted); font-size: 0.8rem; }
@media (max-width: 43.75rem) { .library-shell { width: calc(100% - 1.5rem); padding-top: 1.4rem; }.game-row__latest { display: none; }.save-row { grid-template-columns: auto 1fr auto; }.save-row .auto-badge, .save-row > .icon-button { display: none; }.library-count { display: none; }.library-tabs { margin-left: 0; } }
</style>

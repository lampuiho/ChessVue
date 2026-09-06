<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  EngineClientType,
  EngineProtocol,
  PlayerColour,
  PlayerType,
  TimeControlPreset,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IEngineRecord,
  type IPlayer,
  type ISettingsSnapshot,
} from '@/contracts';
import ModalDialog from './common/ModalDialog.vue';

const props = defineProps<{ settings: ISettingsSnapshot; engines: readonly IEngineRecord[] }>();
const emit = defineEmits<{ createRequested: [request: ICreateGameRequest]; cancelRequested: [] }>();
const form = reactive({
  name: props.settings.gameDefaults.quickNewGameName,
  mode: 'live' as 'live' | 'analysis',
  white: props.settings.gameDefaults.defaultWhitePlayerType === PlayerType.Local ? 'local' : 'none',
  black: props.settings.gameDefaults.defaultBlackPlayerType === PlayerType.Local ? 'local' : 'none',
  timePreset: props.settings.gameDefaults.defaultTimeControl.preset ?? TimeControlPreset.Untimed,
  minutes: Math.max(1, Math.round((props.settings.gameDefaults.defaultTimeControl.initialMs ?? 600000) / 60000)),
  incrementSeconds: Math.round(props.settings.gameDefaults.defaultTimeControl.incrementMs / 1000),
  allowTakeback: true,
  showLiveAnalysisMoves: false,
  analysisEngineIds: [] as string[],
});
const canCreate = computed(() => form.name.trim().length > 0 && (form.mode === 'analysis' || form.white !== 'none' && form.black !== 'none'));
watch(() => form.mode, (mode) => {
  if (mode === 'analysis') {
    form.white = 'none';
    form.black = 'none';
  } else {
    if (form.white === 'none') form.white = 'local';
    if (form.black === 'none') form.black = 'local';
  }
});

function createPlayer(selection: string, colour: PlayerColour): IPlayer | undefined {
  if (selection === 'none') return;
  if (selection === 'local') return { colour, type: PlayerType.Local, displayName: colour === PlayerColour.White ? 'White' : 'Black' };
  const engine = props.engines.find((candidate) => candidate.id === selection.slice('engine:'.length));
  if (!engine) return;
  const enginePlayer: IEnginePlayer = {
    colour,
    type: PlayerType.Engine,
    displayName: engine.displayName,
    assignedEngine: {
      displayName: engine.displayName,
      executablePath: engine.executablePath,
      clientType: engine.clientType ?? EngineClientType.Uci,
      protocol: engine.protocol ?? EngineProtocol.Uci,
      options: { ...engine.options },
    },
  };
  return enginePlayer;
}
function submit(): void {
  if (!canCreate.value) return;
  const preset = form.timePreset;
  const timeControl = preset === TimeControlPreset.Untimed
    ? { preset, incrementMs: 0 }
    : { preset, initialMs: Math.round(form.minutes * 60000), incrementMs: Math.round(form.incrementSeconds * 1000) };
  const selectedEngines = props.engines.filter((engine) => form.analysisEngineIds.includes(engine.id));
  emit('createRequested', {
    name: form.name.trim(),
    whitePlayer: form.mode === 'live' ? createPlayer(form.white, PlayerColour.White) : undefined,
    blackPlayer: form.mode === 'live' ? createPlayer(form.black, PlayerColour.Black) : undefined,
    analysisEngineProfiles: selectedEngines.map((engine) => ({ ...engine, options: { ...engine.options } })),
    showLiveAnalysisMoves: form.mode === 'live' ? form.showLiveAnalysisMoves : true,
    allowTakeback: form.allowTakeback,
    timeControl,
  });
}
</script>

<template>
  <ModalDialog title="Set up a new board" subtitle="Choose a quick match or open a free analysis study." wide @dismissed="emit('cancelRequested')">
    <form id="new-game-form" @submit.prevent="submit">
      <section class="form-section">
        <h3 class="form-section__heading">Game</h3>
        <div class="field-row">
          <label class="field-label" for="game-name">Name<span class="field-help">Shown in the workspace tab</span></label>
          <input id="game-name" v-model="form.name" class="field-control" autocomplete="off" autofocus>
        </div>
        <div class="field-row">
          <span class="field-label">Workspace</span>
          <div class="segmented-control">
            <button type="button" :class="{ active: form.mode === 'live' }" @click="form.mode = 'live'">Play a game</button>
            <button type="button" :class="{ active: form.mode === 'analysis' }" @click="form.mode = 'analysis'">Free analysis</button>
          </div>
        </div>
      </section>
      <section v-if="form.mode === 'live'" class="form-section">
        <h3 class="form-section__heading">Players</h3>
        <div class="field-row">
          <label class="field-label" for="white-player">White</label>
          <select id="white-player" v-model="form.white" class="field-control">
            <option value="local">Local player</option>
            <option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">{{ engine.displayName }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label" for="black-player">Black</label>
          <select id="black-player" v-model="form.black" class="field-control">
            <option value="local">Local player</option>
            <option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">{{ engine.displayName }}</option>
          </select>
        </div>
      </section>
      <section class="form-section">
        <h3 class="form-section__heading">Time & assistance</h3>
        <div class="field-row">
          <label class="field-label" for="time-preset">Clock</label>
          <select id="time-preset" v-model="form.timePreset" class="field-control">
            <option :value="TimeControlPreset.Untimed">Untimed</option>
            <option :value="TimeControlPreset.Bullet">Bullet</option>
            <option :value="TimeControlPreset.Blitz">Blitz</option>
            <option :value="TimeControlPreset.Rapid">Rapid</option>
            <option :value="TimeControlPreset.Classical">Classical</option>
          </select>
        </div>
        <div v-if="form.timePreset !== TimeControlPreset.Untimed" class="time-fields">
          <label class="field-label">Minutes<input v-model.number="form.minutes" class="field-control" type="number" min="1" max="600"></label>
          <label class="field-label">Increment (seconds)<input v-model.number="form.incrementSeconds" class="field-control" type="number" min="0" max="300"></label>
        </div>
        <label class="toggle-row"><input v-model="form.allowTakeback" type="checkbox"><span class="toggle-track"></span><span><strong>Allow takebacks</strong><small>Rewind the played line when needed.</small></span></label>
        <label v-if="form.mode === 'live'" class="toggle-row"><input v-model="form.showLiveAnalysisMoves" type="checkbox"><span class="toggle-track"></span><span><strong>Show live analysis moves</strong><small>Engine continuations become playable suggestions.</small></span></label>
        <div v-if="engines.length" class="engine-selection">
          <span class="field-label">Analysis engines <span class="field-help">Choose up to four</span></span>
          <label v-for="engine in engines" :key="engine.id" class="check-row"><input v-model="form.analysisEngineIds" type="checkbox" :value="engine.id" :disabled="!form.analysisEngineIds.includes(engine.id) && form.analysisEngineIds.length >= 4"><span>{{ engine.displayName }}</span></label>
        </div>
      </section>
    </form>
    <template #actions>
      <button class="text-button text-button--ghost" @click="emit('cancelRequested')">Cancel</button>
      <button class="text-button text-button--primary" :disabled="!canCreate" form="new-game-form" type="submit">Create workspace</button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.segmented-control { display: grid; grid-template-columns: 1fr 1fr; padding: 0.2rem; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-app); }
.segmented-control button { min-height: 2.25rem; padding: 0.4rem 0.65rem; color: var(--text-muted); border-radius: 0.32rem; background: transparent; font-size: 0.78rem; font-weight: 700; }
.segmented-control button.active { color: var(--text-primary); background: var(--surface-dialog); box-shadow: var(--shadow-sm); }
.time-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
.toggle-row strong, .toggle-row small { display: block; }
.toggle-row strong { font-size: 0.82rem; }
.toggle-row small { color: var(--text-muted); font-size: 0.72rem; }
.engine-selection { display: grid; padding: 0.85rem; gap: 0.45rem; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); }
.check-row { display: flex; align-items: center; gap: 0.55rem; color: var(--text-muted); font-size: 0.8rem; }
.check-row input { accent-color: var(--accent); }
</style>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import {
  EngineClientType,
  EngineProtocol,
  PlayerColour,
  PlayerType,
  TimeControlPreset,
  type ICreateGameRequest,
  type IEnginePlayer,
  type IEngineRecord,
  type IGame,
  type IPlayer,
  type ISettingsSnapshot,
} from '@/contracts';
import ModalDialog from './common/ModalDialog.vue';

const props = defineProps<{ settings: ISettingsSnapshot; engines: readonly IEngineRecord[]; setupGame?: IGame; errorMessage?: string; busy?: boolean }>();
const emit = defineEmits<{ createRequested: [request: ICreateGameRequest]; cancelRequested: [] }>();
const form = reactive({
  name: props.setupGame?.metadata.name ?? props.settings.gameDefaults.quickNewGameName,
  mode: 'live' as 'live' | 'analysis',
  white: _defaultPlayer(props.settings.gameDefaults.defaultWhitePlayerType),
  black: _defaultPlayer(props.settings.gameDefaults.defaultBlackPlayerType),
  timePreset: (props.settings.gameDefaults.defaultTimeControl.preset ?? TimeControlPreset.Untimed) as TimeControlPreset | 'custom',
  minutes: Math.max(1, Math.round((props.settings.gameDefaults.defaultTimeControl.initialMs ?? 600000) / 60000)),
  incrementSeconds: Math.round(props.settings.gameDefaults.defaultTimeControl.incrementMs / 1000),
  allowTakeback: props.setupGame?.gameplayOptions.allowTakeback ?? true,
  showLiveAnalysisMoves: props.setupGame?.gameplayOptions.showLiveAnalysisMoves ?? false,
  analysisEngineIds: props.engines.filter((engine) => props.setupGame?.analysis.seats.some((seat) => seat.assignedEngine.displayName === engine.displayName)).map((engine) => engine.id),
});
const validationMessage = computed(() => {
  if (!form.name.trim()) return 'Enter a game name.';
  if (form.timePreset !== TimeControlPreset.Untimed) {
    if (typeof form.minutes !== 'number' || !Number.isFinite(form.minutes) || form.minutes < 1 || form.minutes > 600) return 'Enter minutes between 1 and 600.';
    if (!Number.isInteger(form.incrementSeconds) || form.incrementSeconds < 0 || form.incrementSeconds > 300) return 'Enter an increment between 0 and 300 seconds.';
  }
  if (form.mode === 'live') {
    for (const selection of [form.white, form.black]) {
      if (selection === 'none' && !props.setupGame || selection === 'local') continue;
      if (!props.engines.find((engine) => `engine:${engine.id}` === selection)?.executablePath.trim()) return 'Choose an available engine for each required seat.';
    }
  }
  if (form.analysisEngineIds.length > 4 || form.analysisEngineIds.some((id) => !props.engines.find((engine) => engine.id === id)?.executablePath.trim())) return 'Choose up to four available analysis engines.';
  return '';
});
const canCreate = computed(() => !props.busy && !validationMessage.value);
function _defaultPlayer(type: PlayerType): string {
  if (props.setupGame || type === PlayerType.Local) return 'local';
  return `engine:${props.engines[0]?.id ?? ''}`;
}

function _createPlayer(selection: string, colour: PlayerColour): IPlayer | undefined {
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
function _submit() {
  if (!canCreate.value) return;
  const preset = form.timePreset === 'custom' ? undefined : form.timePreset;
  const timeControl = preset === TimeControlPreset.Untimed
    ? { preset, incrementMs: 0 }
    : { preset, initialMs: Math.round(form.minutes * 60000), incrementMs: Math.round(form.incrementSeconds * 1000) };
  const selectedEngines = props.engines.filter((engine) => form.analysisEngineIds.includes(engine.id));
  emit('createRequested', {
    name: form.name.trim(),
    whitePlayer: form.mode === 'live' ? _createPlayer(form.white, PlayerColour.White) : undefined,
    blackPlayer: form.mode === 'live' ? _createPlayer(form.black, PlayerColour.Black) : undefined,
    analysisEngineProfiles: selectedEngines.map((engine) => ({ ...engine, options: { ...engine.options } })),
    showLiveAnalysisMoves: form.mode === 'live' && form.white !== 'none' && form.black !== 'none' ? form.showLiveAnalysisMoves : true,
    allowTakeback: form.allowTakeback,
    timeControl,
  });
}
</script>

<template>
  <ModalDialog :title="setupGame ? 'Start from this position' : 'Set up a new board'" :subtitle="setupGame ? 'Choose players, clocks and analysis for the board you prepared.' : 'Choose a quick match or open a free analysis study.'" :dismissible="!busy" wide @dismissed="emit('cancelRequested')">
    <form id="new-game-form" @submit.prevent="_submit">
      <section class="form-section">
        <h3 class="form-section__heading">Game</h3>
        <div class="field-row">
          <label class="field-label" for="game-name">Name<span class="field-help">Shown in the workspace tab</span></label>
          <input id="game-name" v-model="form.name" class="field-control" autocomplete="off" autofocus>
        </div>
        <div v-if="!setupGame" class="field-row">
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
            <option v-if="!setupGame" value="none">Unassigned (free analysis)</option>
            <option v-if="form.white === 'engine:'" value="engine:" disabled>Choose an engine</option>
            <option value="local">Local player</option>
            <option v-for="engine in engines" :key="engine.id" :value="`engine:${engine.id}`">{{ engine.displayName }}</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label" for="black-player">Black</label>
          <select id="black-player" v-model="form.black" class="field-control">
            <option v-if="!setupGame" value="none">Unassigned (free analysis)</option>
            <option v-if="form.black === 'engine:'" value="engine:" disabled>Choose an engine</option>
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
            <option value="custom">Custom</option>
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
    <p v-if="validationMessage" class="inline-message inline-message--error" role="alert">{{ validationMessage }}</p>
    <p v-if="errorMessage" class="inline-message inline-message--error" role="alert">{{ errorMessage }}</p>
    <template #actions>
      <button class="text-button text-button--ghost" :disabled="busy" @click="emit('cancelRequested')">Cancel</button>
      <button class="text-button text-button--primary" :disabled="!canCreate" form="new-game-form" type="submit">{{ setupGame ? 'Start game' : 'Create workspace' }}</button>
    </template>
  </ModalDialog>
</template>


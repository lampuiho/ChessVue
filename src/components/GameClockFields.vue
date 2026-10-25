<script setup lang="ts">
import { computed } from 'vue';
import { TimeControlPreset, type ITimeControl } from '@/contracts/TimeControl';
import { gameClockChoices, selectGameClock } from '@/utility/GameCreationUtility';
defineProps<{ id: string; label: string }>();
const clock = defineModel<ITimeControl>({ required: true });
const selection = computed(() => clock.value.preset ?? 'custom');
function _select(event: Event) { clock.value = selectGameClock((event.target as HTMLSelectElement).value, clock.value); }
function _minutes(event: Event) { clock.value.initialMs = Math.round((event.target as HTMLInputElement).valueAsNumber * 60000); }
function _increment(event: Event) { clock.value.incrementMs = (event.target as HTMLInputElement).valueAsNumber * 1000; }
</script>
<template>
  <div class="field-row"><label class="field-label" :for="id">{{ label }}</label><select :id="id" :value="selection" class="field-control" @change="_select"><option v-for="choice in gameClockChoices" :key="choice.value" :value="choice.value">{{ choice.label }}</option><option value="custom">Custom</option></select></div>
  <div v-if="selection === 'custom'" class="time-fields">
    <label class="field-label">Minutes<input :value="Number.isFinite(clock.initialMs) ? clock.initialMs! / 60000 : ''" class="field-control" type="number" min="1" max="600" step="any" @input="_minutes"></label>
    <label class="field-label">Increment (seconds)<input :value="Number.isFinite(clock.incrementMs) ? clock.incrementMs / 1000 : ''" class="field-control" type="number" min="0" max="300" @input="_increment"></label>
  </div>
  <p v-else-if="selection !== TimeControlPreset.Untimed" class="field-help">{{ clock.initialMs! / 60000 }} minutes + {{ clock.incrementMs / 1000 }} seconds per move.</p>
</template>

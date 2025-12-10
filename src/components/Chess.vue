<script setup lang='ts'>
import { computed } from 'vue';
const props = defineProps({
  chess: Object,
  index: Number,
});
const emit = defineEmits(['grab']);
const isDark = computed(() => {
  const row = Math.floor(props.index / 8);
  const col = props.index % 8;
  return (row + col) % 2 === 1;
});
function onGrab() {
  emit('grab', props.chess);
}
</script>
<template>
  <div
    class="w-12 h-12 flex items-center justify-center border cursor-pointer select-none"
    :class="{
      'bg-gray-200': isDark,
      'opacity-50': chess.taken,
    }"
    @mousedown.prevent="onGrab"
  >
    <span v-if="!chess.taken">{{ chess.symbol }}</span>
  </div>
</template>
<style scoped>
</style>

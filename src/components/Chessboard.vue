<script setup lang="ts">
import Chess from './Chess.vue';
import type IChessboardState from '@/models/interfaces/IChessboardState';

defineProps<{ state: IChessboardState; }>();
</script>
<template>
  <div class="grid grid-cols-8 w-[384px] h-[384px] select-none">
    <template v-for="(cell, i) of state.cells">
      <Chess v-if=cell
        :key=i
        :chess=cell.chess
        :side=cell.side
        :index=i
      />
    </template>
  </div>
</template>
<style scoped>
</style>

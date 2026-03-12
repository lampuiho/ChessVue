<script setup lang="ts">
import ChessPiece from './ChessPiece.vue';
import type IChessboardState from '@/models/interfaces/IChessboardState';

defineProps<{ 
  state: IChessboardState;
  flipped: boolean;
}>();

function isLightSquare(idx: number): boolean
{
  return (Math.floor(idx / 8) + (idx % 8)) % 2 === 0;
}
</script>
<template>
  <div class="chessboard">
    <template v-for="(cell, i) of state.cells" :key=i>
      <div class="chessboard-cell" :class="{ light: isLightSquare(i) }">
        <ChessPiece v-if=cell
          :chess=cell.chess
          :isWhite=cell.isWhite
          :index=i
        />
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
.chessboard {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  aspect-ratio: 1 / 1; /* Maintain square aspect ratio */
  max-height: 100%;
  max-width: 100%;
}
.chessboard-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;

  background-color: #8B4513; /* Darker brown */
  &.light
  {
    background-color: #F4A460; /* Lighter brown */
  }
}
</style>

<script setup lang="ts">
import ChessPiece from './ChessPiece.vue';
import type IChessboardState from '@/models/interfaces/IChessboardState';

defineProps<{ state: IChessboardState; }>();
</script>
<template>
  <div class="chessboard">
    <template v-for="(cell, i) of state.cells" :key=i>
      <div class="chessboard-cell">
        <ChessPiece v-if=cell
          :chess=cell.chess
          :side=cell.side
          :index=i
          class="chessboard-cell"
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
}
.chessboard-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
}
.chessboard-cell:nth-child(odd) {
  background-color: #F4A460; /* Lighter brown */
}
.chessboard-cell:nth-child(even) {
  background-color: #8B4513; /* Darker brown */
}
</style>

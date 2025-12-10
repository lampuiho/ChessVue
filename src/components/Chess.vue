<script setup lang='ts'>
import { computed } from 'vue';
import { ChessPiece } from '@/models/enums/ChessPiece';

const props = defineProps<{ chess: ChessPiece, side: boolean, index: number }>();
const isDark = computed(() => {
  const row = Math.floor(props.index / 8);
  const col = props.index % 8;
  return (row + col) % 2 === 1;
});
const chessSymbols = {
  [ChessPiece.PAWN]:   ['♙','♟'],
  [ChessPiece.BISHOP]: ['♗','♝'],
  [ChessPiece.KNIGHT]: ['♘','♞'],
  [ChessPiece.ROOK]:   ['♖','♜'],
  [ChessPiece.QUEEN]:  ['♕','♛'],
  [ChessPiece.KING]:   ['♔','♚'],
};
</script>
<template>
  <div class="w-12 h-12 flex items-center justify-center border cursor-pointer select-none"
    :class="{ 'bg-gray-200': isDark, }"
  >
    <span>{{ chessSymbols[chess][side ? 0 : 1] }}</span>
  </div>
</template>
<style scoped>
</style>

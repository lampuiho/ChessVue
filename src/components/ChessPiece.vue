<script setup lang='ts'>
import { ChessPiece } from '@/models/enums/ChessPiece';

const props = defineProps<{ 
  chess: ChessPiece;
  /** True for white side, false for black side */
  isWhite: boolean;
  index: number;
}>();
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
  <div class="chess-piece">
    {{ chessSymbols[chess][isWhite ? 1 : 0] }}
  </div>
</template>
<style scoped>
.chess-piece {
  font-size: 1.5rem;
}
</style>

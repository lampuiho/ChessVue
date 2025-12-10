<script setup>
import { reactive } from 'vue';
import Chess from './Chess.vue';
// Enum for move permission
const MovePermission = Object.freeze({
  ALL: 'all',
  WHITE: 'white',
  BLACK: 'black'
});
// Data structure for ChessState
// chess: 'pawn', 'knight', 'rook', etc.
// side: 'white' or 'black'
// taken: boolean
// position: index 0-63
function createChess(id, chess, side, position) {
  return { id, chess, side, position, taken: false, get symbol() { return chessSymbols[chess][side]; } };
}
const chessSymbols = {
  pawn:   { white: '♙', black: '♟' },
  rook:   { white: '♖', black: '♜' },
  knight: { white: '♘', black: '♞' },
  bishop: { white: '♗', black: '♝' },
  queen:  { white: '♕', black: '♛' },
  king:   { white: '♔', black: '♚' },
};
// ChessboardState
const state = reactive({
  board: Array(64).fill(null),
  movePermission: MovePermission.ALL,
});
// Initialize with some pieces
const pieces = [
  createChess(1, 'rook', 'white', 0),
  createChess(2, 'knight', 'white', 1),
  createChess(3, 'bishop', 'white', 2),
  createChess(4, 'queen', 'white', 3),
  createChess(5, 'king', 'white', 4),
];
pieces.forEach(p => state.board[p.position] = p);
function onGrab(chess) {
  console.log('Grabbed:', chess);
  // Drag-move logic will be implemented here
}
const board = state.board;
</script>
<template>
  <div class="grid grid-cols-8 w-[384px] h-[384px] select-none">
    <Chess
      v-for="(chess, index) in board"
      :key="chess.id"
      :chess="chess"
      :index="index"
      @grab="onGrab"
    />
  </div>
</template>
<style scoped>
</style>

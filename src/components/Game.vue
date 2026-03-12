<script setup lang="ts">
import { MovePermission } from '@/models/enums/MovePermission';
import { ChessPiece } from '@/models/enums/ChessPiece';
import type IGame from '@/models/interfaces/IGame';
import Chessboard from './Chessboard.vue';
import { ref } from 'vue';
import { PlayerType } from '@/models/enums/PlayerType';

function createStandardGamePieces(): (IChessPiece | null)[] {
  const cells: (IChessPiece | null)[] = Array(64).fill(null);

  // Black pieces (side: false, on top)
  // Row 0: Back rank
  cells[0] = { chess: ChessPiece.ROOK, side: false };
  cells[1] = { chess: ChessPiece.KNIGHT, side: false };
  cells[2] = { chess: ChessPiece.BISHOP, side: false };
  cells[3] = { chess: ChessPiece.QUEEN, side: false };
  cells[4] = { chess: ChessPiece.KING, side: false };
  cells[5] = { chess: ChessPiece.BISHOP, side: false };
  cells[6] = { chess: ChessPiece.KNIGHT, side: false };
  cells[7] = { chess: ChessPiece.ROOK, side: false };

  // Row 1: Pawns
  for (let i = 8; i < 16; i++) {
    cells[i] = { chess: ChessPiece.PAWN, side: false };
  }

  // White pieces (side: true, on bottom)
  // Row 6: Pawns
  for (let i = 48; i < 56; i++) {
    cells[i] = { chess: ChessPiece.PAWN, side: true };
  }

  // Row 7: Back rank
  cells[56] = { chess: ChessPiece.ROOK, side: true };
  cells[57] = { chess: ChessPiece.KNIGHT, side: true };
  cells[58] = { chess: ChessPiece.BISHOP, side: true };
  cells[59] = { chess: ChessPiece.QUEEN, side: true };
  cells[60] = { chess: ChessPiece.KING, side: true };
  cells[61] = { chess: ChessPiece.BISHOP, side: true };
  cells[62] = { chess: ChessPiece.KNIGHT, side: true };
  cells[63] = { chess: ChessPiece.ROOK, side: true };

  return cells;
}

const state = ref<IGame>({
  chessBoardState: {
    cells: createStandardGamePieces(),
    turn: MovePermission.ALL,
  },
});
// flipped if only white is not local player
// and black is local player
const flipped = ref(
  state.value.playerWhite.type !== PlayerType.LOCAL &&
  state.value.playerBlack.type === PlayerType.LOCAL
); // can be toggled
</script>
<template>
  <div class="game-panel">
    <Chessboard :state=state.chessBoardState :flipped=flipped />
  </div>
</template>
<style scoped> 
.game-panel {
  height: 100%;
  width: 100%;
}
</style>

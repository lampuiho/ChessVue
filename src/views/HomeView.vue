<script setup lang="ts">
import Chessboard from '@/components/Chessboard.vue';
import { ChessPiece } from '@/models/enums/ChessPiece';
import { MovePermission } from '@/models/enums/MovePermission';
import type IChessboardState from '@/models/interfaces/IChessboardState';

const state: IChessboardState = {
  cells: Array(64).fill(null).map((_, index) => {
    // Example initial setup for pawns
    if (index >= 8 && index < 16) {
      return { chess: ChessPiece.PAWN, side: false };
    } else if (index >= 48 && index < 56) {
      return { chess: ChessPiece.PAWN, side: true };
    }
    return null;
  }),
  turn: MovePermission.ALL,
};
</script>

<template>
  <main>
    <Chessboard :state="state" />
  </main>
</template>

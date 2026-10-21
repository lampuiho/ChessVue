<script setup lang="ts">
import { PieceKind, type IChessPiece } from '@/contracts';
defineProps<IChessPiece>();
</script>

<template>
  <svg class="piece-artwork" :class="`piece-artwork--${colour}`" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <template v-if="kind === PieceKind.King">
      <path d="M22 4h4v4h4v4h-4v8h-4v-8h-4V8h4Z" />
      <path d="M17 31c0-5-6-8-6-13 0-4 5-5 9-2l4 4 4-4c4-3 9-2 9 2 0 5-6 8-6 13l3 5H14Z" />
      <path class="piece-artwork__detail" d="M17 31h14M24 20v8" />
    </template>
    <template v-else-if="kind === PieceKind.Queen">
      <path d="m14 28-4-15 9 8 5-12 5 12 9-8-4 15-3 4 3 4H14l3-4Z" />
      <circle cx="9" cy="11" r="2.5" /><circle cx="24" cy="7" r="2.5" /><circle cx="39" cy="11" r="2.5" />
      <path class="piece-artwork__detail" d="M14 28h20M17 32h14" />
    </template>
    <template v-else-if="kind === PieceKind.Rook">
      <path d="M11 9h7v6h4V9h4v6h4V9h7v13l-5 4v6l3 4H13l3-4v-6l-5-4Z" />
      <path class="piece-artwork__detail" d="M11 22h26M16 27h16M16 32h16" />
    </template>
    <template v-else-if="kind === PieceKind.Bishop">
      <circle cx="24" cy="7" r="2.5" />
      <path d="M18 26c-3-2-4-4-4-7 0-5 6-9 10-12 4 3 10 7 10 12 0 3-1 5-4 7l-2 3 3 4 3 3H14l3-3 3-4Z" />
      <path class="piece-artwork__detail" d="m27 13-6 8M18 26h12M20 30h8" />
    </template>
    <template v-else-if="kind === PieceKind.Knight">
      <path d="M14 36c0-6 3-10 9-14l-5 1-4 4-6-4 5-8 6-5 1-5 6 5c9 1 13 8 12 16l-2 10Z" />
      <path class="piece-artwork__detail" d="M26 14c7 5 6 13 2 18M10 22l4 1" />
      <circle class="piece-artwork__eye" cx="20" cy="16" r="1.5" />
    </template>
    <template v-else-if="kind === PieceKind.Pawn">
      <path d="M20 19h8v4c0 6 3 10 7 13H13c4-3 7-7 7-13Z" />
      <circle cx="24" cy="13" r="6" />
      <path class="piece-artwork__detail" d="M19 23h10" />
    </template>
    <path d="M13 36h22l3 6H10Z" />
  </svg>
</template>

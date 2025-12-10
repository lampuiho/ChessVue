<script setup lang="ts">
import type IGame from '@/models/interfaces/IGame';
import Chessboard from './Chessboard.vue';

defineProps<{ state: IGame }>();
</script>
<template>
  <Chessboard :state=state.chessBoardState />
</template>

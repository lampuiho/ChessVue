<script setup lang="ts">
import type { IRecordedAnalysis } from '@/contracts';
import { getSan } from '@/utility/chess';
defineProps<{ record: IRecordedAnalysis }>();
</script>
<template>
  <section class="recorded-analysis" aria-label="Recorded analysis">
    <h2>Recorded analysis</h2><p>Before this move · {{ record.recordedAt.toLocaleString('en-GB') }}</p>
    <article v-for="(seat, index) in record.seats" :key="index">
      <strong>{{ seat.assignedEngine.displayName }}</strong>
      <p v-for="(line, lineIndex) in seat.lines" :key="lineIndex">d{{ line.depth }} · {{ line.scoreMate !== undefined ? `Mate ${line.scoreMate}` : line.scoreCp !== undefined ? (line.scoreCp / 100).toFixed(2) : '—' }} · {{ line.pv.map(getSan).join(' ') }}</p>
    </article>
  </section>
</template>
<style scoped>
.recorded-analysis { max-height: 10rem; overflow: auto; padding: 0.65rem; border-bottom: 0.0625rem solid var(--border-subtle); }
h2 { margin: 0; font-family: var(--font-display); font-size: 0.9rem; }
strong { font-size: 0.7rem; }
p { margin: 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; }
</style>

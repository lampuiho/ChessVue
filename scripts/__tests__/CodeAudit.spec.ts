import { expect, it } from 'vitest';
import { inspectSource } from '../audit/InspectSource.mjs';
it.each([
  "import { watch as observe } from 'vue'; observe(value, action);",
  "import * as Vue from 'vue'; Vue.watchEffect(action);",
  "import * as Vue from 'vue'; Vue['watchPostEffect'](action);",
  "store.$subscribe(action);",
  "store['$watch']('value', action);",
])('finds observer aliases and equivalent subscription forms: %s', (source) => {
  expect(inspectSource('sample.ts', source).map((finding) => finding.kind)).toEqual(['observer']);
});
it('finds Vue script annotations without mistaking templates or contracts for implementations', () => {
  const source = '<script setup lang="ts">interface IWork { run(): Promise<void>; } const callback: () => void = () => {}; async function run(): Promise<void> {}</script><template>watch(value)</template>';
  expect(inspectSource('sample.vue', source).map((finding) => finding.kind)).toEqual(['return']);
});
it('keeps promise generics and typed callable constraints outside the return-removal candidates', () => {
  expect(inspectSource('sample.ts', 'const pending = new Promise<void>(() => {}); const handler: () => void = () => 1; void pending;')).toEqual([]);
});
it.each(['generation', 'playbackEpoch', 'requestVersion'])('finds named invalidation counters: %s', (name) => {
  expect(inspectSource('sample.ts', `let ${name} = 0;`).some((finding) => finding.kind === 'counter')).toBe(true);
});
it('finds a renamed counter captured and compared around async work', () => {
  const source = 'let serial = 0; async function run() { const captured = ++serial; await work(); if (captured !== serial) return; commit(); }';
  expect(inspectSource('sample.ts', source).some((finding) => finding.kind === 'counter')).toBe(true);
});
it('finds class fields used as invalidation counters', () => {
  expect(inspectSource('sample.ts', 'class Playback { private _generation = 0; }').map((finding) => finding.kind)).toEqual(['counter']);
});
it('does not classify resource IDs, schema versions or ordinary iteration as stale-result counters', () => {
  const source = 'let nextId = 0; function register() { return ++nextId; } const schemaVersion = 1; for (let index = 0; index < 4; index++) visit(index);';
  expect(inspectSource('sample.ts', source)).toEqual([]);
});

import { expect, it } from 'vitest';
import { inspectStyles } from '../audit/InspectStyles.mjs';
it.each(['', ' scoped', ' src="./panel.css"'])('rejects component style blocks%s', (attributes) => {
  const source = `<template><main /></template>\n<style${attributes}>.panel { color: red; }</style>`;
  expect(inspectStyles('Panel.vue', source)).toMatchObject([{ kind: 'style', file: 'Panel.vue', line: 2 }]);
});
it.each([':deep(.button)', '::v-deep .button', ':global(.button)', '.panel >>> .button', '.panel /deep/ .button'])('rejects scope escape selectors: %s', (selector) => {
  expect(inspectStyles('panel.css', `${selector} { color: red; }`)).toHaveLength(1);
});
it('accepts global variants, responsive rules and runtime presentation values without component styles', () => {
  expect(inspectStyles('panel.css', '.panel { color: var(--text-primary); } @media (max-width: 760px) { .panel--compact { display: flex; } }')).toEqual([]);
  expect(inspectStyles('Panel.vue', '<template><main :style="{ \'--depth\': depth }" /></template>')).toEqual([]);
});

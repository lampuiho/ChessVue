import { parse } from 'vue/compiler-sfc';
export function inspectStyles(file, raw) {
  if (file.endsWith('.vue')) {
    const { descriptor } = parse(raw, { filename: file });
    return descriptor.styles.map((style, index) => ({ kind: 'style', key: `${file}:style-${index}`, file, line: style.loc.start.line,
      message: 'Declare styles in the global stylesheet modules imported by src/assets/main.css, without component style blocks.' }));
  }
  if (!file.endsWith('.css')) return [];
  return [...raw.matchAll(/:deep\b|::v-deep\b|:global\b|>>>|\/deep\//g)].map((match) => ({ kind: 'style', key: `${file}:selector-${match.index}`, file,
    line: raw.slice(0, match.index).split('\n').length, message: 'Use ordinary global selectors and explicit class variants; Vue scope escape selectors are prohibited.' }));
}

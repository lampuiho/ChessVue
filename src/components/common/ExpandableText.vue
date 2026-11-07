<script setup lang="ts">
import { onScopeDispose, ref } from 'vue';

defineProps<{ text: string; label?: string }>();
defineOptions({ inheritAttrs: false });
const open = ref(false);
const popover = ref<HTMLElement | undefined>(undefined);
const metrics = ref<Record<string, string>>({});
let _anchor: HTMLElement | undefined;
onScopeDispose(() => _unbind());
function _isOpaque(colour: string): boolean {
  const alpha = /^rgba?\([^)]*,\s*([\d.]+)\s*\)$/.exec(colour);
  return !!colour && colour !== 'transparent' && (!alpha || Number(alpha[1]) === 1);
}
// Walks past the trigger's own hover tint, which is translucent and would let the covered text show through.
function _opaqueBackground(element: HTMLElement): string {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const background = getComputedStyle(node).backgroundColor;
    if (_isOpaque(background)) return background;
  }
  return 'var(--surface-panel)';
}
function _place() {
  const anchor = _anchor;
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const style = getComputedStyle(anchor);
  metrics.value = {
    '--expandable-top': `${rect.top}px`,
    '--expandable-left': `${rect.left}px`,
    '--expandable-width': `${rect.width}px`,
    '--expandable-max-height': `${Math.max(rect.height, window.innerHeight - rect.top - 8)}px`,
    '--expandable-background': _opaqueBackground(anchor),
    '--expandable-padding': `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
    '--expandable-radius': style.borderTopLeftRadius,
    '--expandable-family': style.fontFamily,
    '--expandable-size': style.fontSize,
    '--expandable-weight': style.fontWeight,
    '--expandable-line-height': style.lineHeight,
    '--expandable-letter-spacing': style.letterSpacing,
    '--expandable-word-spacing': style.wordSpacing,
    '--expandable-colour': style.color,
  };
}
function _onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (target && (popover.value?.contains(target) || _anchor?.contains(target))) return;
  _close();
}
function _onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') _close();
}
function _bind() {
  document.addEventListener('pointerdown', _onPointerDown, true);
  document.addEventListener('keydown', _onKeyDown);
  window.addEventListener('resize', _close);
  window.addEventListener('scroll', _close, true);
}
function _unbind() {
  document.removeEventListener('pointerdown', _onPointerDown, true);
  document.removeEventListener('keydown', _onKeyDown);
  window.removeEventListener('resize', _close);
  window.removeEventListener('scroll', _close, true);
}
function _close() {
  if (!open.value) return;
  _unbind();
  open.value = false;
  _anchor?.focus();
}
function _toggle(event: MouseEvent) {
  if (open.value) {
    _close();
    return;
  }
  _anchor = event.currentTarget as HTMLElement;
  _place();
  open.value = true;
  _bind();
}
</script>

<template>
  <button class="expandable-text" :class="{ 'expandable-text--open': open }" v-bind="$attrs" :title="text" :aria-label="label ?? 'Show the full text'" :aria-expanded="open" @click="_toggle($event)">{{ text }}</button>
  <Teleport to="body">
    <div v-if="open" ref="popover" class="expandable-text__overlay" :style="metrics" role="group" :aria-label="label ?? 'Full text'" @click="_close()">
      <slot :close="_close">{{ text }}</slot>
    </div>
  </Teleport>
</template>

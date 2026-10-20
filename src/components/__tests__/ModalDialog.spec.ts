import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ModalDialog from '../common/ModalDialog.vue';
const mounted: VueWrapper[] = [];
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect()] as unknown as DOMRectList);
});
afterEach(() => {
  for (const wrapper of mounted.reverse()) wrapper.unmount();
  mounted.splice(0);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function openDialog(title: string, dismissible = true) {
  const wrapper = mount(ModalDialog, { attachTo: document.body, props: { title, dismissible }, slots: { default: '<button autofocus>Action</button><button disabled>Unavailable</button><button style="display:none">Hidden</button>' } });
  mounted.push(wrapper);
  return wrapper;
}
it('focuses the form, traps both Tab directions and restores nested focus to its actual owner', async () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const parent = openDialog('Parent');
  const action = parent.get('button[autofocus]');
  expect(document.activeElement).toBe(action.element);
  await action.trigger('keydown', { key: 'Tab' });
  expect(document.activeElement).toBe(parent.get('[aria-label="Close dialog"]').element);
  await parent.get('[aria-label="Close dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(action.element);
  const child = openDialog('Child');
  expect(document.activeElement).toBe(child.get('button[autofocus]').element);
  opener.focus();
  expect(document.activeElement).toBe(child.get('button[autofocus]').element);
  child.unmount();
  mounted.pop();
  expect(document.activeElement).toBe(action.element);
  parent.unmount();
  mounted.pop();
  expect(document.activeElement).toBe(opener);
});
it('releases every document focus listener after repeated dialog activation', () => {
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  for (let count = 0; count < 5; count++) {
    openDialog('Repeated').unmount();
    mounted.pop();
  }
  const listeners = add.mock.calls.filter(([type]) => type === 'focusin').map(([, listener]) => listener);
  expect(listeners).toHaveLength(5);
  for (const listener of listeners) expect(remove).toHaveBeenCalledWith('focusin', listener);
});
it('returns focus to an available route action when the launcher becomes hidden', () => {
  document.body.innerHTML = '<main><button style="display:none">Hidden fallback</button><button id="fallback">Available</button><button id="opener">Open</button></main>';
  const opener = document.getElementById('opener')!;
  opener.focus();
  const dialog = openDialog('Responsive menu');
  opener.style.display = 'none';
  dialog.unmount();
  mounted.pop();
  expect(document.activeElement).toBe(document.getElementById('fallback'));
});
it('retains focus when a pending action disables every control and releases its local listener', async () => {
  const wrapper = openDialog('Busy', false);
  const action = wrapper.get('button[autofocus]');
  const dialog = wrapper.get('[role="dialog"]');
  const remove = vi.spyOn(dialog.element, 'removeEventListener');
  const focused = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  action.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  expect(document.activeElement).toBe(action.element);
  focused.mockReturnValue(true);
  (action.element as HTMLButtonElement).disabled = true;
  action.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  expect(document.activeElement).toBe(dialog.element);
  wrapper.unmount();
  mounted.pop();
  expect(remove).toHaveBeenCalledWith('focusout', expect.any(Function));
});
it('keeps an empty non-dismissible dialog focused and ignores Escape', async () => {
  const wrapper = mount(ModalDialog, { attachTo: document.body, props: { title: 'Resolve', dismissible: false } });
  mounted.push(wrapper);
  const dialog = wrapper.get('[role="dialog"]');
  expect(document.activeElement).toBe(dialog.element);
  await dialog.trigger('keydown', { key: 'Tab' });
  await dialog.trigger('keydown', { key: 'Escape' });
  expect(document.activeElement).toBe(dialog.element);
  expect(wrapper.emitted('dismissed')).toBeUndefined();
});

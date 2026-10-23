import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { createPinia, defineStore } from 'pinia';
import { createMemoryHistory, createRouter, useRouter } from 'vue-router';
import { afterEach, expect, it, vi } from 'vitest';
import { Deferred } from '@/utility/async/Deferred';
import { useModalProvider, useModal, type IModalController } from '@/composables/ModalComposable';
const roots: VueWrapper[] = [];
const mounted = vi.fn();
const unmounted = vi.fn();
const Form = defineComponent({
  props: { title: { type: String, required: true }, signal: { type: AbortSignal, required: true } },
  emits: ['dismissed'],
  setup(props, { emit }) {
    const value = ref('');
    onMounted(() => mounted(document.querySelector('input')?.isConnected));
    onUnmounted(unmounted);
    return () => h('section', [h('h1', props.title), h('input', { value: value.value, onInput: (event: Event) => { value.value = (event.target as HTMLInputElement).value; } }), h('button', { onClick: () => emit('dismissed') }, 'Close')]);
  },
});
function _boot() {
  let modal!: IModalController;
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => h('div') } }] });
  const publication = ref(0);
  const root = mount(defineComponent({ setup() { modal = useModalProvider(); return () => h('main', String(publication.value)); } }), { global: { plugins: [createPinia(), router] } });
  roots.push(root);
  return { modal, root, router, publication };
}
afterEach(() => { for (const root of roots.splice(0)) root.unmount(); vi.clearAllMocks(); });
it('mounts connected DOM with typed props and closes through its dismissal event', async () => {
  const { modal } = _boot();
  const closed = vi.fn();
  const handle = modal.open(Form, Object.freeze({ title: 'First' }), closed);
  expect(document.querySelector('h1')?.textContent).toBe('First');
  expect(mounted).toHaveBeenCalledWith(true);
  document.querySelector('button')!.click();
  await handle.close();
  expect(handle.signal.aborted).toBe(true);
  expect(document.querySelector('section')).toBeNull();
  expect(closed).toHaveBeenCalledOnce();
});
it('retains the mounted form through unrelated updates and resets it on same-component replacement', async () => {
  const { modal, publication } = _boot();
  const props = Object.freeze({ title: 'Same' });
  const first = modal.open(Form, props);
  const input = document.querySelector('input')!;
  input.value = 'Owned input';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
  expect(document.querySelector('input')).toBe(input);
  expect(input.value).toBe('Owned input');
  publication.value += 1;
  await nextTick();
  expect(document.querySelector('input')).toBe(input);
  expect(input.value).toBe('Owned input');
  const second = modal.open(Form, props);
  expect(first.signal.aborted).toBe(true);
  expect(document.querySelector('input')).not.toBe(input);
  expect(document.querySelector('input')!.value).toBe('');
  await first.close();
  expect(second.signal.aborted).toBe(false);
  expect(document.querySelector('h1')?.textContent).toBe('Same');
  expect(unmounted).toHaveBeenCalledOnce();
});
it('shares Pinia, router and modal injection with the mounted component', () => {
  const { modal, router } = _boot();
  const useExample = defineStore('modal-context', () => ({ name: ref('Shared context') }));
  let injected: IModalController | undefined;
  let modalRouter: ReturnType<typeof useRouter> | undefined;
  const Context = defineComponent({ setup() { injected = useModal(); modalRouter = useRouter(); const store = useExample(); return () => h('p', store.name); } });
  modal.open(Context, {});
  expect(injected).toBe(modal);
  expect(modalRouter).toBe(router);
  expect(document.querySelector('p')?.textContent).toBe('Shared context');
});
it('settles a captured close once and returns the same pending completion', async () => {
  const { modal } = _boot();
  const pending = new Deferred<void>();
  const closed = vi.fn(() => pending);
  const handle = modal.open(Form, { title: 'Pending close' }, closed);
  const completion = handle.close();
  expect(handle.close()).toBe(completion);
  await Promise.resolve();
  expect(closed).toHaveBeenCalledOnce();
  pending.resolve();
  await completion;
});
it('installs a replacement before a previous close callback can open another modal', async () => {
  const { modal } = _boot();
  modal.open(Form, { title: 'First' }, () => { modal.open(Form, { title: 'Callback' }); });
  const replacement = modal.open(Form, { title: 'Replacement' });
  await flushPromises();
  expect(replacement.signal.aborted).toBe(true);
  expect(document.querySelector('h1')?.textContent).toBe('Callback');
});
it('suppresses unstarted close callbacks on root disposal and rejects later opens', async () => {
  const { modal, root } = _boot();
  const closed = vi.fn();
  const handle = modal.open(Form, { title: 'Disposal' }, closed);
  root.unmount();
  await handle.close();
  expect(handle.signal.aborted).toBe(true);
  expect(closed).not.toHaveBeenCalled();
  expect(document.querySelector('section')).toBeNull();
  expect(() => modal.open(Form, { title: 'Too late' })).toThrow(/disposed/i);
});
it('cleans a failed mount and permits a later opening', async () => {
  const { modal, root } = _boot();
  root.vm.$.appContext.config.errorHandler = (error) => { throw error; };
  const broken = defineComponent({ setup() { throw new Error('Mount failed'); } });
  const closed = vi.fn();
  expect(() => modal.open(broken, {}, closed)).toThrow('Mount failed');
  await flushPromises();
  expect(closed).toHaveBeenCalledOnce();
  const next = modal.open(Form, { title: 'Recovered' });
  expect(next.signal.aborted).toBe(false);
  expect(document.querySelector('h1')?.textContent).toBe('Recovered');
});
it('keeps modal ownership separate between applications', async () => {
  const first = _boot();
  const second = _boot();
  const firstHandle = first.modal.open(Form, { title: 'First app' });
  const secondHandle = second.modal.open(Form, { title: 'Second app' });
  await firstHandle.close();
  expect(secondHandle.signal.aborted).toBe(false);
  expect(document.querySelector('h1')?.textContent).toBe('Second app');
});
it('unmounts the old component before mounting a different component', async () => {
  const { modal } = _boot();
  const order: string[] = [];
  const Previous = defineComponent({ setup() { onUnmounted(() => order.push('unmounted')); return () => h('p', 'Previous'); } });
  const Replacement = defineComponent({ setup() { onMounted(() => order.push('mounted')); return () => h('p', 'Replacement'); } });
  const old = modal.open(Previous, {}, () => { order.push('closed'); });
  const next = modal.open(Replacement, {});
  expect(order).toEqual(['unmounted', 'mounted']);
  await old.close();
  expect(order).toEqual(['unmounted', 'mounted', 'closed']);
  expect(next.signal.aborted).toBe(false);
});
it('handles a failed close callback once without rejecting dismissal', async () => {
  const { modal } = _boot();
  const error = new Error('Close failed');
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const closed = vi.fn(async () => { throw error; });
  const handle = modal.open(Form, { title: 'Failure' }, closed);
  await expect(handle.close()).resolves.toBeUndefined();
  await handle.close();
  expect(closed).toHaveBeenCalledOnce();
  expect(logged).toHaveBeenCalledWith('[ModalComposable] close failed.', expect.objectContaining({ message: 'Close failed' }), error);
  logged.mockRestore();
});
it('does not start a queued replacement callback after root disposal', async () => {
  const { modal, root } = _boot();
  const closed = vi.fn();
  const previous = modal.open(Form, { title: 'Previous' }, closed);
  modal.open(Form, { title: 'Current' });
  root.unmount();
  await previous.close();
  expect(closed).not.toHaveBeenCalled();
});
it('requires root initialisation and rejects a second controller in the same app', () => {
  const logged = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => mount(defineComponent({ setup() { useModal(); return () => null; } }))).toThrow(/initialised/);
  expect(() => mount(defineComponent({ setup() { useModalProvider(); useModalProvider(); return () => null; } }))).toThrow(/already initialised/);
  logged.mockRestore();
});

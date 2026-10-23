import { createVNode, getCurrentInstance, inject, onScopeDispose, render, type Component, type InjectionKey } from 'vue';
import { logHandledError } from '@/utility/errors';
export type ModalProps<C> = C extends abstract new (...args: never[]) => { $props: infer P } ? Omit<P, 'signal' | 'onDismissed'> : never;
export interface IModalHandle {
  readonly signal: AbortSignal;
  close: () => Promise<void>;
}
export interface IModalController {
  open<C extends Component>(component: C, props: ModalProps<C>, onClosed?: () => void | Promise<void>): IModalHandle;
}
interface IModalOwner {
  container: HTMLDivElement;
  controller: AbortController;
  onClosed?: () => void | Promise<void>;
  detached: boolean;
  completion?: Promise<void>;
}
const _modalKey: InjectionKey<IModalController> = Symbol('modal');
export function useModalProvider() {
  const instance = getCurrentInstance();
  if (!instance) throw new Error('Modal initialisation requires component setup.');
  const context = instance.appContext;
  if (context.provides[_modalKey]) throw new Error('Modal controller is already initialised.');
  let active: IModalOwner | undefined;
  let disposed = false;
  function _detach(owner: IModalOwner) {
    if (owner.detached) return;
    owner.detached = true;
    owner.controller.abort();
    if (active === owner) active = undefined;
    try { render(null, owner.container); } finally { owner.container.remove(); }
  }
  function _completeClose(owner: IModalOwner) {
    owner.completion ??= Promise.resolve().then(() => {
      if (!disposed) return owner.onClosed?.();
    }).catch((error: unknown) => { logHandledError('ModalComposable', 'close', error); });
    return owner.completion;
  }
  function _close(owner: IModalOwner) {
    _detach(owner);
    return _completeClose(owner);
  }
  function _mount<C extends Component>(owner: IModalOwner, component: C, props: ModalProps<C>) {
    document.body.append(owner.container);
    const vnode = createVNode(component, { ...props, signal: owner.controller.signal, onDismissed: () => _close(owner) });
    vnode.appContext = context;
    render(vnode, owner.container);
  }
  function open<C extends Component>(component: C, props: ModalProps<C>, onClosed?: () => void | Promise<void>) {
    if (disposed) throw new Error('Modal controller has been disposed.');
    const previous = active;
    if (previous) _detach(previous);
    const owner: IModalOwner = { container: document.createElement('div'), controller: new AbortController(), onClosed, detached: false };
    active = owner;
    try { _mount(owner, component, props); } catch (error) {
      void _close(owner);
      throw error;
    } finally {
      if (previous) void _completeClose(previous);
    }
    return { signal: owner.controller.signal, close: () => _close(owner) };
  }
  function _dispose() {
    disposed = true;
    if (active) void _close(active);
  }
  const controller: IModalController = { open };
  context.app.provide(_modalKey, controller);
  onScopeDispose(_dispose);
  return controller;
}
export function useModal() {
  const controller = inject(_modalKey);
  if (!controller) throw new Error('Modal controller must be initialised before use.');
  return controller;
}

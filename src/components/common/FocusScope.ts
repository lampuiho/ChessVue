import type { ObjectDirective } from 'vue';
interface IFocusScope { element: HTMLElement; opener: Element | null; dispose(): void }
const scopes: IFocusScope[] = [];
const owners = new WeakMap<HTMLElement, IFocusScope>();
function isAvailable(element: HTMLElement) {
  const style = getComputedStyle(element);
  return !element.matches(':disabled') && !element.closest('[hidden], [inert]')
    && element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}
function focusable(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'))
    .filter((control) => control.tabIndex >= 0 && isAvailable(control));
}
function focusInitial(element: HTMLElement) {
  const controls = focusable(element);
  (controls.find((control) => control.hasAttribute('autofocus')) ?? controls[0] ?? element).focus();
}
function activate(element: HTMLElement) {
  const opener = document.activeElement;
  function containFocus(event: FocusEvent) {
    if (scopes[scopes.length - 1]?.element === element && !element.contains(event.target as Node)) focusInitial(element);
  }
  function retainFocus(event: FocusEvent) {
    if (event.relatedTarget === null && element.isConnected && document.hasFocus() && scopes[scopes.length - 1]?.element === element) focusInitial(element);
  }
  function cycleFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab' || scopes[scopes.length - 1]?.element !== element) return;
    const controls = focusable(element);
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
    event.preventDefault();
    (controls[next] ?? element).focus();
  }
  const scope: IFocusScope = { element, opener, dispose: () => {
    document.removeEventListener('focusin', containFocus);
    element.removeEventListener('keydown', cycleFocus);
    element.removeEventListener('focusout', retainFocus);
  } };
  owners.set(element, scope);
  scopes.push(scope);
  document.addEventListener('focusin', containFocus);
  element.addEventListener('keydown', cycleFocus);
  element.addEventListener('focusout', retainFocus);
  focusInitial(element);
}
function deactivate(element: HTMLElement) {
  const scope = owners.get(element);
  if (!scope) return;
  scope.dispose();
  owners.delete(element);
  const wasActive = scopes[scopes.length - 1] === scope;
  scopes.splice(scopes.indexOf(scope), 1);
  if (!wasActive) return;
  const active = scopes[scopes.length - 1]?.element;
  if (scope.opener instanceof HTMLElement && scope.opener.isConnected && isAvailable(scope.opener) && (!active || active.contains(scope.opener))) scope.opener.focus();
  else if (active) focusInitial(active);
  else focusable(document.querySelector('main') ?? document.body)[0]?.focus();
}
// Each rendered dialog owns its focus listeners until its DOM is removed, including nested dialogs.
export const vFocusScope: ObjectDirective<HTMLElement> = { mounted: activate, unmounted: deactivate };

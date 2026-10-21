import type { ObjectDirective } from 'vue';
interface IFocusScope { element: HTMLElement; opener: Element | null; dispose(): void }
const scopes: IFocusScope[] = [];
const owners = new WeakMap<HTMLElement, IFocusScope>();
function _isAvailable(element: HTMLElement) {
  const style = getComputedStyle(element);
  return !element.matches(':disabled') && !element.closest('[hidden], [inert]')
    && element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}
function _focusable(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'))
    .filter((control) => control.tabIndex >= 0 && _isAvailable(control));
}
function _focusInitial(element: HTMLElement) {
  const controls = _focusable(element);
  (controls.find((control) => control.hasAttribute('autofocus')) ?? controls[0] ?? element).focus();
}
function _activate(element: HTMLElement) {
  const opener = document.activeElement;
  function _containFocus(event: FocusEvent) {
    if (scopes[scopes.length - 1]?.element === element && !element.contains(event.target as Node)) _focusInitial(element);
  }
  function _retainFocus(event: FocusEvent) {
    if (event.relatedTarget === null && element.isConnected && document.hasFocus() && scopes[scopes.length - 1]?.element === element) _focusInitial(element);
  }
  function _cycleFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab' || scopes[scopes.length - 1]?.element !== element) return;
    const controls = _focusable(element);
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
    event.preventDefault();
    (controls[next] ?? element).focus();
  }
  const scope: IFocusScope = { element, opener, dispose: () => {
    document.removeEventListener('focusin', _containFocus);
    element.removeEventListener('keydown', _cycleFocus);
    element.removeEventListener('focusout', _retainFocus);
  } };
  owners.set(element, scope);
  scopes.push(scope);
  document.addEventListener('focusin', _containFocus);
  element.addEventListener('keydown', _cycleFocus);
  element.addEventListener('focusout', _retainFocus);
  _focusInitial(element);
}
function _deactivate(element: HTMLElement) {
  const scope = owners.get(element);
  if (!scope) return;
  scope.dispose();
  owners.delete(element);
  const wasActive = scopes[scopes.length - 1] === scope;
  scopes.splice(scopes.indexOf(scope), 1);
  if (!wasActive) return;
  const active = scopes[scopes.length - 1]?.element;
  if (scope.opener instanceof HTMLElement && scope.opener.isConnected && _isAvailable(scope.opener) && (!active || active.contains(scope.opener))) scope.opener.focus();
  else if (active) _focusInitial(active);
  else _focusable(document.querySelector('main') ?? document.body)[0]?.focus();
}
// Each rendered dialog owns its focus listeners until its DOM is removed, including nested dialogs.
export const vFocusScope: ObjectDirective<HTMLElement> = { mounted: _activate, unmounted: _deactivate };

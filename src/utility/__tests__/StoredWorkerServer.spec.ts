import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoredWorkerServer, type IStoredWorkerScope } from '../StoredWorkerServer';
import { StoredWorkerUtility } from '../StoredWorkerUtility';

const _config = { databaseName: 'plain-files', storeName: 'assets', rootPath: 'stored-files', serviceWorkerPath: 'files.js' };
function _scope() {
  return Object.assign(new EventTarget(), {
    location: { href: 'https://example.test/scripts/files.js?databaseName=plain-files' },
    registration: { scope: 'https://example.test/nested/' },
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  });
}
afterEach(() => { vi.restoreAllMocks(); });
describe('stored-file worker-side ownership', () => {
  it('attaches handlers only on start and detaches the exact handlers on disposal', () => {
    const scope = _scope();
    const added = vi.spyOn(scope, 'addEventListener');
    const removed = vi.spyOn(scope, 'removeEventListener');
    const server = new StoredWorkerServer(_config, scope as unknown as IStoredWorkerScope);
    expect(added).not.toHaveBeenCalled();
    server.start();
    server.start();
    expect(added.mock.calls.map(call => call[0])).toEqual(['activate', 'fetch']);
    server.dispose();
    server.dispose();
    expect(removed.mock.calls).toEqual(added.mock.calls);
    const respondWith = vi.fn();
    scope.dispatchEvent(Object.assign(new Event('fetch'), { request: new Request('https://example.test/nested/stored-files/a/main.js'), respondWith }));
    expect(respondWith).not.toHaveBeenCalled();
  });
  it('claims clients through the activation event and supplies matching response promises synchronously', async () => {
    const scope = _scope();
    const response = Promise.resolve(new Response('original bytes'));
    const respond = vi.spyOn(StoredWorkerUtility.prototype, 'respond').mockReturnValue(response);
    const server = new StoredWorkerServer(_config, scope as unknown as IStoredWorkerScope);
    server.start();
    const waitUntil = vi.fn();
    scope.dispatchEvent(Object.assign(new Event('activate'), { waitUntil }));
    expect(waitUntil).toHaveBeenCalledWith(scope.clients.claim.mock.results[0]!.value);
    const request = new Request('https://example.test/nested/stored-files/Any/nested/main.js');
    const respondWith = vi.fn();
    scope.dispatchEvent(Object.assign(new Event('fetch'), { request, respondWith }));
    expect(respondWith).toHaveBeenCalledWith(response);
    expect(respond).toHaveBeenCalledWith(request, new URL(scope.registration.scope));
    expect(await (await response).text()).toBe('original bytes');
    respondWith.mockClear();
    for (const path of ['https://example.test/nested/index.html', 'https://other.test/nested/stored-files/a/main.js', 'https://example.test/stored-files/a/main.js']) scope.dispatchEvent(Object.assign(new Event('fetch'), { request: new Request(path), respondWith }));
    expect(respondWith).not.toHaveBeenCalled();
    server.dispose();
  });
  it('removes only its own listeners when multiple objects use the same native event target', () => {
    const scope = _scope();
    const first = new StoredWorkerServer(_config, scope as unknown as IStoredWorkerScope);
    const second = new StoredWorkerServer({ ..._config, rootPath: 'other-files' }, scope as unknown as IStoredWorkerScope);
    const respond = vi.spyOn(StoredWorkerUtility.prototype, 'respond').mockResolvedValue(new Response('other bytes'));
    first.start();
    second.start();
    first.dispose();
    const respondWith = vi.fn();
    scope.dispatchEvent(Object.assign(new Event('fetch'), { request: new Request('https://example.test/nested/stored-files/a/main.js'), respondWith }));
    expect(respondWith).not.toHaveBeenCalled();
    scope.dispatchEvent(Object.assign(new Event('fetch'), { request: new Request('https://example.test/nested/other-files/a/main.js'), respondWith }));
    expect(respondWith).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledOnce();
    second.dispose();
  });
});

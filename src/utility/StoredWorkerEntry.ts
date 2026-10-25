import { StoredWorkerServer, type IStoredWorkerScope } from './StoredWorkerServer';

const scope = globalThis as unknown as IStoredWorkerScope;
const scriptUrl = new URL(scope.location.href);
const databaseName = scriptUrl.searchParams.get('databaseName');
const storeName = scriptUrl.searchParams.get('storeName');
const rootPath = scriptUrl.searchParams.get('rootPath');
if (!databaseName?.trim() || !storeName?.trim() || !rootPath || /[\\\u0000-\u001f]/.test(rootPath) || rootPath.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid stored-worker configuration.');
new StoredWorkerServer({ databaseName, storeName, rootPath, serviceWorkerPath: scriptUrl.href }, scope).start();

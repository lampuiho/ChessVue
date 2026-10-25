import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { StockfishConfig } from '../../src/config/StockfishConfig';
import { createAnalysis, expectAnalysis } from './EngineAction';

function _archive(files: Record<string, Uint8Array>) {
  return { name: 'engine.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) };
}
test('imports original Stockfish files and runs a routed profile through self-contained Blob Workers across reload', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('/settings/engines/packages/import');
  await expect(page.getByRole('heading', { name: 'Install browser engine', exact: true })).toBeVisible();
  await page.getByLabel('Engine name').fill('stockfish');
  await expect(page.getByText('An engine named "stockfish" already exists.')).toBeVisible();
  await page.getByLabel('Engine name').fill('bad/name');
  await expect(page.getByText(/without reserved characters/)).toBeVisible();
  await page.getByLabel('Engine name').fill('Stockfish test');
  await page.getByLabel('Choose engine archive').setInputFiles(_archive({
    ['vendor/build/' + StockfishConfig.workerFile]: readFileSync('node_modules/stockfish/bin/' + StockfishConfig.workerFile),
    ['vendor/build/' + StockfishConfig.wasmFile]: readFileSync('node_modules/stockfish/bin/' + StockfishConfig.wasmFile),
    'Copying.txt': readFileSync('node_modules/stockfish/Copying.txt'),
  }));
  await expect(page.getByRole('button', { name: 'Install engine', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Install engine', exact: true }).click();
  await expect(page.getByText('Import complete.', { exact: true })).toBeVisible();
  const afterImport = workers.length;
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await expect(page).toHaveURL(/\/profiles\/new\?packagePath=/);
  await expect(page.locator('#engine-path')).toHaveValue('');
  await page.getByLabel('Profile name').fill('Imported Stockfish');
  await page.locator('#engine-entry-file').selectOption('engine-files/Stockfish test/vendor/build/' + StockfishConfig.workerFile);
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Custom game/ }).click();
  await createAnalysis(page, ['Imported Stockfish']);
  await expectAnalysis(page, ['Imported Stockfish']);
  expect(workers.slice(afterImport).some(url => url.startsWith('blob:'))).toBe(true);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(registrations => registrations.length))).toBe(0);
  const stores = await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open('chessvue-engines', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const names = Array.from(request.result.objectStoreNames); request.result.close(); resolve(names); };
  }));
  expect(stores).toEqual(['files']);
  await page.reload();
  await expectAnalysis(page, ['Imported Stockfish']);
  expect(errors).toEqual([]);
});
test('serves sibling scripts, checks profile references only and stops closed processes harmlessly', async ({ page }) => {
  await page.goto('/home');
  const result = await page.evaluate(async () => {
    const serviceModule = '/src/domain/EnginePackageService.ts';
    const managerModule = '/src/platform/browser/BrowserProcessManager.ts';
    const clientModule = '/src/platform/browser/BrowserEngineClient.ts';
    const { EnginePackageService: service } = await import(serviceModule);
    const { BrowserProcessManager } = await import(managerModule);
    const { BrowserUciEngineClient } = await import(clientModule);
    const encode = (value: string) => new TextEncoder().encode(value);
    const entry = "importScripts('./support.js');onmessage=e=>{if(e.data==='uci')postMessage('option name Marker type string default '+marker+'\\nuciok');if(e.data==='isready')postMessage('readyok');};";
    for (const [name, marker] of [['Script A % #', 'alpha'], ['Script B', 'beta']]) {
      await service.install(name, { files: [{ path: 'scripts/start.js', data: encode(entry) }, { path: 'scripts/support.js', data: encode("const marker='" + marker + "';") }] });
    }
    const manager = new BrowserProcessManager();
    const client = new BrowserUciEngineClient();
    const first = await manager.spawnProcess('engine-files/Script A % #/scripts/start.js');
    const second = await manager.spawnProcess('engine-files/Script B/scripts/start.js');
    const assigned = (process: unknown) => ({ displayName: 'Test', clientType: 'uciWorker', entryPath: '', options: {}, $: { process, availability: 'unavailable', analysisLines: new Map() } });
    const a = assigned(first), b = assigned(second);
    await client.initialiseEngine(a);
    await client.initialiseEngine(b);
    let blocked = '';
    try { await service.remove('engine-files/Script A % #', [{ displayName: 'Configured profile', clientType: 'uciWorker', entryPath: 'engine-files/Script A % #/scripts/start.js' }]); } catch (error) { blocked = (error as Error).message; }
    await service.remove('engine-files/Script A % #', []);
    manager.assertProcessOpen(first);
    await manager.stopProcess(first);
    await manager.stopProcess(first);
    manager.assertProcessOpen(second);
    const secondOptions = client.getOptions(b);
    let missing = '';
    try { await manager.spawnProcess('engine-files/Script A % #/scripts/start.js'); } catch (error) { missing = String((error as { detail: string }).detail); }
    await manager.stopProcess(second);
    await service.remove('engine-files/Script B', []);
    await manager.dispose();
    return { blocked, secondOptions, missing, packages: (await service.listPackages()).map((engine: { displayName: string }) => engine.displayName) };
  });
  expect(result.blocked).toContain('Configured profile');
  expect(result.secondOptions).toContainEqual(expect.objectContaining({ name: 'Marker', defaultValue: 'beta' }));
  expect(result.missing).toContain('Stored worker entry not found');
  expect(result.packages).toEqual(['stockfish']);
});
test('direct import keeps installation disabled when folder discovery fails', async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new DOMException('Engine storage blocked.', 'SecurityError'); };
  });
  await page.goto('/settings/engines/packages/import');
  await page.getByLabel('Engine name').fill('New engine');
  await page.getByLabel('Choose engine archive').setInputFiles(_archive({ 'vendor/main.js': new TextEncoder().encode("onmessage=()=>postMessage('uciok');") }));
  await expect(page.getByRole('alert')).toContainText('Engine storage blocked.');
  await expect(page.getByRole('button', { name: 'Install engine', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh folders', exact: true })).toBeEnabled();
});

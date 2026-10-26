import { spawn } from 'node:child_process';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { requireExecutable } from '../../desktop/DesktopHost.mjs';
import { configureEngines, createAnalysis, engineSection, expectAnalysis } from '../browser/EngineAction';
import { desktopEngineNames } from '../../journeys/definitions/desktop/data/DesktopScenario';

export { engineSection, expectAnalysis };
export async function configureNativeEngines(page: Page, testInfo: TestInfo) {
  const path = await requireExecutable(process.env.CHESSVUE_UCI_EXECUTABLE, 'CHESSVUE_UCI_EXECUTABLE');
  const identity = await _probeEngine(path);
  await testInfo.attach('native-engine', { body: JSON.stringify({ path, identity }), contentType: 'application/json' });
  await configureEngines(page, desktopEngineNames.map(name => ({ name, path })), process.env.CHESSVUE_DESKTOP_URL);
}
export async function createNativeAnalysis(page: Page, testInfo: TestInfo) {
  await configureNativeEngines(page, testInfo);
  await createAnalysis(page, [...desktopEngineNames]);
  await expectAnalysis(page, [...desktopEngineNames]);
}
async function _probeEngine(path: string) {
  const child = spawn(path, [], { windowsHide: true, stdio: 'pipe' });
  let output = '';
  let stderr = '';
  let quitting = false;
  const timer = setTimeout(() => child.kill(), 30000);
  try {
    await new Promise<void>((accept, reject) => {
      child.once('error', reject);
      child.stdin.once('error', reject);
      child.once('spawn', () => child.stdin.write('uci\n'));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', data => {
        output += data;
        if (!output.includes('uciok') || quitting) return;
        quitting = true;
        child.stdin.end('quit\n');
      });
      child.stderr.on('data', data => { stderr += String(data); });
      child.once('close', (code, signal) => output.includes('uciok') ? accept() : reject(new Error(`Native UCI handshake failed (code=${code}, signal=${signal}). Output: ${output}. Errors: ${stderr}`)));
    });
    expect(output).toMatch(/id name .+/);
    return output.split(/\r?\n/).filter(line => /^id (name|author) /.test(line));
  } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
}

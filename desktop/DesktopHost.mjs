import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

export async function requireExecutable(value, name) {
  if (!value) throw new Error(`Set ${name} to the full executable path. See README.md (NW.js desktop).`);
  const executable = resolve(value);
  if (!(await stat(executable)).isFile()) throw new Error(`${name} must name an executable file: ${executable}.`);
  return executable;
}
export async function availablePort() {
  const server = createServer();
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const port = server.address().port;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return port;
}
export async function launchDesktop({ executable, directory, url, port, visible = true, deferNavigation = false }) {
  const origin = new URL(url).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Desktop development requires a loopback HTTP origin.');
  await mkdir(directory, { recursive: true });
  const manifest = {
    name: 'chessvue-desktop', main: deferNavigation ? 'about:blank' : url, 'node-remote': `${origin}/*`,
    'chromium-args': '--disable-features=WinSystemLocationPermission',
    window: { title: 'ChessVue', width: 1440, height: 900, show: visible },
  };
  await writeFile(resolve(directory, 'package.json'), JSON.stringify(manifest, null, 2));
  const backgroundFlags = visible ? [] : ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];
  return spawn(executable, [directory, ...backgroundFlags, `--user-data-dir=${resolve(directory, 'profile')}`, `--remote-debugging-port=${port}`], { cwd: directory, windowsHide: !visible, stdio: ['ignore', 'pipe', 'pipe'] });
}
export async function terminateDesktop(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await once(killer, 'exit');
  } else {
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
  }
}

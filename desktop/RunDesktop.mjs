import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { availablePort, launchDesktop, requireExecutable, terminateDesktop } from './DesktopHost.mjs';

const executable = await requireExecutable(process.env.CHESSVUE_NWJS_EXECUTABLE, 'CHESSVUE_NWJS_EXECUTABLE');
const root = fileURLToPath(new URL('../', import.meta.url));
const port = await availablePort();
const server = await createServer({
  root, define: { __CHESSVUE_PLATFORM__: JSON.stringify('auto') },
  server: { host: '127.0.0.1', port, strictPort: true },
});
const shutdown = new AbortController();
let child;
process.once('SIGINT', _requestStop);
process.once('SIGTERM', _requestStop);
try {
  await server.listen();
  child = await launchDesktop({
    executable, directory: resolve(root, '.desktop/development'),
    url: `http://127.0.0.1:${port}/`, port: await availablePort(),
  });
  console.log('ChessVue desktop: local data in .desktop/development; close the app to stop the server.');
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));
  await once(child, 'exit', { signal: shutdown.signal });
} catch (error) {
  if (!shutdown.signal.aborted) throw error;
} finally {
  process.removeListener('SIGINT', _requestStop);
  process.removeListener('SIGTERM', _requestStop);
  try { if (child) await terminateDesktop(child); }
  finally { await server.close(); }
}
function _requestStop() { shutdown.abort(); }

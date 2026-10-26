import { createServer } from 'vite';
import { availablePort, requireExecutable } from '../../desktop/DesktopHost.mjs';

export default async function desktopSetup() {
  process.env.CHESSVUE_NWJS_EXECUTABLE = await requireExecutable(process.env.CHESSVUE_NWJS_EXECUTABLE, 'CHESSVUE_NWJS_EXECUTABLE');
  const port = await availablePort();
  const server = await createServer({
    cacheDir: 'node_modules/.vite-e2e/desktop', define: { __CHESSVUE_PLATFORM__: JSON.stringify('auto') },
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  try { await server.listen(); } catch (error) { await server.close(); throw error; }
  process.env.CHESSVUE_DESKTOP_URL = `http://127.0.0.1:${port}/`;
  return async () => { await server.close(); };
}

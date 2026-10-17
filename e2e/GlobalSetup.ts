import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { PlatformTarget } from '../src/contracts/platform/PlatformTarget';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const servers: ViteDevServer[] = [];
  const root = fileURLToPath(new URL('../', import.meta.url));
  const browserDefine = { __CHESSVUE_PLATFORM__: JSON.stringify(PlatformTarget.Browser) };
  const browserPort = Number(process.env.CHESSVUE_E2E_PORT ?? 4173);
  try {
    const browser = await createServer({ root, cacheDir: `node_modules/.vite-e2e/browser-${browserPort}`, define: browserDefine, server: { host: '127.0.0.1', port: browserPort, strictPort: true } });
    servers.push(browser);
    await browser.listen();
    const journey = await createServer({
      root,
      cacheDir: `node_modules/.vite-e2e/journeys-${browserPort + 1}`,
      define: { ...browserDefine, __CHESSVUE_JOURNEY_RUN__: JSON.stringify({ name: 'fresh', id: randomUUID() }) },
      plugins: [{ name: 'chessvue-journey-entry', transformIndexHtml: (html) => html.replace('/src/main.ts', '/journeys/main.ts') }],
      server: { host: '127.0.0.1', port: browserPort + 1, strictPort: true },
    });
    servers.push(journey);
    await journey.listen();
  } catch (error) {
    await Promise.all(servers.map((server) => server.close()));
    throw error;
  }
  // Own Vite directly so cleanup does not depend on OS process-tree commands.
  return async () => { await Promise.all(servers.map((server) => server.close())); };
}

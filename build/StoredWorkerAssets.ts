import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export function storedWorkerAssets(serviceWorkerPath: string): Plugin {
  let isBuild = false;
  return {
    name: 'stored-worker-assets',
    configResolved(config) { isBuild = config.command === 'build'; },
    buildStart() {
      if (isBuild) this.emitFile({ type: 'chunk', id: fileURLToPath(new URL('../src/utility/StoredWorkerEntry.ts', import.meta.url)), fileName: serviceWorkerPath });
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== server.config.base + serviceWorkerPath) return next();
        try {
          const transformed = await server.transformRequest('/src/utility/StoredWorkerEntry.ts');
          if (!transformed) throw new Error('The stored-worker entry could not be compiled.');
          response.setHeader('Content-Type', 'text/javascript');
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Service-Worker-Allowed', server.config.base);
          response.end(transformed.code);
        } catch (error) { next(error); }
      });
    },
  };
}

import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { StockfishConfig } from '../src/config/StockfishConfig';

// Stockfish's instantiateWasm promise can reject without settling its module startup promise.
// Relay that worker-owned failure through the error event consumed by BrowserUciTransport.
const workerFailureBoundary = `self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  setTimeout(() => { throw event.reason instanceof Error ? event.reason : new Error(String(event.reason)); }, 0);
});\n`;
async function readAsset(name: string, url: URL) {
  const raw = await readFile(url);
  return name === StockfishConfig.workerFile ? Buffer.concat([Buffer.from(workerFailureBoundary), raw]) : raw;
}
export function stockfishAssets(): Plugin {
  const files = new Map([
    [StockfishConfig.workerFile, { url: new URL('../node_modules/stockfish/bin/' + StockfishConfig.workerFile, import.meta.url), type: 'text/javascript' }],
    [StockfishConfig.wasmFile, { url: new URL('../node_modules/stockfish/bin/' + StockfishConfig.wasmFile, import.meta.url), type: 'application/wasm' }],
    ['Copying.txt', { url: new URL('../node_modules/stockfish/Copying.txt', import.meta.url), type: 'text/plain' }],
  ]);
  return {
    name: 'chessvue-stockfish-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        const prefix = server.config.base + StockfishConfig.directory + '/';
        if (!path.startsWith(prefix)) return next();
        const source = files.get(path.slice(prefix.length));
        if (!source) return next();
        try {
          const raw = await readAsset(path.slice(prefix.length), source.url);
          response.setHeader('Content-Type', source.type);
          response.end(raw);
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      for (const [name, file] of files) this.emitFile({ type: 'asset', fileName: StockfishConfig.directory + '/' + name, source: await readAsset(name, file.url) });
    },
  };
}

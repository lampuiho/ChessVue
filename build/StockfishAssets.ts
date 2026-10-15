import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { StockfishConfig } from '../src/config/StockfishConfig';

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
          const raw = await readFile(source.url);
          response.setHeader('Content-Type', source.type);
          response.end(raw);
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      for (const [name, file] of files) this.emitFile({ type: 'asset', fileName: StockfishConfig.directory + '/' + name, source: await readFile(fileURLToPath(file.url)) });
    },
  };
}

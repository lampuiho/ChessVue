import { StockfishConfig } from '../../../../src/config/StockfishConfig';

export const browserEngineFailures = [
  { name: 'invalid URL', path: 'http://[', error: 'worker URL is invalid' },
  { name: 'native executable', path: 'C:\\Engines\\stockfish.exe', error: 'require the desktop app' },
  { name: 'cross-origin URL', path: 'https://example.invalid/stockfish.js', error: 'must be served from this site' },
  { name: 'unavailable worker', path: '/engines/unavailable.js', error: /worker|exited/i },
  { name: 'unavailable WASM', path: `/engines/broken/${StockfishConfig.workerFile}`, error: /worker|exited|abort|wasm/i },
];
export const browserInvalidImports = [
  { name: 'invalid JSON', bytes: Array.from(new TextEncoder().encode('{"schemaVersion":')), error: 'Invalid JSON' },
  { name: 'invalid UTF-8', bytes: [0xc3, 0x28], error: 'not valid UTF-8' },
];
export const browserThemeModes = ['system', 'light', 'dark'] as const;
export const browserCheckpointEvents = ['pagehide', 'visibilitychange'] as const;
export const browserReplyReloads = ['after reply', 'while reply is due'] as const;

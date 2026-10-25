const workerFile = 'stockfish-19-lite-single.js';
const wasmFile = 'stockfish-19-lite-single.wasm';
const directory = 'engines/stockfish';
export const StockfishConfig = {
  directory, workerFile, wasmFile,
  entryPath: directory + '/' + workerFile,
  files: [workerFile, wasmFile, 'Copying.txt'],
} as const;

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const catalogue = JSON.parse(await readFile(new URL('./Catalogue.json', import.meta.url), 'utf8'));
const [name = 'list', ...args] = process.argv.slice(2);
if (['list', '--help', '-h'].includes(name)) {
  console.log('Usage: npm run journey -- <name> [--port 5173] [--host 127.0.0.1] [--open]');
  for (const [id, entry] of Object.entries(catalogue)) console.log(`  ${id.padEnd(12)} ${entry.title}`);
} else if (!Object.hasOwn(catalogue, name)) {
  console.error(`Unknown journey: ${name}. Run npm run journey -- list.`);
  process.exitCode = 1;
} else {
  try {
    const options = parseOptions(args);
    const server = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      define: { __CHESSVUE_JOURNEY_RUN__: JSON.stringify({ name, id: randomUUID() }) },
      plugins: [{
        name: 'chessvue-journey-entry',
        transformIndexHtml: (html) => html.replace('/src/main.ts', '/journeys/main.ts'),
      }],
      server: { host: '127.0.0.1', strictPort: true, ...options },
    });
    await server.listen();
    console.log(`Journey: ${name} — ${catalogue[name].title}`);
    console.log('Reload keeps saved files. window.chessVueJourney.reset() starts again.');
    server.printUrls();
    server.bindCLIShortcuts({ print: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--open') options.open = true;
    else if (argument === '--port') {
      const port = Number(args[++index]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port requires a number from 1 to 65535.');
      options.port = port;
    } else if (argument === '--host') {
      const host = args[++index];
      if (!host || host.startsWith('--')) throw new Error('--host requires a hostname.');
      options.host = host;
    } else throw new Error(`Unknown option: ${argument}. Run npm run journey -- list.`);
  }
  return options;
}

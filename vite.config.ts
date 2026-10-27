import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { stockfishAssets } from './build/StockfishAssets';
import { PlatformTarget } from './src/contracts/platform/PlatformTarget';

const platformTarget = process.env.CHESSVUE_PLATFORM ?? 'auto';
if (!['auto', PlatformTarget.Nwjs, PlatformTarget.Browser].includes(platformTarget)) throw new Error(`Unsupported CHESSVUE_PLATFORM: ${platformTarget}.`);
const headers = { 'Permissions-Policy': 'geolocation=()' };
export default defineConfig({
  base: process.env.CHESSVUE_BASE_PATH ?? '/',
  server: { headers }, preview: { headers },
  define: { __CHESSVUE_PLATFORM__: JSON.stringify(platformTarget) },
  plugins: [vue(), vueDevTools(), stockfishAssets()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});

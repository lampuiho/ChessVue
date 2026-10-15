import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { PlatformTarget } from './src/contracts/platform/PlatformTarget';

const platformTarget = process.env.CHESSVUE_PLATFORM ?? 'auto';
if (!['auto', PlatformTarget.Nwjs, PlatformTarget.Browser].includes(platformTarget)) throw new Error(`Unsupported CHESSVUE_PLATFORM: ${platformTarget}.`);
export default defineConfig({
  define: { __CHESSVUE_PLATFORM__: JSON.stringify(platformTarget) },
  plugins: [vue(), vueDevTools()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const platformTarget = process.env.CHESSVUE_PLATFORM ?? 'nwjs'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __CHESSVUE_PLATFORM__: JSON.stringify(platformTarget),
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})

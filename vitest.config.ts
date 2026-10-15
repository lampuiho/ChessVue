import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    define: { __CHESSVUE_PLATFORM__: JSON.stringify('auto') },
    test: {
      environment: 'jsdom',
      // The first journey bootstrap compiles the full application.
      testTimeout: 15000,
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)

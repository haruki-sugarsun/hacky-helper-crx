import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [crx({ manifest })],
  server: { // https://github.com/crxjs/chrome-extension-tools/issues/696
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  // build: {
  //   rollupOptions: {
  //     input: {
  //       inject: 'src/inject.ts',
  //     },
  //   },
  // },
})

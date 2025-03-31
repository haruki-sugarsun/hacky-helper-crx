import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { nodePolyfills } from "vite-plugin-node-polyfills";

import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    crx({ manifest }),
    nodePolyfills({
      overrides: { fs: "./empty-polyfills.js" },
    }),
  ],
  server: {
    // https://github.com/crxjs/chrome-extension-tools/issues/696
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    resolve: {
      alias: {
        "node:fs": "./empty-polyfills.js",
        "fs/promises": "./empty-polyfills.js",
        fs: "./empty-polyfills.js",
        // etc...
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: "popup.html",
        editor: "editor.html",
        voice_log: "voice-log.html",
        tabs: "tabs.html",
        settings: "settings.html",
      },
    },
  },
});

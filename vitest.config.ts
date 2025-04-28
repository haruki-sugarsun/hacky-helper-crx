import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use the DOM environment for Chrome extension testing
    environment: "jsdom",
    // Specify the setup file
    setupFiles: ["./src/setupTests.ts"],
    // Include tsconfig paths if necessary (check tsconfig.json)
    // alias: { ... },
    // Glob pattern for test files
    include: ["src/**/*.test.ts"],
    // Optional: configure coverage
    // coverage: {
    //   provider: 'v8', // or 'istanbul'
    //   reporter: ['text', 'json', 'html'],
    // },
  },
});

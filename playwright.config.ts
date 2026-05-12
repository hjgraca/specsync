import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  retries: 1,
  reporter: [["html", { open: "never" }]],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node packages/server/dist/cli.js",
    port: 4000,
    reuseExistingServer: true,
  },
});

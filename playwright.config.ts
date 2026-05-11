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
    command: "npx tsx packages/server/src/cli.ts",
    port: 4000,
    reuseExistingServer: true,
  },
});

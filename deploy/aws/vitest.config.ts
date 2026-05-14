import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["cdk.out/**", "node_modules/**"],
  },
});
